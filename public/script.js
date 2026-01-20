// --- TAB SWITCHING ---
function switchTab(mode) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${mode}`).classList.add('active');
    if (mode === 'radar') loadRadar();
}

// --- RADAR LOGIC (LIVE SCANNER) ---
let radarStarted = false;

async function loadRadar() {
    if (radarStarted) return;
    radarStarted = true;
    
    // THE SECTOR LEADERS 50 (Optimized for your 75 calls/min limit)
    const tickers = [
        "NVDA", "MSFT", "AAPL", "AMZN", "META", "GOOGL", "TSLA", "AVGO", // Tech Giants
        "AMD", "INTC", "QCOM", "TXN", "MU", "ADI", "LRCX", "AMAT", // Semis
        "JPM", "BAC", "WFC", "C", "GS", "MS", "BLK", // Finance
        "XOM", "CVX", "COP", "SLB", // Energy
        "LLY", "JNJ", "UNH", "ABBV", "MRK", "PFE", "TMO", // Healthcare
        "PG", "COST", "WMT", "KO", "PEP", "HD", "MCD", // Consumer
        "BA", "CAT", "GE", "HON", "UNP", "UPS", // Industrial
        "NFLX", "DIS", "CMCSA" // Media
    ];
    
    // Initialize Empty Chart
    renderEmptyRadar();
    
    const statusEl = document.getElementById('loading-radar');
    statusEl.style.display = 'block';

    for (let i = 0; i < tickers.length; i++) {
        const symbol = tickers[i];
        statusEl.innerHTML = `SCANNING ${symbol} (${i+1}/${tickers.length})...`;
        
        try {
            // Fetch ONE stock
            const res = await fetch(`/.netlify/functions/secure-bridge?mode=radar_single&symbol=${symbol}`);
            const data = await res.json();

            if (data.ticker) {
                addDotToRadar(data);
            }
            
            // 200ms delay = ~5 calls per second max. Safe for Premium (75/min).
            await new Promise(r => setTimeout(r, 200));

        } catch (e) {
            console.log(`Skipping ${symbol}:`, e);
        }
    }
    statusEl.innerHTML = "SCAN COMPLETE.";
    setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
}

// 1. Setup the Chart Board
function renderEmptyRadar() {
    const layout = {
        title: { text: 'MARKET RADAR (Live Feed)', font: { color: 'white', size: 16 } },
        paper_bgcolor: '#111',
        plot_bgcolor: '#111',
        xaxis: { title: 'DEALER FEAR', range: [0, 100], gridcolor: '#333', zerolinecolor: '#666', tickfont: {color:'#ccc'}, titlefont: {color:'#ccc'} },
        yaxis: { title: 'TREND (% vs 50SMA)', gridcolor: '#333', zerolinecolor: '#666', tickfont: {color:'#ccc'}, titlefont: {color:'#ccc'}, autorange: true },
        shapes: [
            { type: 'line', x0: 50, y0: 0, x1: 50, y1: 1, xref: 'x', yref: 'paper', line: {color: 'white', width: 1, dash:'dot'} },
            { type: 'line', x0: 0, y0: 0, x1: 1, y1: 0, xref: 'paper', yref: 'y', line: {color: 'white', width: 1, dash:'dot'} }
        ],
        margin: { l: 50, r: 20, t: 40, b: 50 },
        showlegend: false,
        hovermode: 'closest'
    };
    
    Plotly.newPlot('radar-chart', [{
        x: [], y: [], text: [], mode: 'markers+text',
        marker: { color: [], size: [] }, type: 'scatter'
    }], layout, {responsive: true, displayModeBar: false});
}

// 2. Add a Single Dot dynamically
function addDotToRadar(d) {
    let color = '#808080'; // Trap (Grey)
    if (d.trend < 0 && d.fear > 50) color = '#ffd700'; // Good Deal (Gold)
    if (d.trend > 0 && d.fear < 50) color = '#00cc00'; // Grinder (Green)
    if (d.trend > 0 && d.fear > 50) color = '#ff4d4d'; // Chaser (Red)

    // NEW SIZE FORMULA: Linear scale.
    // RSI 70 = 35px. RSI 30 = 15px.
    const size = d.rsi / 2;

    Plotly.extendTraces('radar-chart', {
        x: [[d.fear]],
        y: [[d.trend]],
        text: [[`<b>${d.ticker}</b>`]],
        'marker.color': [[color]],
        'marker.size': [[size]]
    }, [0]);
}

// --- STANDARD SCOUT LOGIC (Unchanged) ---
async function runAnalysis() {
    const ticker = document.getElementById('tickerInput').value.trim().toUpperCase();
    if(!ticker) return;
    document.getElementById('val-signal').innerText = "LOADING...";
    document.getElementById('val-signal').className = "";
    document.getElementById('news-feed').innerHTML = "";
    updateChart(ticker);
    try { await Promise.all([fetchFundamentals(ticker), fetchTechnicalLogic(ticker), fetchNews(ticker)]); } 
    catch (error) { document.getElementById('val-signal').innerText = "API ERROR"; }
}
function handleEnter(e) { if(e.key === 'Enter') runAnalysis(); }
function updateChart(ticker) {
    document.getElementById('tv-chart-container').innerHTML = "";
    new TradingView.widget({
        "container_id": "tv-chart-container", "autosize": true, "symbol": ticker, "interval": "D", "timezone": "Etc/UTC", "theme": "dark", "style": "1", "locale": "en", "toolbar_bg": "#f1f3f6", "enable_publishing": false, "allow_symbol_change": true, "hide_top_toolbar": false, "hide_volume": true,
        "studies": [{ "id": "MASimple@tv-basicstudies", "inputs": { "length": 100 } }, { "id": "MASimple@tv-basicstudies", "inputs": { "length": 200 } }]
    });
}
async function fetchFundamentals(ticker) {
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
    let signal = "⚠️ WAIT";
    let signalClass = "";
    const rsiVal = parseFloat(data.rsi);
    if (rsiVal < 30 && data.trend === "UP") { signal = "🔥 PERFECT BUY"; signalClass = "bullish"; }
    else if (rsiVal < 30 && data.trend === "DOWN") { signal = "⚠️ RISKY DIP"; signalClass = "bearish"; }
    else if (rsiVal > 70) { signal = "❌ SELL"; signalClass = "bearish"; }
    const sigEl = document.getElementById('val-signal');
    sigEl.innerText = signal;
    sigEl.className = signalClass;
}
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
            feed.innerHTML += `<div class="news-item"><div class="news-meta"><span>${item.source}</span><span class="sentiment-tag ${sentClass}">${sentText}</span></div><a href="${item.url}" target="_blank" class="news-title">${item.title}</a></div>`;
        });
    }
}
function updateDOM(id, val) { const el = document.getElementById(id); if(el && val && val !== 'undefined%' && val !== 'undefined') el.innerText = val; else if(el) el.innerText = "--"; }
function formatNumber(num) { if(!num) return "--"; if(num > 1000000000) return (num / 1000000000).toFixed(1) + 'B'; if(num > 1000000) return (num / 1000000).toFixed(1) + 'M'; return num; }
