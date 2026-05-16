# SimpleStocks Member Feed Recovery

Use this when the Squarespace locked member feed stops loading.

## Panic Links

- Admin home: https://jazzy-starlight-0a9a95.netlify.app/admin
- Feed Doctor: https://jazzy-starlight-0a9a95.netlify.app/admin/feed-doctor.html
- Post Writer: https://jazzy-starlight-0a9a95.netlify.app/admin/writer.html
- GitHub repo: https://github.com/simplestocks/stock-bridge
- Netlify status: https://netlify.statuspage.io/
- GitHub status: https://www.githubstatus.com/

## What This System Does

Squarespace remains the member door. Members do not type a Netlify password or one-time code. The Squarespace Code Block loads static CSS and widget JS from Netlify. The widget asks Netlify for a short-lived signed ticket, then uses that ticket to fetch posts from `member-feed`. Posts live in Netlify Blobs, not public `posts.json` or `feed.xml`.

## Files To Check

- `public/squarespace-posts/widget.js`
- `public/squarespace-posts/styles.css`
- `public/squarespace-posts/feed-doctor.html`
- `netlify/functions/member-feed-auth.js`
- `netlify/functions/member-feed-ticket.js`
- `netlify/functions/member-feed.js`
- `netlify/functions/member-post-store.js`
- `netlify/functions/squarespace-posts-save.js`
- `netlify/functions/member-feed-health.js`

## Required Checks

- `/.netlify/functions/member-feed` without a ticket returns `403`.
- `/.netlify/functions/member-feed-ticket` returns a short-lived token from the locked Squarespace page or admin page.
- `/.netlify/functions/member-feed?token=...` returns posts.
- `/squarespace-posts/posts.json` returns `404`.
- `/squarespace-posts/feed.xml` returns `404`.

## Copy/Paste Repair Prompt

Project: Squarespace member feed / Stock Bridge. Use `C:\FUCKYOUCHATGPT\stock-bridge-push-work` and repo `https://github.com/simplestocks/stock-bridge`. Live site is `https://jazzy-starlight-0a9a95.netlify.app`. The Squarespace locked member page loads `https://jazzy-starlight-0a9a95.netlify.app/squarespace-posts/styles.css` and `widget.js`. Posts are stored in Netlify Blobs by `netlify/functions/member-post-store.js`. The browser must not read public `posts.json` or `feed.xml`. The widget must call `/.netlify/functions/member-feed-ticket`, then call `/.netlify/functions/member-feed` with the short-lived signed token. Members must not enter any extra password beyond Squarespace. Start by opening `/admin/feed-doctor.html` and checking `member-feed-auth.js`, `member-feed-ticket.js`, `member-feed.js`, `member-post-store.js`, `squarespace-posts-save.js`, and `public/squarespace-posts/widget.js`. Fix the smallest broken piece, then verify: no-token feed returns `403`, ticket endpoint works from allowed origin, tokenized feed returns `200`, old public `posts.json`/`feed.xml` return `404`.
