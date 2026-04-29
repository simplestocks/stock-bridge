const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const { title, html } = JSON.parse(event.body);

    const text = html
      .replace(/<[^>]+>/g, "\n")
      .replace(/\n+/g, "\n")
      .trim();

    const res = await fetch(`${process.env.SQ_BASE}/api/content/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": process.env.SQ_AUTH
      },
      body: JSON.stringify({
        collectionId: process.env.SQ_COLLECTION,
        title,
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
        },
        draft: true
      })
    });

    const data = await res.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: err.toString()
    };
  }
};
