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
    
    console.log('Fetching data for ticker:', ticker);
    
    const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${alphaVantageApiKey}`;
    const balanceSheetUrl = `https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=${ticker}&apikey=${alphaVantageApiKey}`;
    const cashFlowUrl = `https://www.alphavantage.co/query?function=CASH_FLOW&symbol=${ticker}&apikey=${alphaVantageApiKey}`;
    
    const [overviewResponse, balanceSheetResponse, cashFlowResponse] = await Promise.all([
      fetch(overviewUrl),
      fetch(balanceSheetUrl),
      fetch(cashFlowUrl)
    ]);

    const [overviewData, balanceSheetData, cashFlowData] = await Promise.all([
      overviewResponse.json(),
      balanceSheetResponse.json(),
      cashFlowResponse.json()
    ]);

    console.log('Alpha Vantage data received');

    // Extract latest data
    const latestBalanceSheet = balanceSheetData.annualReports && balanceSheetData.annualReports[0] || {};
    const latestCashFlow = cashFlowData.annualReports && cashFlowData.annualReports[0] || {};

    // Calculate Net Debt
    const shortTermDebt = parseFloat(latestBalanceSheet.shortTermDebt || "0");
    const longTermDebt = parseFloat(latestBalanceSheet.longTermDebt || "0");
    const cash = parseFloat(latestBalanceSheet.cashAndCashEquivalentsAtCarryingValue || "0");
    const totalDebt = shortTermDebt + longTermDebt;
    const netDebt = totalDebt - cash;

    // Build analysis prompt
    const prompt = `Professional stock analysis for ${ticker}:

Overview Data:
- PE Ratio: ${overviewData.PERatio || 'N/A'}
- P/S Ratio: ${overviewData.PriceToSalesRatioTTM || 'N/A'}
- Revenue TTM: $${overviewData.RevenueTTM || 'N/A'}
- Gross Profit TTM: $${overviewData.GrossProfitTTM || 'N/A'}

Debt Analysis:
- Short Term Debt: $${shortTermDebt.toFixed(0)}
- Long Term Debt: $${longTermDebt.toFixed(0)}
- Total Debt: $${totalDebt.toFixed(0)}
- Cash: $${cash.toFixed(0)}
- Net Debt: $${netDebt.toFixed(0)}

Operating Cash Flow: $${latestCashFlow.operatingCashflow || 'N/A'}

Provide professional trading analysis for subscribers.`;

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
        research: claudeData.content && claudeData.content[0] && claudeData.content[0].text || 'Analysis failed',
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
