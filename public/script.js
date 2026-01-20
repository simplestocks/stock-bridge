// --- TAB SWITCHING ---
function switchTab(mode) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${mode}`).classList.add('active');
    
    // Only auto-load if the chart is empty
    if (mode === 'radar') {
        const chartDiv = document.getElementById('radar-chart');
        if (chartDiv.data === undefined || chartDiv.data.length === 0) {
            loadRadar();
        }
    }
}

// --- RADAR LOGIC (DYNAMIC LISTS) ---
let isScanning = false;

// 1. The Hardcoded "Generals" Lists (Top 15-20 per sector)
const SECTOR_LISTS = {
    'TECH': ["MSFT", "AAPL", "NVDA", "GOOGL", "AMZN", "META", "CRM", "ADBE", "CSCO", "ORCL", "IBM", "INTU", "NOW", "UBER", "ABNB"],
    'SEMIS': ["NVDA", "AMD", "AVGO", "INTC", "QCOM", "TXN", "MU", "ADI", "LRCX", "AMAT", "TSM", "ARM", "KLAC", "MRVL"],
    'FINANCE': ["JPM", "BAC", "WFC", "C", "GS", "MS", "BLK", "AXP", "V", "MA", "PYPL", "COF", "USB", "SCHW"],
    'ENERGY': ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "KMI", "WMB", "HES", "HAL", "BKR"],
    'HEALTH': ["LLY", "UNH", "JNJ", "ABBV", "MRK", "PFE", "TMO", "DHR", "BMY", "AMGN", "GILD", "CVS", "CI", "ISRG"],
    'CONSUMER': ["WMT", "COST", "PG", "KO", "PEP", "HD", "MCD", "NKE", "SBUX", "TGT", "LOW", "TJX", "EL", "CL"],
};

async function loadRadar(isCustomRun = false) {
    if (isScanning) return; // Prevent double clicking
    
    const selector = document.getElementById('sectorSelector');
    const customInput = document.getElementById('customTickerInput');
    const customBtn = document.getElementById('runCustomBtn');
    let selectedMode = selector.value;
    let tickers = [];

    // UI Logic: Show/Hide Custom Input
    if (selectedMode === 'CUSTOM') {
        customInput.style.display = 'inline-block';
        customBtn.style.display = 'inline-block';
        if (!isCustomRun) return; // Wait for them to click RUN
        
        // Parse user input
        const raw = customInput.value.trim().toUpperCase();
        if (!raw) return alert("Please enter tickers (e.g. NVDA, GME)");
        tickers = raw.split(',').map(t => t.trim()).filter(t => t.length > 0);
    } else {
        customInput.style.display = 'none';
        customBtn.style.display = 'none';
        tickers = SECTOR_LISTS[selectedMode] || [];
    }

    // Start Scan
    isScanning = true;
    const statusEl = document.getElementById('loading-radar');
    statusEl.style.display = 'block';
    
    // Clear old chart or create new one
    renderEmptyRadar();

    for (let i = 0; i < tickers.length; i++) {
        const symbol = tickers[i];
        statusEl.innerHTML = `SCANNING ${symbol} (${i+1}/${tickers.length})...`;
        
        try {
            const res = await fetch(`/.netlify/functions/secure-bridge?mode=radar_single&symbol=${symbol}`);
            const data = await res.json();

            if (data.ticker) {
                addDotToRadar(data);
            }
            
            // Speed Limit Protection (200ms)
            await new Promise(r => setTimeout(r, 200));

        } catch (e) {
            console.log(`Skipping ${symbol}`, e);
        }
    }
    
    statusEl.innerHTML = "SCAN COMPLETE.";
    setTimeout(() => { statusEl.style.display = 'none'; isScanning = false; }, 2000);
}

// 2. Setup Empty Chart
function renderEmptyRadar() {
    const layout = {
        title: { text: 'MARKET RADAR', font: { color: 'white', size: 16 } },
        paper_bgcolor: '#111',
        plot_bgcolor: '#111',
        xaxis: { title: 'DEALER FEAR', range: [-5, 125], gridcolor: '#333', zerolinecolor: '#666', tickfont: {color:'#ccc'}, titlefont: {color:'#ccc'} },
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
        textfont: { color: 'white' }, // <--- ADDED THIS TO MAKE FONT WHITE
        marker: { color: [], size: [] }, type: 'scatter'
    }], layout, {responsive: true, displayModeBar: false});
}

// 3. Add Single Dot
function addDotToRadar(d) {
    let color = '#808080'; // Trap
    if (d.trend < 0 && d.fear > 50) color = '#ffd700'; // Good Deal
    if (d.trend > 0 && d.fear < 50) color = '#00cc00'; // Grinder
    if (d.trend > 0 && d.fear > 50) color = '#ff4d4d'; // Chaser

    // Size = RSI / 2 (Linear Scale)
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

