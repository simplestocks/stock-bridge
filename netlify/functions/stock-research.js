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
    
    // Get all required data from Alpha Vantage
    const [overviewResponse, balanceSheetResponse, cashFlowResponse] = await Promise.all([
      fetch(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${alphaVantageApiKey}`),
      fetch(`https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=${ticker}&apikey=${alphaVantageApiKey}`),
      fetch(`https://www.alphavantage.co/query?function=CASH_FLOW&symbol=${ticker}&apikey=${alphaVantageApiKey}`)
    ]);

    const [overviewData, balanceSheetData, cashFlowData] = await Promise.all([
      overviewResponse.json(),
      balanceSheetResponse.json(),
      cashFlowResponse.json()
    ]);

    console.log('Alpha Vantage responses received');

    // Extract latest balance sheet data
    const latestBalanceSheet = balanceSheetData.annualReports?.[0] || {};
    const latestCashFlow = cashFlowData.annualReports?.[0] || {};

    // Calculate Net Debt
    const shortTermDebt = parseFloat(latestBalanceSheet.shortTermDebt || 0);
    const longTermDebt = parseFloat(latestBalanceSheet.longTermDebt || 0);
    const cash = parseFloat(latestBalanceSheet.cashAndCashEquivalentsAtCarryingValue || 0);
    const totalDebt = shortTermDebt + longTermDebt;
    const netDebt = totalDebt - cash;

    // Build comprehensive data object
    const stockData = {
      overview: overviewData,
      balanceSheet: latestBalanceSheet,
      cashFlow: latestCashFlow,
      calculated: {
        totalDebt: totalDebt,
        netDebt: netDebt,
        shortTermDebt: shortTermDebt,
        longTermDebt: longTermDebt,
        cash: cash
      }
    };

    const prompt = `You are a professional stock analyst. Create a comprehensive trading analysis for ${ticker} using this Alpha Vantage data.

REQUIREMENTS:
1. Use ONLY the actual field names and values from the data provided
2. Calculate and show Net Debt = Total Debt - Cash with actual numbers
3. Format the response as professional trading analysis matching the style of the stock research design
4. Include all key metrics: PE, P/S, margins, cash flow, debt analysis
5. Provide clear buy/sell/hold recommendation with rationale

Data: ${JSON.stringify(stockData, null, 2)}

Format the analysis professionally for trading subscribers.`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
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
          grossProfit: overviewData.GrossProfitTTM
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
