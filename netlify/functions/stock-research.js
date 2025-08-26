// netlify/functions/stock-research.js
exports.handler = async (event, context) => {
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

Use ONLY the actual field names and values provided in the financial data above. Do not make up any numbers.

Analyze this data and provide a comprehensive report in this EXACT format:

📍 [Company Name]: Provide a 2-sentence description of the company and its industry.

## Financial Data Table
Format as a proper markdown table using ONLY available data fields:

| Metric | TTM | Most Recent Quarter | Prior Quarter |
|--------|-----|---------------------|---------------|
| Revenue ($B) | [revenues field] | [revenues field] | [revenues field] |
| Net Income ($B) | [net_income_loss field] | [net_income_loss field] | [net_income_loss field] |
| Gross Profit ($B) | [gross_profit field] | [gross_profit field] | [gross_profit field] |
| Operating Income ($B) | [operating_income_loss field] | [operating_income_loss field] | [operating_income_loss field] |

**Valuation Metrics (from available data):**
- Price to Earnings (P/E): [calculate from market cap and net_income_loss if available]
- Price to Sales (P/S): [calculate from market cap and revenues if available]

**Debt Analysis (use exact field names from balance sheet):**
- Total Debt ($B): [debt field from balance_sheet]
- Cash & Equivalents ($B): [cash_and_cash_equivalents or similar field]
- Net Debt ($B): [Total Debt minus Cash, show calculation: "debt - cash_and_cash_equivalents = $X"]
- Cash from Operations ($B): [net_cash_flow_from_operating_activities from cash_flow_statement]

**Important Dates:**
- Next Ex-Dividend Date: "Data not available in provided dataset"
- Next Earnings Report: "Data not available in provided dataset"

## Technical Analysis
Provide specific support and resistance levels with actual price points:
- Current Price: $[from company data if available]
- Key Support Levels: [based on available price data]
- Key Resistance Levels: [based on available price data]
- Trend Analysis: [based on available data]

## Wall Street Commentary
"Analyst data not included in current dataset"

## AI Trade Suggestion
Based on available financial metrics:
- Entry Strategy: [based on financial health from actual data]
- Risk Assessment: [based on debt levels and cash flow from actual data]
- Price Targets: [based on valuation metrics from actual data]

**CRITICAL: Use only field names that exist in the provided JSON data. If a field doesn't exist, state "Not available in dataset"**

**Data Source:** ${dataSource}

**DISCLAIMER:** This analysis is for educational and paper trading purposes only. Not financial advice. Always conduct your own research and consult qualified financial advisors before making investment decisions. Past performance does not guarantee future results.`

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
