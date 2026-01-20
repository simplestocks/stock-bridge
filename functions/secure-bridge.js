const https = require('https');

exports.handler = async function(event, context) {
    // 1. SECURITY: Your Key lives here (Server-side), invisible to users.
    const API_KEY = process.env.ALPHA_VANTAGE_KEY || "C9E1N388LHHS9E5O";
    
    const symbol = event.queryStringParameters.symbol;
    const mode = event.queryStringParameters.mode;

    if (!symbol || !mode) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing parameters" }) };
    }

    // HELPER: Simple wrapper to fetch data without installing external libraries
    const fetchData = (url) => {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } 
                    catch (e) { resolve({}); }
                });
            }).on('error', (err) => reject(err));
        });
    };

    try {
        let responseData = {};

        // MODE 1: FUNDAMENTALS
        if (mode === 'fundamentals') {
            const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${API_KEY}`;
            responseData = await fetchData(url);
        } 
        
        // MODE 2: TECHNICALS (Combines Price, RSI, and SMA calls)
        else if (mode === 'technicals') {
            const urlPrice = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
            const urlRSI = `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${API_KEY}`;
            const urlSMA = `https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=200&series_type=close&apikey=${API_KEY}`;

            // Run all 3 fetches at the same time for speed
            const [priceData, rsiData, smaData] = await Promise.all([
                fetchData(urlPrice),
                fetchData(urlRSI),
                fetchData(urlSMA)
            ]);

            // Parse Price
            const price = parseFloat(priceData['Global Quote']?.['05. price'] || 0).toFixed(2);
            
            // Parse RSI
            const rsiKey = 'Technical Analysis: RSI';
            const rsiDate = rsiData[rsiKey] ? Object.keys(rsiData[rsiKey])[0] : null;
            const rsi = rsiDate ? parseFloat(rsiData[rsiKey][rsiDate]['RSI']).toFixed(1) : "--";

            // Parse SMA & Trend
            const smaKey = 'Technical Analysis: SMA';
            const smaDate = smaData[smaKey] ? Object.keys(smaData[smaKey])[0] : null;
            const sma = smaDate ? parseFloat(smaData[smaKey][smaDate]['SMA']) : 0;
            const trend = (parseFloat(price) > sma) ? "UP" : "DOWN";

            responseData = { price, rsi, trend };
        } 
        
        // MODE 3: NEWS
        else if (mode === 'news') {
            const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&limit=3&apikey=${API_KEY}`;
            responseData = await fetchData(url);
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
