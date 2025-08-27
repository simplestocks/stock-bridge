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

    const alphaVantageApiKey = "SXPYQMC37XZJTWM9";
    
    // Get Alpha Vantage OVERVIEW data
    const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${alphaVantageApiKey}`;
    
    console.log('Calling Alpha Vantage OVERVIEW for ticker:', ticker);
    
    const response = await fetch(overviewUrl);
    const data = await response.json();
    
    console.log('Alpha Vantage OVERVIEW response:', JSON.stringify(data, null, 2));
    
    // Check if we got the key fields you need
    const hasRequiredFields = {
      PERatio: data.PERatio ? 'YES' : 'NO',
      PriceToSalesRatioTTM: data.PriceToSalesRatioTTM ? 'YES' : 'NO', 
      TotalDebt: data.TotalDebt ? 'YES' : 'NO',
      OperatingCashflowTTM: data.OperatingCashflowTTM ? 'YES' : 'NO',
      RevenueTTM: data.RevenueTTM ? 'YES' : 'NO',
      GrossProfitTTM: data.GrossProfitTTM ? 'YES' : 'NO'
    };
    
    console.log('Required fields check:', hasRequiredFields);

    const analysisResult = `ALPHA VANTAGE OVERVIEW TEST FOR ${ticker}

FIELD AVAILABILITY CHECK:
- PE Ratio: ${hasRequiredFields.PERatio} ${data.PERatio || 'N/A'}
- Price to Sales Ratio: ${hasRequiredFields.PriceToSalesRatioTTM} ${data.PriceToSalesRatioTTM || 'N/A'}
- Total Debt: ${hasRequiredFields.TotalDebt} ${data.TotalDebt || 'N/A'}
- Operating Cash Flow: ${hasRequiredFields.OperatingCashflowTTM} ${data.OperatingCashflowTTM || 'N/A'}
- Revenue TTM: ${hasRequiredFields.RevenueTTM} ${data.RevenueTTM || 'N/A'}
- Gross Profit TTM: ${hasRequiredFields.GrossProfitTTM} ${data.GrossProfitTTM || 'N/A'}

SAMPLE OF OTHER AVAILABLE FIELDS:
${Object.keys(data).slice(0, 20).map(key => `- ${key}: ${data[key]}`).join('\n')}

TOTAL FIELDS AVAILABLE: ${Object.keys(data).length}

${Object.keys(data).length > 0 ? 'SUCCESS: Alpha Vantage OVERVIEW is working!' : 'ERROR: No data returned'}`;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST'
      },
      body: JSON.stringify({
        research: analysisResult,
        ticker: ticker,
        rawData: data
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
        error: 'Test failed', 
        details: error.message 
      })
    };
  }
};
