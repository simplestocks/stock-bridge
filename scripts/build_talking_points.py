#!/usr/bin/env python3
"""
Build US economic talking-points JSON for simplestocks morning note.

Sources (all free, no paywall):
- FRED API (releases/dates) -> BLS, BEA, Census, DOL, Fed releases
- Federal Reserve press JSON -> Powell speeches, FOMC statements/minutes, Beige Book
- TreasuryDirect upcoming auctions JSON -> bill/note/bond auctions

Output: <repo>/public/data/talking-points.json
Window: today + next 2 business days (US/Eastern)
"""

import json
import os
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timedelta, timezone

# ---------- config ----------

FRED_API_KEY = os.environ.get("FRED_API_KEY", "").strip()

# FRED release IDs -> (short name, importance 1-3) for Nic's watchlist
# Importance 3 = highest (market movers)
# NOTE: release 101 "FOMC Press Release" excluded from FRED — it tracks daily fed funds data,
# not meetings. FOMC meetings come from Fed press JSON instead.
FRED_RELEASES = {
    50:  ("Employment Situation (NFP / Unemployment)", 3),
    10:  ("CPI",                                       3),
    54:  ("Personal Income & Outlays (PCE)",           3),
    53:  ("GDP",                                       3),
    180: ("Initial Jobless Claims",                    2),
    194: ("ADP National Employment Report",            2),
    9:   ("Advance Retail Sales",                      3),
    95:  ("Durable Goods (M3 Survey)",                 3),
    46:  ("PPI",                                       2),
    13:  ("Industrial Production",                     2),
    192: ("JOLTS (Job Openings)",                      2),
    27:  ("Housing Starts",                            1),
    97:  ("New Home Sales",                            1),
    199: ("Case-Shiller Home Price Index",             1),
    51:  ("Trade Balance",                             1),
    229: ("Construction Spending",                     1),
}

# Hardcoded FOMC meeting schedule — Fed publishes 1-2 years in advance.
# Refresh yearly from https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
# Decision day = second day of the two-day meeting (press conference + statement).
# Minutes released 3 weeks after decision day.
FOMC_MEETINGS = [
    # 2026
    ("2026-01-28", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2026-03-18", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2026-04-29", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2026-06-17", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2026-07-29", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2026-09-16", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2026-10-28", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2026-12-09", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    # 2027
    ("2027-01-27", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2027-03-17", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2027-04-28", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2027-06-09", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2027-07-28", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2027-09-15", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2027-10-27", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
    ("2027-12-08", "FOMC Meeting Day 2 — Statement + Powell Press Conference"),
]

# Fed press release types we care about
FED_INCLUDE_TYPES = {
    "Monetary Policy",
    "Testimony",
    "Speech",
    "Press Release",
}
# Keywords inside Fed press titles to keep (filters noise like enforcement actions)
FED_INCLUDE_KEYWORDS = (
    "fomc", "powell", "chair", "minutes", "beige book",
    "rate decision", "monetary policy", "statement",
    "press conference", "testimony",
)

# Window (business days including today)
DAYS_AHEAD = 5  # today + next 4 business days (one trading week)

# Output path (relative to repo root)
OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data", "talking-points.json")

USER_AGENT = "simplestocks-morning-note/1.0 (nic@simplestocks.com)"

# ---------- helpers ----------

def http_get_json(url, timeout=20, retries=3, backoff=1.5):
    """GET JSON with retries on transient 5xx and network errors."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    last_err = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read().decode("utf-8-sig", errors="replace")
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            last_err = e
            if 500 <= e.code < 600 and attempt < retries - 1:
                time.sleep(backoff * (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(backoff * (attempt + 1))
                continue
            raise
    if last_err:
        raise last_err

def et_today():
    """Today in US/Eastern as date object."""
    # Use zoneinfo if available; else fall back to fixed -05:00 (DST aware-ish via system tz if set)
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("America/New_York")).date()
    except Exception:
        return datetime.now(timezone(timedelta(hours=-5))).date()

def business_days_window(start, n):
    """Return list of n business days starting with `start` (Mon-Fri, no US holidays check)."""
    out = []
    d = start
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d)
        d += timedelta(days=1)
    return out

def parse_mdy(s):
    """Parse '4/3/2026 11:00:00 AM' -> datetime."""
    try:
        return datetime.strptime(s, "%m/%d/%Y %I:%M:%S %p")
    except ValueError:
        try:
            return datetime.strptime(s, "%m/%d/%Y")
        except ValueError:
            return None

# ---------- fetchers ----------

def fetch_fred(window_dates):
    """Query each release individually via /fred/release/dates (singular).
    The plural /releases/dates endpoint returns data-update timestamps, not schedules."""
    if not FRED_API_KEY:
        return [], ["FRED_API_KEY not set"]
    # Query a wider 60-day window per release, then filter to display window.
    q_start = window_dates[0].isoformat()
    q_end = (window_dates[-1] + timedelta(days=60)).isoformat()
    window_set = set(window_dates)
    events = []
    errors = []
    for rid, (name, importance) in FRED_RELEASES.items():
        url = (
            "https://api.stlouisfed.org/fred/release/dates"
            f"?release_id={rid}&api_key={FRED_API_KEY}&file_type=json"
            "&include_release_dates_with_no_data=true"
            f"&realtime_start={q_start}&realtime_end={q_end}"
            "&sort_order=asc&limit=1000"
        )
        try:
            data = http_get_json(url)
        except Exception as e:
            errors.append(f"FRED release {rid} ({name}): {e}")
            continue
        dates = data.get("release_dates", [])
        # Sanity check: if a release returns >10 dates in 60 days, it's probably
        # a daily-updating series mislabeled as a release. Skip those results.
        if len(dates) > 10:
            errors.append(f"FRED release {rid} ({name}) returned {len(dates)} dates in 60d, skipping (daily series)")
            continue
        for r in dates:
            try:
                d = datetime.strptime(r["date"], "%Y-%m-%d").date()
            except Exception:
                continue
            if d not in window_set:
                continue
            events.append({
                "date": d.isoformat(),
                "time": "",  # FRED does not give time; most US releases drop at 8:30 AM ET
                "category": "Econ Release",
                "title": name,
                "source": "FRED",
                "importance": importance,
            })
    return events, errors

def fetch_fomc_static(window_dates):
    """Return FOMC meeting events from hardcoded schedule + derived minutes (3 weeks later)."""
    window_set = set(window_dates)
    events = []
    for iso, title in FOMC_MEETINGS:
        d = datetime.strptime(iso, "%Y-%m-%d").date()
        if d in window_set:
            events.append({
                "date": d.isoformat(),
                "time": "2:00 PM",
                "category": "Fed",
                "title": title,
                "source": "FOMC Calendar (static)",
                "importance": 3,
            })
        # Minutes = 3 weeks after decision day
        md = d + timedelta(days=21)
        if md in window_set:
            events.append({
                "date": md.isoformat(),
                "time": "2:00 PM",
                "category": "Fed",
                "title": f"FOMC Minutes (from {d.strftime('%b %-d')} meeting)",
                "source": "FOMC Calendar (static)",
                "importance": 3,
            })
    return events, []

def fetch_fed_press(window_dates):
    url = "https://www.federalreserve.gov/json/ne-press.json"
    try:
        data = http_get_json(url)
    except Exception as e:
        return [], [f"Fed press fetch failed: {e}"]
    events = []
    window_set = set(window_dates)
    for r in data:
        dt = parse_mdy(r.get("d", ""))
        if dt is None:
            continue
        d = dt.date()
        if d not in window_set:
            continue
        title = r.get("t", "")
        ptype = r.get("pt", "")
        # Filter: keep only items with type we care about OR title containing a keyword
        title_l = title.lower()
        type_ok = any(t.lower() in ptype.lower() for t in FED_INCLUDE_TYPES)
        kw_ok = any(k in title_l for k in FED_INCLUDE_KEYWORDS)
        if not (type_ok or kw_ok):
            continue
        # Importance heuristic
        if "fomc" in title_l or "minutes" in title_l or "powell" in title_l or "chair" in title_l:
            imp = 3
        elif "beige book" in title_l or "testimony" in title_l:
            imp = 2
        else:
            imp = 1
        events.append({
            "date": d.isoformat(),
            "time": dt.strftime("%I:%M %p").lstrip("0"),
            "category": "Fed",
            "title": title,
            "source": "Federal Reserve",
            "importance": imp,
        })
    return events, []

def fetch_treasury(window_dates):
    url = "https://www.treasurydirect.gov/TA_WS/securities/upcoming?format=json"
    try:
        data = http_get_json(url)
    except Exception as e:
        return [], [f"Treasury fetch failed: {e}"]
    events = []
    window_set = set(window_dates)
    for r in data:
        ad = r.get("auctionDate", "")
        if not ad:
            continue
        try:
            d = datetime.strptime(ad[:10], "%Y-%m-%d").date()
        except Exception:
            continue
        if d not in window_set:
            continue
        term = r.get("securityTerm", "")
        stype = r.get("securityType", "")
        time_str = r.get("closingTimeCompetitive", "")
        events.append({
            "date": d.isoformat(),
            "time": time_str,
            "category": "Treasury Auction",
            "title": f"{term} {stype} Auction",
            "source": "TreasuryDirect",
            "importance": 1,
        })
    return events, []

# ---------- main ----------

def main():
    today = et_today()
    window = business_days_window(today, DAYS_AHEAD)
    window_set = set(window)

    errors = []
    all_events = []

    for fetcher, label in (
        (fetch_fred,        "fred"),
        (fetch_fomc_static, "fomc"),
        (fetch_fed_press,   "fed_press"),
        (fetch_treasury,    "treasury"),
    ):
        ev, errs = fetcher(window)
        all_events.extend(ev)
        errors.extend(errs)

    # Dedupe by (date,title)
    seen = set()
    deduped = []
    for e in sorted(all_events, key=lambda x: (x["date"], -x["importance"], x["title"])):
        key = (e["date"], e["title"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(e)

    # Build plaintext lines for the Talking Points textarea
    lines = []
    day_label_map = {
        window[0].isoformat(): "TODAY",
    }
    if len(window) > 1:
        day_label_map[window[1].isoformat()] = "TOMORROW"
    for i, d in enumerate(window[2:], start=2):
        day_label_map[d.isoformat()] = d.strftime("%a %b %-d").upper()

    current_day = None
    for e in deduped:
        if e["date"] != current_day:
            current_day = e["date"]
            header_date = datetime.strptime(current_day, "%Y-%m-%d").strftime("%a %b %-d")
            label = day_label_map.get(current_day, header_date)
            lines.append(f"— {label} ({header_date}) —")
        stars = "★" * e["importance"]
        t = f" {e['time']} ET" if e["time"] else ""
        lines.append(f"{stars} {e['title']}{t}")

    if not lines:
        lines = ["(no high-impact US events in window)"]

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "window": [d.isoformat() for d in window],
        "events": deduped,
        "talking_points_text": "\n".join(lines),
        "errors": errors,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"Wrote {OUT_PATH}")
    print(f"Events: {len(deduped)}  Errors: {len(errors)}")
    if errors:
        for e in errors:
            print("  !", e)
    print("--- talking_points_text ---")
    print(payload["talking_points_text"])

if __name__ == "__main__":
    main()
