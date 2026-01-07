// --- CONFIGURATION ---
const API_KEY = "C9E1N388LHHS9E5O"; // NIC'S KEY

// --- MAIN FUNCTION ---
async function runAnalysis() {
    const ticker = document.getElementById('tickerInput').value.trim().toUpperCase();
    if(!ticker) return;

    // Reset UI
    document.getElementById('val-signal').innerText = "LOADING...";
    document.getElementById('val-signal').className = "";

    // 1. UPDATE CHART (TradingView)
    updateChart(ticker);

    // 2. FETCH DATA (Parallel Execution for Speed)
    try {
        await Promise.all([
            fetchFundamentals(ticker),
            fetchTechnicalLogic(ticker),
            fetchNews(ticker)
        ]);
    } catch (error) {
        console.error("API Error:", error);
        document.getElementById('val-signal').innerText = "API ERROR";
    }
}

function handleEnter(e) {
    if(e.key === 'Enter') runAnalysis();
}

// --- TRADINGVIEW WIDGET ---
function updateChart(ticker) {
    document.getElementById('tv-chart-container').innerHTML = ""; 
    new TradingView.widget({
        "container_id": "tv-chart-container",
        "autosize": true,
        "symbol": ticker,
        "interval": "D",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1", // Candles
        "locale": "en",
        "toolbar_bg": "#f1f3f6",
        "enable_publishing": false,
        "allow_symbol_change": true,
        "hide_top_toolbar": false,
        "hide_volume": true
    });
}

// --- ALPHA VANTAGE: FUNDAMENTALS (Overview) ---
async function fetchFundamentals(ticker) {
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if(data.Symbol) {
        updateDOM('val-mktcap', formatNumber(data.MarketCapitalization));
        updateDOM('val-pe', data.PERatio);
        updateDOM('val-ps', data.PriceToSalesRatioTTM); // NEW: P/S
        updateDOM('val-div', (data.DividendYield * 100).toFixed(2) + '%');
        
        // Growth Metrics (YOY)
        updateDOM('val-sales', data.QuarterlyRevenueGrowthYOY + '%');
        updateDOM('val-eps', data.QuarterlyEarningsGrowthYOY + '%');

        // Sector/Industry Context
        updateDOM('val-sector', data.Sector);
        updateDOM('val-industry', data.Industry);
    }
}

// --- ALPHA VANTAGE: LOGIC CORE (Price, RSI, Trend) ---
async function fetchTechnicalLogic(ticker) {
    const urlPrice = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${API_KEY}`;
    const resPrice = await fetch(urlPrice);
    const jsonPrice = await resPrice.json();
    const price = parseFloat(jsonPrice['Global Quote']['05. price']);
    updateDOM('val-price', '$' + price.toFixed(2));

    const urlRSI = `https://www.alphavantage.co/query?function=RSI&symbol=${ticker}&interval=daily&time_period=14&series_type=close&apikey=${API_KEY}`;
    const resRSI = await fetch(urlRSI);
    const jsonRSI = await resRSI.json();
    const rsiData = jsonRSI['Technical Analysis: RSI'];
    const latestDateRSI = Object.keys(rsiData)[0];
    const rsi = parseFloat(rsiData[latestDateRSI]['RSI']);
    
    const rsiEl = document.getElementById('val-rsi');
    rsiEl.innerText = rsi.toFixed(1);
    rsiEl.className = "value " + (rsi > 70 ? "bearish" : rsi < 30 ? "bullish" : "");

    const urlSMA = `https://www.alphavantage.co/query?function=SMA&symbol=${ticker}&interval=daily&time_period=200&series_type=close&apikey=${API_KEY}`;
    const resSMA = await fetch(urlSMA);
    const jsonSMA = await resSMA.json();
    const smaData = jsonSMA['Technical Analysis: SMA'];
    const latestDateSMA = Object.keys(smaData)[0];
    const sma = parseFloat(smaData[latestDateSMA]['SMA']);
    
    const trend = price > sma ? "UP" : "DOWN";
    const trendEl = document.getElementById('val-trend');
    trendEl.innerText = trend;
    trendEl.className = "value " + (trend === "UP" ? "bullish" : "bearish");

    let signal = "⚠️ WAIT";
    let signalClass = "";

    if (rsi < 30 && trend === "UP") {
        signal = "🔥 PERFECT BUY";
        signalClass = "bullish";
    } else if (rsi < 30 && trend === "DOWN") {
        signal = "⚠️ RISKY DIP";
        signalClass = "bearish";
    } else if (rsi > 70) {
        signal = "❌ SELL";
        signalClass = "bearish";
    }

    const sigEl = document.getElementById('val-signal');
    sigEl.innerText = signal;
    sigEl.className = signalClass;
}

// --- ALPHA VANTAGE: NEWS SENTIMENT ---
async function fetchNews(ticker) {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${ticker}&limit=3&apikey=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    
    const feed = document.getElementById('news-feed');
    feed.innerHTML = "";

    if(data.feed) {
        data.feed.forEach(item => {
            const sentimentScore = parseFloat(item.overall_sentiment_score);
            let sentClass = "bg-bull";
            let sentText = "BULL";
            
            if(sentimentScore < -0.15) { sentClass = "bg-bear"; sentText = "BEAR"; }
            else if(sentimentScore < 0.15) { sentClass = ""; sentText = "NEUTRAL"; }

            feed.innerHTML += `
                <div class="news-item">
                    <div class="news-meta">
                        <span>${item.source}</span>
                        <span class="sentiment-tag ${sentClass}">${sentText}</span>
                    </div>
                    <a href="${item.url}" target="_blank" class="news-title">${item.title}</a>
                </div>
            `;
        });
    }
}

function updateDOM(id, val) {
    const el = document.getElementById(id);
    if(el && val && val !== 'undefined%') el.innerText = val;
    else el.innerText = "--";
}

function formatNumber(num) {
    if(!num) return "--";
    if(num > 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if(num > 1000000) return (num / 1000000).toFixed(1) + 'M';
    return num;
}
