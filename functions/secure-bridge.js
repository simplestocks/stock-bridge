const https = require('https');

exports.handler = async function(event, context) {
    const API_KEY = process.env.ALPHA_VANTAGE_KEY || "C9E1N388LHHS9E5O";
    const symbol = event.queryStringParameters.symbol;
    const mode = event.queryStringParameters.mode;

    // HELPER: Fetch wrapper
    const fetchData = (url) => {
        return new Promise((resolve) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
                });
            }).on('error', () => resolve({}));
        });
    };

    // HELPER: Sleep function to prevent Speeding Tickets (Rate Limits)
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
        let responseData = {};

        // === MODE 1: FUNDAMENTALS ===
        if (mode === 'fundamentals') {
            const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${API_KEY}`;
            responseData = await fetchData(url);
        } 
        
        // === MODE 2: TECHNICALS ===
        else if (mode === 'technicals') {
            // Fetch concurrent is fine for 3 items
            const [priceData, rsiData, smaData] = await Promise.all([
                fetchData(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`),
                fetchData(`https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${API_KEY}`),
                fetchData(`https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=200&series_type=close&apikey=${API_KEY}`)
            ]);

            const price = parseFloat(priceData['Global Quote']?.['05. price'] || 0).toFixed(2);
            const rsiDate = rsiData['Technical Analysis: RSI'] ? Object.keys(rsiData['Technical Analysis: RSI'])[0] : null;
            const rsi = rsiDate ? parseFloat(rsiData['Technical Analysis: RSI'][rsiDate]['RSI']).toFixed(1) : "--";
            const smaDate = smaData['Technical Analysis: SMA'] ? Object.keys(smaData['Technical Analysis: SMA'])[0] : null;
            const sma = smaDate ? parseFloat(smaData['Technical Analysis: SMA'][smaDate]['SMA']) : 0;

            responseData = { price, rsi, trend: (parseFloat(price) > sma) ? "UP" : "DOWN" };
        } 
        
        // === MODE 3: NEWS ===
        else if (mode === 'news') {
            responseData = await fetchData(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&limit=3&apikey=${API_KEY}`);
        }

        // === MODE 4: RADAR (The Fix: Sequential Loading) ===
        else if (mode === 'radar') {
            const tickers = ["NVDA", "TSLA", "AAPL", "AMD", "NFLX", "META", "AMZN", "MSFT", "BA", "SMCI", "INTC", "DIS", "JPM", "GOOGL", "COST"];
            const results = [];

            // We loop ONE BY ONE instead of all at once
            for (const t of tickers) {
                const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${t}&outputsize=compact&apikey=${API_KEY}`;
                const data = await fetchData(url);
                const ts = data["Time Series (Daily)"];
                
                if (ts) {
                    const dates = Object.keys(ts);
                    const prices = dates.map(d => parseFloat(ts[d]["4. close"]));
                    
                    // Trend
                    const current = prices[0];
                    const sma50 = prices.slice(0, 50).reduce((a,b)=>a+b,0)/50;
                    const trend = ((current - sma50)/sma50) * 100;

                    // Fear
                    const logs = [];
                    for(let i=0; i<dates.length-1; i++) logs.push(Math.log(prices[i]/prices[i+1]));
                    const vol = (arr) => Math.sqrt(arr.reduce((a,b)=>a+Math.pow(b-(arr.reduce((x,y)=>x+y,0)/arr.length),2),0)/arr.length) * Math.sqrt(252)*100;
                    const curVol = vol(logs.slice(0,30));
                    const fear = Math.min(Math.max((curVol - 15) / (60 - 15) * 100, 0), 100); 

                    // RSI
                    let gains=0, losses=0;
                    for(let i=0; i<14; i++){
                        let d = prices[i]-prices[i+1];
                        if(d>0) gains+=d; else losses-=d;
                    }
                    const rsi = 100 - (100/(1+((gains/14)/(losses/14))));

                    results.push({ ticker: t, trend, fear, rsi });
                }
                
                // WAIT 150ms before the next one to avoid hitting the wall
                await delay(150);
            }
            
            responseData = results;
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(responseData)
        };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};
