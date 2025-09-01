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

    const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY;
    console.log('Starting analysis for ticker:', ticker);

    // Build all API URLs
    const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${alphaVantageApiKey}`;
    const balanceSheetUrl = `https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=${ticker}&apikey=${alphaVantageApiKey}`;
    const cashFlowUrl = `https://www.alphavantage.co/query?function=CASH_FLOW&symbol=${ticker}&apikey=${alphaVantageApiKey}`;
    const rsiUrl = `https://www.alphavantage.co/query?function=RSI&symbol=${ticker}&interval=daily&time_period=14&series_type=close&apikey=${alphaVantageApiKey}`;
    const stochUrl = `https://www.alphavantage.co/query?function=STOCH&symbol=${ticker}&interval=daily&apikey=${alphaVantageApiKey}`;
    const adxUrl = `https://www.alphavantage.co/query?function=ADX&symbol=${ticker}&interval=daily&time_period=14&apikey=${alphaVantageApiKey}`;

    // Make all API calls
    const [overviewResponse, balanceSheetResponse, cashFlowResponse, rsiResponse, stochResponse, adxResponse] = await Promise.all([
      fetch(overviewUrl),
      fetch(balanceSheetUrl),
      fetch(cashFlowUrl),
      fetch(rsiUrl),
      fetch(stochUrl),
      fetch(adxUrl)
    ]);

    const [overviewData, balanceSheetData, cashFlowData, rsiData, stochData, adxData] = await Promise.all([
      overviewResponse.json(),
      balanceSheetResponse.json(),
      cashFlowResponse.json(),
      rsiResponse.json(),
      stochResponse.json(),
      adxResponse.json()
    ]);

    console.log('All Alpha Vantage responses received');

    // Process financial data
    const latestBalanceSheet = balanceSheetData.annualReports?.[0] || {};
    const latestCashFlow = cashFlowData.annualReports?.[0] || {};

    const shortTermDebt = parseFloat(latestBalanceSheet.shortTermDebt || "0");
    const longTermDebt = parseFloat(latestBalanceSheet.longTermDebt || "0");
    const cash = parseFloat(latestBalanceSheet.cashAndCashEquivalentsAtCarryingValue || "0");
    const totalDebt = shortTermDebt + longTermDebt;
    const netDebt = totalDebt - cash;

    // Get latest technical indicator values
    const getLatestValue = (data, key) => {
      if (!data[key]) return 'N/A';
      const dates = Object.keys(data[key]);
      if (dates.length === 0) return 'N/A';
      const latestDate = dates[0];
      const value = data[key][latestDate];
      return Object.values(value)[0] || 'N/A';
    };

    const rsiValue = getLatestValue(rsiData, 'Technical Analysis: RSI');
    const stochK = getLatestValue(stochData, 'Technical Analysis: STOCH');
    const adxValue = getLatestValue(adxData, 'Technical Analysis: ADX');

    // Enhanced prompt with technical data
    const prompt = `Professional stock analysis for ${ticker}:

FUNDAMENTAL DATA:
- PE Ratio: ${overviewData.PERatio || 'N/A'}
- P/S Ratio: ${overviewData.PriceToSalesRatioTTM || 'N/A'}
- Revenue TTM: $${overviewData.RevenueTTM || 'N/A'}
- Gross Profit TTM: $${overviewData.GrossProfitTTM || 'N/A'}

DEBT ANALYSIS:
- Short Term Debt: $${shortTermDebt.toFixed(0)}
- Long Term Debt: $${longTermDebt.toFixed(0)}
- Total Debt: $${totalDebt.toFixed(0)}
- Cash: $${cash.toFixed(0)}
- Net Debt: $${netDebt.toFixed(0)}

TECHNICAL INDICATORS:
- RSI (14): ${rsiValue}
- Stochastic %K: ${stochK}
- ADX: ${adxValue}

Operating Cash Flow: $${latestCashFlow.operatingCashflow || 'N/A'}

Provide professional trading analysis for subscribers with both fundamental and technical insights.`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    const claudeData = await claudeResponse.json();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST'
      },
      body: JSON.stringify({
        research: claudeData.content?.[0]?.text || 'Analysis failed',
        ticker: ticker,
        rawData: {
          peRatio: overviewData.PERatio,
          psRatio: overviewData.PriceToSalesRatioTTM,
          netDebt: netDebt,
          operatingCashFlow: latestCashFlow.operatingCashflow,
          revenue: overviewData.RevenueTTM,
          grossProfit: overviewData.GrossProfitTTM,
          // Technical indicators
          rsi: rsiValue,
          stochastic: stochK,
          adx: adxValue
        }
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
