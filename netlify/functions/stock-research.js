exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const ticker = body.ticker;
    
    if (!ticker) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Ticker symbol required' })
      };
    }

    const polygonApiKey = process.env.POLYGON_API_KEY;
    let financialData = {};
    let dataSource = "Claude knowledge base";
    
    try {
      const companyUrl = 'https://api.polygon.io/v3/reference/tickers/' + ticker + '?apikey=' + polygonApiKey;
      const financialsUrl = 'https://api.polygon.io/vX/reference/financials?ticker=' + ticker + '&limit=4&apikey=' + polygonApiKey;
      
      const companyResponse = await fetch(companyUrl);
      const financialsResponse = await fetch(financialsUrl);

      if (companyResponse.ok && financialsResponse.ok) {
        const companyData = await companyResponse.json();
        const financialsDataResult = await financialsResponse.json();
        
        financialData = {
          company: companyData.results,
          financials: financialsDataResult.results
        };
        dataSource = "Polygon.io financial data";
      }
    } catch (error) {
      console.log('Polygon API failed:', error.message);
    }

    const prompt = 'You are my professional trading analyst. Analyze ' + ticker + ' using this data: ' + JSON.stringify(financialData, null, 2) + '. Provide a comprehensive financial analysis with the exact debt figures from the balance sheet data. Use only the actual field names provided. Data source: ' + dataSource;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST'
      },
      body: JSON.stringify({
        research: data.content && data.content[0] && data.content[0].text ? data.content[0].text : 'Analysis failed',
        ticker: ticker
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST'
      },
      body: JSON.stringify({ 
        error: 'Research failed', 
        details: error.message 
      })
    };
  }
};
