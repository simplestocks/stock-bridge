const https = require('https');

exports.handler = async function(event, context) {
    const API_KEY = process.env.ALPHA_VANTAGE_KEY || "C9E1N388LHHS9E5O";
    const symbol = event.queryStringParameters.symbol;
    const mode = event.queryStringParameters.mode;

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

    try {
        let responseData = {};

        // MODE 1 & 2 & 3 (Standard Data)
        if (mode === 'fundamentals') {
            responseData = await fetchData(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${API_KEY}`);
        } 
        else if (mode === 'technicals') {
            const [priceData, rsiData, smaData] = await Promise.all([
                fetchData(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`),
                fetchData(`https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${API_KEY}`),
                fetchData(`https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=200&series_type=close&apikey=${API_KEY}`)
            ]);
            
            const price = parseFloat(priceData['Global Quote']?.['05. price'] || 0).toFixed(2);
            const rsi = rsiData['Technical Analysis: RSI'] ? parseFloat(Object.values(rsiData['Technical Analysis: RSI'])[0]['RSI']).toFixed(1) : "--";
            const sma = smaData['Technical Analysis: SMA'] ? parseFloat(Object.values(smaData['Technical Analysis: SMA'])[0]['SMA']) : 0;
            responseData = { price, rsi, trend: (parseFloat(price) > sma) ? "UP" : "DOWN" };
        } 
        else if (mode === 'news') {
            responseData = await fetchData(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&limit=3&apikey=${API_KEY}`);
        }

        // === MODE 4: RADAR (SINGLE STOCK CALCULATION) ===
        else if (mode === 'radar_single') {
            const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${API_KEY}`;
            const data = await fetchData(url);
            const ts = data["Time Series (Daily)"];
            
            if (ts) {
                const dates = Object.keys(ts);
                const prices = dates.map(d => parseFloat(ts[d]["4. close"]));
                
                // Trend
                const current = prices[0];
                const sma50 = prices.slice(0, 50).reduce((a,b)=>a+b,0)/50;
                const trend = ((current - sma50)/sma50) * 100;

                // Fear (IV Proxy)
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

                responseData = { ticker: symbol, trend, fear, rsi };
            } else {
                responseData = { error: "No Data" };
            }
        }

        return { statusCode: 200, body: JSON.stringify(responseData) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};
