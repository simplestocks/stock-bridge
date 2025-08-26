// netlify/functions/stock-research.js
export const handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { ticker } = JSON.parse(event.body);
    
    if (!ticker) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Ticker symbol required' })
      };
    }

    // First, get financial data from Yahoo Finance
    let financialData = {};
    let dataSource = "Claude knowledge base";
    
    try {
      const yahooResponse = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (yahooResponse.ok) {
        const yahooData = await yahooResponse.json();
        if (yahooData.chart?.result?.[0]) {
          financialData = yahooData.chart.result[0];
          dataSource = "Yahoo Finance + Claude analysis";
        }
      }
    } catch (error) {
      console.log('Yahoo Finance fetch failed:', error.message);
      // Continue with Claude knowledge only
    }

    // Call Claude API with the financial data
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY, // Your API key goes in Netlify env vars
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are my professional trading analyst. I'm requesting analysis for ${ticker}.

DATA SOURCE: ${dataSource}
${Object.keys(financialData).length > 0 ? `FINANCIAL DATA: ${JSON.stringify(financialData, null, 2)}` : 'Using your knowledge base for analysis.'}

Provide a comprehensive report in this EXACT format:

📍 [Company Name]: Provide a 2-sentence description of the company and its industry.

## Financial Data Table
Create a table with these columns: Metric | TTM | Most Recent Quarter | Prior Quarter

**Business Health:**
- Sales Growth Rate
- Actual Sales ($)
- Comparable Sales (if applicable)
- Profit Growth (Earnings) Rate  
- Profit ($)
- Gross Margin %
- Gross Margin ($)
- Operating Margin %
- Operating Margin ($)

**Valuation Metrics:**
- Price to Earnings (P/E)
- Price to Sales (P/S)

*Note: P/E is used for mature non-growth companies, P/S for growth companies*

**Debt Analysis:**
- Total Debt
- Net Debt  
- Cash from Operations

**Important Dates:**
- Next Ex-Dividend Date
- Next Earnings Report

## Technical Analysis
Provide chart patterns, support/resistance levels, and technical commentary.

## Wall Street Commentary
Include any analyst upgrades, downgrades, price targets, or expert opinions.

## AI Trade Suggestion
Provide a paper trading suggestion with entry points, stop loss, and targets.

**Data Source:** ${dataSource}

**DISCLAIMER:** This analysis is for educational and paper trading purposes only. Not financial advice. All data is historical and may not reflect current market conditions. Always conduct your own research and consult qualified financial advisors before making investment decisions. Past performance does not guarantee future results.`
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
        research: data.content[0].text,
        ticker: ticker
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    console.error('Error details:', error.message);
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
