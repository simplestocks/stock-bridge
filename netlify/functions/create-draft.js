const https = require("https");
const { URL } = require("url");

const COLLECTIONS = {
  "morning-note": "635dd55df0e2db5da59ef527",
  "trade-alert": "63e597a94c7f135688639956"
};
const DEFAULT_COLLECTION = COLLECTIONS["morning-note"];

function request(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: opts.method || "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        ...opts.headers
      }
    };
    const req = https.request(reqOpts, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: data
      }));
    });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function extractCookiePairs(setCookies) {
  const arr = Array.isArray(setCookies) ? setCookies : [setCookies];
  return arr.map(sc => sc.split(";")[0]);
}

function mergeCookies(existingPairs, newSetCookies) {
  const map = {};
  for (const pair of existingPairs) {
    const [k] = pair.split("=");
    map[k] = pair;
  }
  const newPairs = extractCookiePairs(newSetCookies);
  for (const pair of newPairs) {
    const [k] = pair.split("=");
    map[k] = pair;
  }
  return Object.values(map);
}

function loginFailure(step, res, message) {
  const err = new Error(message);
  err.isLoginFailure = true;
  err.step = step;
  err.statusCode = res ? res.status : null;
  err.responseText = res && res.body ? res.body.substring(0, 300) : "";
  return err;
}

async function squarespaceLogin(siteUrl, email, password) {
  const initRes = await request(`${siteUrl}/`, { method: "GET" });
  if (initRes.status >= 400) {
    throw loginFailure("GET site root", initRes, `GET / failed: ${initRes.status}`);
  }

  let cookiePairs = [];
  if (initRes.headers["set-cookie"]) {
    cookiePairs = extractCookiePairs(initRes.headers["set-cookie"]);
  }

  const initCookieStr = cookiePairs.join("; ");
  const initCrumbMatch = initCookieStr.match(/crumb=([^;]+)/);
  const initCrumb = initCrumbMatch ? initCrumbMatch[1] : "";

  const formBody = `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const loginRes = await request(`${siteUrl}/api/auth/Login?crumb=${initCrumb}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(formBody).toString(),
      "Cookie": initCookieStr,
      "Origin": siteUrl,
      "Referer": siteUrl
    },
    body: formBody
  });

  if (loginRes.status !== 200) {
    throw loginFailure("POST /api/auth/Login", loginRes, `Login failed: ${loginRes.status}`);
  }

  if (loginRes.headers["set-cookie"]) {
    cookiePairs = mergeCookies(cookiePairs, loginRes.headers["set-cookie"]);
  }

  const loginJson = JSON.parse(loginRes.body);
  const tokenLoginUrl = loginJson.targetWebsite && loginJson.targetWebsite.loginUrl;

  if (!tokenLoginUrl) {
    const finalCookieStr = cookiePairs.join("; ");
    const finalCrumbMatch = finalCookieStr.match(/crumb=([^;]+)/);
    if (finalCrumbMatch) {
      return { crumb: finalCrumbMatch[1], cookieHeader: finalCookieStr };
    }
    throw loginFailure("read targetWebsite.loginUrl", null, "No targetWebsite.loginUrl and no crumb found");
  }

  const sep = tokenLoginUrl.includes("?") ? "&" : "?";
  const tokenUrl = `${tokenLoginUrl}${sep}email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const tokenRes = await request(tokenUrl, {
    method: "GET",
    headers: { "Cookie": cookiePairs.join("; ") }
  });

  if (tokenRes.status < 200 || tokenRes.status >= 400) {
    throw loginFailure("GET targetWebsite.loginUrl", tokenRes, `Token exchange failed: ${tokenRes.status}`);
  }

  if (tokenRes.headers["set-cookie"]) {
    cookiePairs = mergeCookies(cookiePairs, tokenRes.headers["set-cookie"]);
  }

  const finalCookieStr = cookiePairs.join("; ");
  const crumbMatch = finalCookieStr.match(/crumb=([^;]+)/);
  if (!crumbMatch) {
    throw loginFailure("read final crumb", null, "No crumb after login");
  }

  return { crumb: crumbMatch[1], cookieHeader: finalCookieStr };
}

exports.handler = async (event) => {
  try {
    const { title, html } = JSON.parse(event.body);
    const siteUrl = (process.env.SQUARESPACE_SITE_URL || "").trim().replace(/\/+$/, "");
    const email = (process.env.SQUARESPACE_EMAIL || "").trim();
    const password = (process.env.SQUARESPACE_PASSWORD || "").trim();

    if (!siteUrl || !email || !password) {
      throw new Error("Missing env vars: SQUARESPACE_SITE_URL, SQUARESPACE_EMAIL, SQUARESPACE_PASSWORD");
    }

    const text = html
      .replace(/<[^>]+>/g, "\n")
      .replace(/\n+/g, "\n")
      .trim();

    const auth = await squarespaceLogin(siteUrl, email, password);
    const payload = JSON.stringify({
      title: title,
      collectionId: DEFAULT_COLLECTION,
      workflowState: 4,
      body: {
        raw: false,
        layout: {
          rows: [{
            columns: [{
              span: 12,
              blocks: [{
                type: 1,
                value: {
                  text,
                  format: "PLAIN_TEXT"
                }
              }]
            }]
          }]
        }
      }
    });

    const res = await request(`${siteUrl}/api/content-items?crumb=${auth.crumb}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload).toString(),
        "Cookie": auth.cookieHeader
      },
      body: payload
    });

    if (res.status !== 200) {
      throw new Error(`Create draft failed: ${res.status} ${res.body.substring(0, 200)}`);
    }

    return {
      statusCode: res.status,
      body: res.body
    };

  } catch (err) {
    if (err.isLoginFailure) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: err.step,
          statusCode: err.statusCode,
          responseText: err.responseText,
          env: {
            SQUARESPACE_SITE_URL: Boolean(process.env.SQUARESPACE_SITE_URL),
            SQUARESPACE_EMAIL: Boolean(process.env.SQUARESPACE_EMAIL),
            SQUARESPACE_PASSWORD: Boolean(process.env.SQUARESPACE_PASSWORD)
          }
        })
      };
    }

    return {
      statusCode: 500,
      body: err.toString()
    };
  }
};
