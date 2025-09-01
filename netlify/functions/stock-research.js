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

    // Build API URLs - only 3 calls
    const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${alphaVantageApiKey}`;
    const balanceSheetUrl = `https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=${ticker}&apikey=${alphaVantageApiKey}`;
    const cashFlowUrl = `https://www.alphavantage.co/query?function=CASH_FLOW&symbol=${ticker}&apikey=${alphaVantageApiKey}`;

    // Make all API calls
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

    console.log('All Alpha Vantage responses received');

    // Process financial data - REMOVED NET DEBT CALCULATION
    const latestCashFlow = cashFlowData.annualReports?.[0] || {};

    // Calculate additional metrics
    const currentRevenue = parseFloat(overviewData.RevenueTTM || 0);
    const grossProfit = parseFloat(overviewData.GrossProfitTTM || 0);
    const grossMargin = currentRevenue > 0 ? ((grossProfit / currentRevenue) * 100).toFixed(1) : 'N/A';
    
    // Get revenue growth from quarterly data
    const quarterlyRevenueGrowth = overviewData.QuarterlyRevenueGrowthYOY ? 
      (parseFloat(overviewData.QuarterlyRevenueGrowthYOY) * 100).toFixed(1) : 'N/A';

    // Enhanced prompt with all valuation data - REMOVED NET DEBT REFERENCES
    const prompt = `Professional stock analysis for ${ticker}:

VALUATION METRICS:
- PE Ratio: ${overviewData.PERatio || 'N/A'} (Trailing: ${overviewData.TrailingPE || 'N/A'})
- PEG Ratio: ${overviewData.PEGRatio || 'N/A'}
- P/S Ratio: ${overviewData.PriceToSalesRatioTTM || 'N/A'}
- P/B Ratio: ${overviewData.PriceToBookRatio || 'N/A'}
- EV/Revenue: ${overviewData.EVToRevenue || 'N/A'}
- EV/EBITDA: ${overviewData.EVToEBITDA || 'N/A'}

FUNDAMENTAL DATA:
- Revenue TTM: $${overviewData.RevenueTTM || 'N/A'}
- Gross Profit TTM: $${overviewData.GrossProfitTTM || 'N/A'}
- Gross Margin: ${grossMargin}%
- Quarterly Revenue Growth YoY: ${quarterlyRevenueGrowth}%
- Market Cap: $${overviewData.MarketCapitalization || 'N/A'}

RELATIVE VALUATION:
- Beta: ${overviewData.Beta || 'N/A'}
- 52W High/Low: $${overviewData['52WeekHigh'] || 'N/A'} / $${overviewData['52WeekLow'] || 'N/A'}
- 50-Day MA: $${overviewData['50DayMovingAverage'] || 'N/A'}
- 200-Day MA: $${overviewData['200DayMovingAverage'] || 'N/A'}

ANALYST CONSENSUS:
- Target Price: $${overviewData.AnalystTargetPrice || 'N/A'}
- Strong Buy: ${overviewData.AnalystRatingStrongBuy || '0'}, Buy: ${overviewData.AnalystRatingBuy || '0'}
- Hold: ${overviewData.AnalystRatingHold || '0'}, Sell: ${overviewData.AnalystRatingSell || '0'}

Operating Cash Flow: $${latestCashFlow.operatingCashflow || 'N/A'}

Provide professional trading analysis for subscribers with comprehensive valuation insights.`;

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
          trailingPE: overviewData.TrailingPE,
          // REMOVED: forwardPE (not available)
          psRatio: overviewData.PriceToSalesRatioTTM,
          pegRatio: overviewData.PEGRatio,
          priceToBook: overviewData.PriceToBookRatio,
          // REMOVED: netDebt (wrong calculation)
          operatingCashFlow: latestCashFlow.operatingCashflow,
          revenue: overviewData.RevenueTTM,
          grossProfit: overviewData.GrossProfitTTM,
          grossMargin: grossMargin,
          revenueGrowth: quarterlyRevenueGrowth,
          // Relative valuation
          beta: overviewData.Beta,
          weekHigh52: overviewData['52WeekHigh'],
          weekLow52: overviewData['52WeekLow'],
          movingAverage50: overviewData['50DayMovingAverage'],
          movingAverage200: overviewData['200DayMovingAverage'],
          // Analyst metrics
          analystTargetPrice: overviewData.AnalystTargetPrice,
          analystRatingStrongBuy: overviewData.AnalystRatingStrongBuy,
          analystRatingBuy: overviewData.AnalystRatingBuy,
          analystRatingHold: overviewData.AnalystRatingHold,
          analystRatingSell: overviewData.AnalystRatingSell,
          analystRatingStrongSell: overviewData.AnalystRatingStrongSell
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
