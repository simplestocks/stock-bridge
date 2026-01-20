// --- CONFIGURATION ---
// API Key is removed for security. It now lives in the secure backend.

// --- MAIN FUNCTION ---
async function runAnalysis() {
    const ticker = document.getElementById('tickerInput').value.trim().toUpperCase();
    if(!ticker) return;

    // Reset UI
    document.getElementById('val-signal').innerText = "LOADING...";
    document.getElementById('val-signal').className = "";
    document.getElementById('news-feed').innerHTML = "";

    // 1. UPDATE CHART (TradingView)
    updateChart(ticker);

    // 2. FETCH DATA (Calls secure backend)
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
        "hide_volume": true,
        "studies": [
            { "id": "MASimple@tv-basicstudies", "inputs": { "length": 100 } },
            { "id": "MASimple@tv-basicstudies", "inputs": { "length": 200 } }
        ]
    });
}

// --- BACKEND FETCH: FUNDAMENTALS ---
async function fetchFundamentals(ticker) {
    // Calls secure bridge instead of AlphaVantage directly
    const res = await fetch(`/.netlify/functions/secure-bridge?mode=fundamentals&symbol=${ticker}`);
    const data = await res.json();

    if(data.Symbol) {
        updateDOM('val-mktcap', formatNumber(data.MarketCapitalization));
        updateDOM('val-pe', data.PERatio);
        updateDOM('val-ps', data.PriceToSalesRatioTTM);
        updateDOM('val-div', (data.DividendYield * 100).toFixed(2) + '%');
        updateDOM('val-sales', data.QuarterlyRevenueGrowthYOY + '%');
        updateDOM('val-eps', data.QuarterlyEarningsGrowthYOY + '%');
        updateDOM('val-sector', data.Sector);
        updateDOM('val-industry', data.Industry);
    }
}

// --- BACKEND FETCH: LOGIC CORE (Price, RSI, Trend) ---
async function fetchTechnicalLogic(ticker) {
    const res = await fetch(`/.netlify/functions/secure-bridge?mode=technicals&symbol=${ticker}`);
    const data = await res.json();
    
    updateDOM('val-price', '$' + data.price);
    
    const rsiEl = document.getElementById('val-rsi');
    rsiEl.innerText = data.rsi;
    rsiEl.className = "value " + (data.rsi > 70 ? "bearish" : data.rsi < 30 ? "bullish" : "");
    
    const trendEl = document.getElementById('val-trend');
    trendEl.innerText = data.trend;
    trendEl.className = "value " + (data.trend === "UP" ? "bullish" : "bearish");

    // Signal Logic
    let signal = "⚠️ WAIT";
    let signalClass = "";
    const rsiVal = parseFloat(data.rsi);

    if (rsiVal < 30 && data.trend === "UP") {
        signal = "🔥 PERFECT BUY";
        signalClass = "bullish";
    } else if (rsiVal < 30 && data.trend === "DOWN") {
        signal = "⚠️ RISKY DIP";
        signalClass = "bearish";
    } else if (rsiVal > 70) {
        signal = "❌ SELL";
        signalClass = "bearish";
    }

    const sigEl = document.getElementById('val-signal');
    sigEl.innerText = signal;
    sigEl.className = signalClass;
}

// --- BACKEND FETCH: NEWS ---
async function fetchNews(ticker) {
    const res = await fetch(`/.netlify/functions/secure-bridge?mode=news&symbol=${ticker}`);
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
    if(el && val && val !== 'undefined%' && val !== 'undefined') el.innerText = val;
    else if(el) el.innerText = "--";
}

function formatNumber(num) {
    if(!num) return "--";
    if(num > 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if(num > 1000000) return (num / 1000000).toFixed(1) + 'M';
    return num;
}
