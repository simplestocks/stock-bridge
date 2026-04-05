#!/usr/bin/env python3
"""
Build weekly earnings calendar JSON from Nasdaq public API.
- Pulls Mon-Fri of the CURRENT week (rolls forward Saturday)
- Filters to market cap >= $10B
- Formats: "Mon Apr 13: GS FAST | NFLX" (BMO | AMC)
- Writes public/data/earnings.json
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo

MIN_MARKET_CAP = 10_000_000_000  # $10B
OUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "public", "data", "earnings.json"
)
NASDAQ_URL = "https://api.nasdaq.com/api/calendar/earnings?date={date}"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def http_get_json(url, timeout=20, retries=3, backoff=1.5):
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(backoff ** (attempt + 1))
    raise RuntimeError(f"GET {url} failed: {last_err}")


def parse_market_cap(s):
    if not s or s in ("N/A", "--", ""):
        return 0
    try:
        return int(str(s).replace("$", "").replace(",", "").strip())
    except (ValueError, AttributeError):
        return 0


def week_dates():
    """Return Mon-Fri of current week in PT. On Sat/Sun, roll to next week."""
    tz = ZoneInfo("America/Los_Angeles")
    today = datetime.now(tz).date()
    weekday = today.weekday()  # 0=Mon..6=Sun
    if weekday >= 5:  # Sat or Sun -> next week
        monday = today + timedelta(days=(7 - weekday))
    else:
        monday = today - timedelta(days=weekday)
    return [monday + timedelta(days=i) for i in range(5)]


def fetch_day(d):
    url = NASDAQ_URL.format(date=d.isoformat())
    data = http_get_json(url)
    rows = ((data or {}).get("data") or {}).get("rows") or []
    out = []
    for r in rows:
        sym = (r.get("symbol") or "").strip()
        name = (r.get("name") or "").strip()
        mc = parse_market_cap(r.get("marketCap"))
        tcode = (r.get("time") or "").lower()  # time-pre-market / time-after-hours / time-not-supplied
        if not sym or mc < MIN_MARKET_CAP:
            continue
        # BMO = before market open, AMC = after market close, OTH = other/unspecified
        if "pre-market" in tcode:
            when = "BMO"
        elif "after-hours" in tcode:
            when = "AMC"
        else:
            when = "OTH"
        out.append({"symbol": sym, "name": name, "market_cap": mc, "when": when})
    # Sort by market cap desc within each day
    out.sort(key=lambda x: -x["market_cap"])
    return out


def format_day_line(d, events):
    day_name = d.strftime("%a")
    mmdd = d.strftime("%b %-d") if sys.platform != "win32" else d.strftime("%b %d")
    bmo = [e["symbol"] for e in events if e["when"] == "BMO"]
    amc = [e["symbol"] for e in events if e["when"] == "AMC"]
    oth = [e["symbol"] for e in events if e["when"] == "OTH"]
    left = " ".join(bmo) if bmo else "—"
    right_parts = []
    if amc:
        right_parts.append(" ".join(amc))
    if oth:
        right_parts.append("(" + " ".join(oth) + ")")
    right = " ".join(right_parts) if right_parts else "—"
    return f"{day_name} {mmdd}: {left} | {right}"


def main():
    days = week_dates()
    all_events = {}
    errors = []
    lines = []
    for d in days:
        try:
            events = fetch_day(d)
        except Exception as e:
            errors.append(f"{d.isoformat()}: {e}")
            events = []
        all_events[d.isoformat()] = events
        lines.append(format_day_line(d, events))

    text = "\n".join(lines)

    payload = {
        "generated_at": datetime.now(ZoneInfo("America/Los_Angeles")).isoformat(),
        "week_start": days[0].isoformat(),
        "week_end": days[-1].isoformat(),
        "min_market_cap": MIN_MARKET_CAP,
        "events_by_day": all_events,
        "earnings_text": text,
        "errors": errors,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"Wrote {OUT_PATH}")
    print(f"Week: {days[0]} to {days[-1]}")
    print(f"Errors: {len(errors)}")
    print("---")
    print(text)


if __name__ == "__main__":
    main()
