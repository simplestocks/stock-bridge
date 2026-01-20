// --- TAB SWITCHING ---
function switchTab(mode) {
    // 1. Update Buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    // 2. Hide/Show Views
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${mode}`).classList.add('active');

    // 3. Trigger Radar Load if needed
    if (mode === 'radar') loadRadar();
}

// --- RADAR LOGIC ---
let radarLoaded = false;
async function loadRadar() {
    if (radarLoaded) return; // Don't reload if already there
    
    document.getElementById('loading-radar').style.display = 'block';
    
    try {
        const res = await fetch(`/.netlify/functions/secure-bridge?mode=radar`);
        const data = await res.json();
        
        renderRadarChart(data);
        radarLoaded = true;
        document.getElementById('loading-radar').style.display = 'none';
    } catch (e) {
        document.getElementById('loading-radar').innerText = "ERROR LOADING RADAR";
    }
}

function renderRadarChart(data) {
    const colors = data.map(d => {
        if (d.trend < 0 && d.fear > 50) return '#ffd700'; // Gold (Good Deal)
        if (d.trend > 0 && d.fear < 50) return '#00cc00'; // Green (Grinder)
        if (d.trend > 0 && d.fear > 50) return '#ff4d4d'; // Red (Chaser)
        return '#808080'; // Grey (Trap)
    });

    const sizes = data.map(d => (Math.pow(d.rsi, 2) / 10) + 10); // Size = RSI

    const trace = {
        x: data.map(d => d.fear),
        y: data.map(d => d.trend),
        mode: 'markers+text',
        text: data.map(d => `<b>${d.ticker}</b>`),
        textposition: 'top center',
        textfont: { family: 'Roboto', size: 11, color: 'white' },
        marker: { color: colors, size: sizes, line: { color: 'white', width: 1 }, opacity: 0.9 },
        type: 'scatter'
    };

    const layout = {
        title: { text: 'MARKET RADAR (Size = RSI)', font: { color: 'white', size: 16 } },
        paper_bgcolor: '#111',
        plot_bgcolor: '#111',
        xaxis: { title: 'DEALER FEAR', range: [0, 100], gridcolor: '#333', zerolinecolor: '#666', tickfont: {color:'#ccc'}, titlefont: {color:'#ccc'} },
        yaxis: { title: 'TREND (% vs 50SMA)', gridcolor: '#333', zerolinecolor: '#666', tickfont: {color:'#ccc'}, titlefont: {color:'#ccc'} },
        shapes: [
            { type: 'line', x0: 50, y0: 0, x1: 50, y1: 1, xref: 'x', yref: 'paper', line: {color: 'white', width: 1, dash:'dot'} },
            { type: 'line', x0: 0, y0: 0, x1: 1, y1: 0, xref: 'paper', yref: 'y', line: {color: 'white', width: 1, dash:'dot'} }
        ],
        margin: { l: 50, r: 20, t: 40, b: 50 },
        hovermode: 'closest'
    };

    Plotly.newPlot('radar-chart', [trace], layout, {responsive: true, displayModeBar: false});
}

// --- EXISTING TICKER SCOUT LOGIC ---
async function runAnalysis() {
    const ticker = document.getElementById('tickerInput').value.trim().toUpperCase();
    if(!ticker) return;

    document.getElementById('val-signal').innerText = "LOADING...";
    document.getElementById('val-signal').className = "";
    document.getElementById('news-feed').innerHTML = "";

    updateChart(ticker);

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

function handleEnter(e) { if(e.key === 'Enter') runAnalysis(); }

function updateChart(ticker) {
    document.getElementById('tv-chart-container').innerHTML = "";
    new TradingView.widget({
        "container_id": "tv-chart-container",
        "autosize": true,
        "symbol": ticker,
        "interval": "D",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
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

            feed.innerHTML += `
                <div class="news-item">
                    <div class="news-meta">
                        <span>${item.source}</span>
                        <span class="sentiment-tag ${sentClass}">${sentText}</span>
                    </div>
                    <a href="${item.url}" target="_blank" class="news-title">${item.title}</a>
                </div>`;
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
