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

    // Get financial data from Polygon API
    const polygonApiKey = process.env.POLYGON_API_KEY;
    let financialData = {};
    let dataSource = "Claude knowledge base";
    
    try {
      // Get company details and financials from Polygon
      const [companyResponse, financialsResponse] = await Promise.all([
        fetch(`https://api.polygon.io/v3/reference/tickers/${ticker}?apikey=${polygonApiKey}`),
        fetch(`https://api.polygon.io/vX/reference/financials?ticker=${ticker}&limit=4&apikey=${polygonApiKey}`)
      ]);

      if (companyResponse.ok && financialsResponse.ok) {
        const companyData = await companyResponse.json();
        const financialsData = await financialsResponse.json();
        
        financialData = {
          company: companyData.results,
          financials: financialsData.results
        };
        dataSource = "Polygon.io financial data";
      }
    } catch (error) {
      console.log('Polygon API fetch failed:', error.message);
      // Continue with Claude knowledge only
    }

    // Call Claude API
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
          content: `You are my professional trading analyst. I'm providing you with current financial data for ${ticker} from Polygon.io.

DATA SOURCE: ${dataSource}
FINANCIAL DATA: ${JSON.stringify(financialData, null, 2)}

Analyze this data and provide a comprehensive report in this EXACT format:

📍 [Company Name]: Provide a 2-sentence description of the company and its industry.

## Financial Data Table
Create a clean table with these columns: Metric | TTM | Most Recent Quarter | Prior Quarter

**Business Health:**
- Sales Growth Rate (%)
- Actual Sales ($)
- Profit Growth Rate (%)  
- Profit ($)
- Gross Margin %
- Operating Margin %

**Valuation Metrics:**
- Price to Earnings (P/E)
- Price to Sales (P/S)

**Debt Analysis:**
- Total Debt ($)
- Net Debt ($)
- Cash from Operations ($)

**Important Dates:**
- Next Ex-Dividend Date
- Next Earnings Report

## Technical Analysis
Provide support/resistance levels and technical patterns.

## Wall Street Commentary
Include analyst upgrades, downgrades, and price targets if available in the data.

## AI Trade Suggestion
Provide entry points, stop loss, and price targets for paper trading.

**Data Source:** ${dataSource}

**DISCLAIMER:** This analysis is for educational and paper trading purposes only. Not financial advice. Always conduct your own research and consult qualified financial advisors before making investment decisions. Past performance does not guarantee future results.`
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
        research: data.content?.[0]?.text || data.text || JSON.stringify(data),
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
