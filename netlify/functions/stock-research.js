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
    let financialData = null;
    let hasRealData = false;
    
    try {
      // Fixed API endpoints
      const companyUrl = `https://api.polygon.io/v3/reference/tickers/${ticker}?apikey=${polygonApiKey}`;
      const financialsUrl = `https://api.polygon.io/v1/reference/financials?ticker=${ticker}&limit=4&timeframe=annual&apikey=${polygonApiKey}`;
      
      console.log('Calling Polygon APIs for ticker:', ticker);
      
      const [companyResponse, financialsResponse] = await Promise.all([
        fetch(companyUrl),
        fetch(financialsUrl)
      ]);

      console.log('API responses - Company:', companyResponse.status, 'Financials:', financialsResponse.status);

      if (companyResponse.ok && financialsResponse.ok) {
        const companyData = await companyResponse.json();
        const financialsDataResult = await financialsResponse.json();
        
        console.log('Financials structure:', JSON.stringify(financialsDataResult, null, 2));
        
        if (companyData.results && financialsDataResult.results && financialsDataResult.results.length > 0) {
          financialData = {
            company: companyData.results,
            financials: financialsDataResult.results
          };
          hasRealData = true;
        }
      }
    } catch (error) {
      console.log('Polygon API error:', error.message);
    }

    // Build prompt based on what data we have
    let prompt;
    if (hasRealData) {
      prompt = `You are a professional trading analyst. Analyze ${ticker} using this Polygon.io financial data.

CRITICAL: Use ONLY the field names that actually exist in this data structure. Do not assume standard accounting terms.

Raw Polygon data: ${JSON.stringify(financialData, null, 2)}

Analyze:
1. Company overview from the ticker data
2. Financial health using available balance sheet fields 
3. If debt and cash fields exist, calculate net debt position
4. Revenue trends if income statement data available
5. Key financial ratios using only available fields
6. Trading recommendation based on the data

Be specific about which fields you're using and show calculations with actual numbers.`;
    } else {
      prompt = `Analyze ${ticker} as a trading analyst. Since live financial data is unavailable, provide analysis based on general knowledge of this company including:

1. Business model and sector analysis
2. Recent performance trends (if known)
3. Key risks and opportunities
4. Technical considerations for trading
5. Your trading recommendation

Note: This analysis uses general market knowledge, not real-time financial data.`;
    }

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

    if (!response.ok) {
      throw new Error(`Claude API error: ${data.error?.message || 'Unknown error'}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST'
      },
      body: JSON.stringify({
        research: data.content?.[0]?.text || 'Analysis failed',
        ticker: ticker,
        dataSource: hasRealData ? 'Polygon.io live data' : 'General knowledge'
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
        error: 'Analysis failed', 
        details: error.message 
      })
    };
  }
};
