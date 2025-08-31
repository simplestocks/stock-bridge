<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stock Research Tool</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .ticker-input {
            margin: 20px 0;
        }
        
        .ticker-input input {
            padding: 15px 20px;
            font-size: 24px;
            border: 3px solid #4fd1c7;
            border-radius: 50px;
            width: 300px;
            text-align: center;
            text-transform: uppercase;
            font-weight: bold;
            outline: none;
            transition: all 0.3s ease;
        }
        
        .ticker-input input:focus {
            transform: scale(1.05);
            box-shadow: 0 0 20px rgba(79, 209, 199, 0.5);
        }
        
        .research-btn {
            background: linear-gradient(135deg, #4fd1c7 0%, #38b2ac 100%);
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 50px;
            font-size: 18px;
            margin-left: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .research-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(79, 209, 199, 0.3);
        }
        
        .research-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        
        .content {
            padding: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 30px;
        }
        
        .card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
            border: 1px solid #e2e8f0;
            transition: all 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
        }
        
        .card-title {
            font-size: 18px;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            border-bottom: 2px solid #4fd1c7;
            padding-bottom: 10px;
        }
        
        .icon {
            margin-right: 10px;
            font-size: 20px;
        }
        
        .price-section {
            grid-column: span 3;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 40px;
        }
        
        .price {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .price-change {
            font-size: 24px;
            margin-bottom: 20px;
        }
        
        .price-details {
            display: flex;
            justify-content: space-around;
            margin-top: 30px;
        }
        
        .price-item {
            text-align: center;
        }
        
        .price-label {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 5px;
        }
        
        .price-value {
            font-size: 18px;
            font-weight: bold;
        }
        
        .options-section {
            grid-column: span 2;
            background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
        }
        
        .technical-section {
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
        }
        
        .fundamentals-section {
            background: linear-gradient(135deg, #d299c2 0%, #fef9d7 100%);
        }
        
        .earnings-section {
            background: linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%);
        }
        
        .catalyst-section {
            background: linear-gradient(135deg, #fdbb2d 0%, #22c1c3 100%);
        }
        
        .data-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }
        
        .data-row:last-child {
            border-bottom: none;
        }
        
        .data-label {
            font-weight: 500;
            color: #4a5568;
        }
        
        .data-value {
            font-weight: bold;
            color: #2d3748;
        }
        
        .bullish {
            color: #38a169;
        }
        
        .bearish {
            color: #e53e3e;
        }
        
        .neutral {
            color: #718096;
        }
        
        .options-table {
            margin-top: 15px;
        }
        
        .options-header {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: 10px;
            font-weight: bold;
            padding: 10px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 8px;
            margin-bottom: 10px;
        }
        
        .options-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: 10px;
            padding: 8px 10px;
            background: rgba(255, 255, 255, 0.6);
            border-radius: 5px;
            margin-bottom: 5px;
        }
        
        .alert-box {
            background: #fed7d7;
            border: 1px solid #feb2b2;
            color: #9b2c2c;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            font-weight: 500;
        }
        
        .success-box {
            background: #c6f6d5;
            border: 1px solid #9ae6b4;
            color: #276749;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            font-weight: 500;
        }
        
        .full-width {
            grid-column: span 3;
        }
        
        .loading {
            grid-column: span 3;
            text-align: center;
            padding: 40px;
            font-size: 18px;
            color: #667eea;
        }
        
        @media (max-width: 1024px) {
            .content {
                grid-template-columns: 1fr 1fr;
            }
            
            .price-section {
                grid-column: span 2;
            }
            
            .options-section {
                grid-column: span 2;
            }
            
            .full-width {
                grid-column: span 2;
            }
        }
        
        @media (max-width: 768px) {
            .content {
                grid-template-columns: 1fr;
            }
            
            .price-section,
            .options-section,
            .full-width {
                grid-column: span 1;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Professional Stock Research</h1>
            <p>Powered by Alpha Vantage • Real-time Analysis</p>
            <div class="ticker-input">
                <input type="text" placeholder="Enter Ticker (e.g., AAPL)" id="tickerInput">
                <button class="research-btn" id="researchBtn">🔍 Research</button>
            </div>
        </div>
        
        <div class="content" id="contentArea">
            <!-- Content will be populated by JavaScript -->
        </div>
    </div>

    <script>
        const tickerInput = document.getElementById('tickerInput');
        const researchBtn = document.getElementById('researchBtn');
        const contentArea = document.getElementById('contentArea');

        researchBtn.addEventListener('click', researchStock);
        tickerInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                researchStock();
            }
        });

        async function researchStock() {
            const ticker = tickerInput.value.trim().toUpperCase();
            if (!ticker) {
                alert('Please enter a ticker symbol');
                return;
            }

            researchBtn.disabled = true;
            researchBtn.textContent = 'Researching...';
            
            showLoading();

            try {
                const response = await fetch('/.netlify/functions/stock-research', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticker: ticker })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    displayStockData(ticker, data);
                } else {
                    throw new Error(data.error || 'Analysis failed');
                }
                
            } catch (error) {
                console.error('Error:', error);
                showError('Analysis failed. Please try again.');
            } finally {
                researchBtn.disabled = false;
                researchBtn.textContent = '🔍 Research';
            }
        }

        function showLoading() {
            contentArea.innerHTML = `
                <div class="loading">
                    🔍 Fetching comprehensive stock data from Alpha Vantage...
                    <br><br>
                    This includes: Company Overview, Balance Sheet, Cash Flow
                </div>
            `;
        }

        function showError(message) {
            contentArea.innerHTML = `
                <div class="alert-box" style="grid-column: span 3;">${message}</div>
            `;
        }

        function displayStockData(ticker, data) {
            const rawData = data.rawData || {};
            
            const formatNumber = (num) => {
                if (!num || isNaN(num)) return 'N/A';
                const n = parseFloat(num);
                if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
                if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
                if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
                return n.toFixed(2);
            };

            const formatCurrency = (num) => {
                if (!num || isNaN(num)) return 'N/A';
                return '$' + formatNumber(num);
            };

            const netDebtFormatted = rawData.netDebt ? 
                (rawData.netDebt < 0 ? '-' + formatCurrency(Math.abs(rawData.netDebt)) : formatCurrency(rawData.netDebt)) : 'N/A';

            contentArea.innerHTML = `
                <!-- Price Section -->
                <div class="card price-section">
                    <div class="price">${ticker}</div>
                    <div class="price-change neutral">Alpha Vantage Fundamental Analysis</div>
                    <div class="price-details">
                        <div class="price-item">
                            <div class="price-label">P/E RATIO</div>
                            <div class="price-value">${rawData.peRatio || 'N/A'}</div>
                        </div>
                        <div class="price-item">
                            <div class="price-label">P/S RATIO</div>
                            <div class="price-value">${rawData.psRatio || 'N/A'}</div>
                        </div>
                        <div class="price-item">
                            <div class="price-label">NET DEBT</div>
                            <div class="price-value">${netDebtFormatted}</div>
                        </div>
                        <div class="price-item">
                            <div class="price-label">REVENUE TTM</div>
                            <div class="price-value">${formatCurrency(rawData.revenue)}</div>
                        </div>
                        <div class="price-item">
                            <div class="price-label">GROSS PROFIT</div>
                            <div class="price-value">${formatCurrency(rawData.grossProfit)}</div>
                        </div>
                        <div class="price-item">
                            <div class="price-label">OP CASH FLOW</div>
                            <div class="price-value">${formatCurrency(rawData.operatingCashFlow)}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Options Analysis -->
                <div class="card options-section">
                    <div class="card-title">
                        <span class="icon">📈</span>
                        Alpha Vantage Data
                    </div>
                    
                    <div class="success-box">
                        ✅ LIVE: Real financial data from SEC filings
                    </div>
                    
                    <div class="data-row">
                        <div class="data-label">Data Source</div>
                        <div class="data-value">Alpha Vantage API</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">Analysis Type</div>
                        <div class="data-value">Fundamental</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">API Calls Used</div>
                        <div class="data-value">3 (Overview, Balance, Cash Flow)</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">Plan Required</div>
                        <div class="data-value">Free Tier (25/day)</div>
                    </div>
                </div>
                
                <!-- Fundamentals -->
                <div class="card fundamentals-section">
                    <div class="card-title">
                        <span class="icon">💰</span>
                        Key Fundamentals
                    </div>
                    
                    <div class="data-row">
                        <div class="data-label">P/E Ratio</div>
                        <div class="data-value">${rawData.peRatio || 'N/A'}</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">P/S Ratio</div>
                        <div class="data-value">${rawData.psRatio || 'N/A'}</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">Net Debt</div>
                        <div class="data-value ${rawData.netDebt && rawData.netDebt < 0 ? 'bullish' : 'neutral'}">${netDebtFormatted}</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">Revenue TTM</div>
                        <div class="data-value">${formatCurrency(rawData.revenue)}</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">Gross Profit TTM</div>
                        <div class="data-value">${formatCurrency(rawData.grossProfit)}</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">Operating Cash Flow</div>
                        <div class="data-value">${formatCurrency(rawData.operatingCashFlow)}</div>
                    </div>
                </div>
                
                <!-- Technical Analysis -->
                <div class="card technical-section">
                    <div class="card-title">
                        <span class="icon">📉</span>
                        Technical Analysis
                    </div>
                    
                    <div class="alert-box">
                        ⚠️ Technical indicators require premium Alpha Vantage
                    </div>
                    
                    <div class="data-row">
                        <div class="data-label">RSI (14)</div>
                        <div class="data-value neutral">Premium Only</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">MACD</div>
                        <div class="data-value neutral">Premium Only</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">Moving Averages</div>
                        <div class="data-value neutral">Premium Only</div>
                    </div>
                </div>
                
                <!-- Earnings -->
                <div class="card earnings-section">
                    <div class="card-title">
                        <span class="icon">📊</span>
                        Financial Health
                    </div>
                    
                    <div class="success-box">
                        ✅ DATA: Comprehensive balance sheet analysis
                    </div>
                    
                    <div class="data-row">
                        <div class="data-label">Revenue Growth</div>
                        <div class="data-value">Available in premium</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">Margin Analysis</div>
                        <div class="data-value">Available in API</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">Debt Position</div>
                        <div class="data-value ${rawData.netDebt && rawData.netDebt < 0 ? 'bullish' : 'neutral'}">${rawData.netDebt && rawData.netDebt < 0 ? 'Net Cash' : 'Net Debt'}</div>
                    </div>
                </div>
                
                <!-- Catalysts -->
                <div class="card catalyst-section">
                    <div class="card-title">
                        <span class="icon">⚡</span>
                        Data Coverage
                    </div>
                    
                    <div class="data-row">
                        <div class="data-label">Company Overview</div>
                        <div class="data-value bullish">✓ Available</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">Balance Sheet</div>
                        <div class="data-value bullish">✓ Available</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">Cash Flow</div>
                        <div class="data-value bullish">✓ Available</div>
                    </div>
                    <div class="data-row">
                        <div class="data-label">Income Statement</div>
                        <div class="data-value bullish">✓ Available</div>
                    </div>
                </div>
                
                <!-- AI Analysis Summary -->
                <div class="card full-width" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <div class="card-title" style="color: white; border-color: rgba(255,255,255,0.3);">
                        <span class="icon">🤖</span>
                        Claude AI Analysis Summary
                    </div>
                    
                    <div style="line-height: 1.6; font-size: 16px; white-space: pre-wrap;">${data.research || 'Analysis not available'}</div>
                </div>
            `;
        }

        tickerInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.toUpperCase();
        });
    </script>
</body>
</html>
