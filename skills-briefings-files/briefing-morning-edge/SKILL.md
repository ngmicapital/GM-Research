# Market Intelligence Briefing

Produce a daily pre-market intelligence briefing for an independent crypto trader using Wyckoff
methodology, based in Sydney, Australia. Every section must contain a stated view or thesis — not
just a summary of news. Think am/FX by Brent Donnelly: opinionated, specific, trader-first.

## Trigger

Phrases: "briefing", "morning briefing", "run the briefing", "daily briefing"

If the user has pasted any of the following, incorporate it directly before generating:
- Velo.xyz data (BTC/ETH funding rates, OI, CVD) → use in crypto derivatives section
- X/Twitter posts from @KobeissiLetter, @credo__v, @layerggofficial → weave in with attribution
- Any raw data or screenshots → incorporate where relevant

---

## Step 1: Fetch Live Data (MCP tools first, browser only as fallback)

Use MCP tools for ALL data collection before writing. These always work without a browser.

### Crypto Prices & Global Data — CoinGecko MCP (ALWAYS USE FIRST)
```
mcp__coingecko__execute — get prices for: bitcoin, ethereum, solana, ripple, hyperliquid, dogecoin
mcp__coingecko__execute — get global market data (dominance, total market cap, volume)
```
Extract: price, 1h%, 24h%, 7d%, market cap, volume, circulating supply

### Crypto Derivatives — TrueNorth MCP (PRIMARY — replaces Velo for most data)
```
mcp__truenorth__derivatives_analysis — token: "bitcoin"
mcp__truenorth__derivatives_analysis — token: "ethereum"
```
Extract: OI, funding rate (annualised), liquidation map (long/short clusters, distances), imbalance ratio

### Market Indices — TrueNorth MCP
```
mcp__truenorth__market_index_price — index: "all"
```
Extract: SPX, NDX, NASDAQ, DJI, VIX, TNX (10Y yield), DXY, FTSE, DAX, Nikkei, Hang Seng

### Equity Snapshots — TrueNorth MCP
```
mcp__truenorth__stock_price_snapshot — key stocks (NVDA, INTC, SPY, QQQ, etc.)
```

### Prediction Markets — prediction-markets-mcp
```
mcp__prediction-markets-mcp__get-prediction-markets — keyword: "bitcoin"
mcp__prediction-markets-mcp__get-prediction-markets — keyword: "federal reserve"
mcp__prediction-markets-mcp__get-prediction-markets — keyword: "recession"
mcp__prediction-markets-mcp__get-prediction-markets — keyword: "inflation"
mcp__prediction-markets-mcp__get-prediction-markets — keyword: "Trump"
```
Extract: market name, platform, odds (%), volume ($). If Polymarket times out, flag as estimated and use web search.

### Macro & News — WebSearch
```
WebSearch: "SPX NDX DXY gold WTI crude oil prices [date]"
WebSearch: "crypto bitcoin news today [date] ETF flows"
WebSearch: "NVDA nvidia AI news [date]"
WebSearch: "geopolitical risk market news [date]"
WebSearch: "most active stocks today [date]"
WebSearch: "bitcoin fear greed index [date]"
WebSearch: "ASX 200 [date]"
```

### Top Volume Stocks — Yahoo Finance
```
WebFetch: https://finance.yahoo.com/markets/stocks/most-active/
```
Extract top 10 by volume: ticker, price, change%, volume, driver

### Velo.xyz — Browser ONLY if TrueNorth doesn't cover CVD/per-exchange data
If TrueNorth derivatives_analysis doesn't return CVD by exchange (Binance, Bybit, OKX):
- Navigate to https://velo.xyz/futures/BTC → wait 10s → screenshot
- Navigate to https://velo.xyz/futures/ETH → wait 10s → screenshot
- Extract: CVD, funding APR, OI by exchange
- If Velo fails after 3 attempts → tag all data (est.) with amber badge

### CoinGlass — Browser ONLY for Fear & Greed if not available elsewhere
Navigate to https://coinglass.com → extract Fear & Greed index, BTC dominance, long/short ratio

---

## Step 2: Write the Briefing

After all data is collected, write the full briefing as a single HTML file.

### Voice & Style
- Each section opens with 1–3 sentences of actual analysis — a stated view, not a recap
- Take a position. Say what the path of least resistance is. Say what you would watch.
- Short, punchy paragraphs (3–5 sentences max per block)
- Bold tickers, prices, bill numbers, key names
- **Banned phrases**: "markets face uncertainty", "crypto remains volatile", "mixed signals"
- Flag data limitations inline with `(estimated)` or `(est.)` badges
- Prediction market / Polymarket odds cited as probability % (e.g. "67% Yes"), never as prices

### HTML Output Format
Render as a styled HTML file with this color system:
- Background: `#F4F6FB` | Body text: `#1a1a2e`
- Header + TL;DR: dark navy `#1B3A6B` / `#243F70`
- Analysis blocks: blue left border `#185FA5`, background `#EBF3FC`
- Geopolitical alerts: amber left border `#EF9F27`, background `#FEF3E0`
- Prediction market section: green left border `#3B6D11`, background `#EAF3DE`
- Positive values: `#3B6D11` | Negative values: `#A32D2D`
- LIVE data badges: green `#D4EDDA` text `#3B6D11`
- Estimated data badges: amber `#FFF3CD` text `#856404`

### Required CSS classes (use consistently)
```css
.analysis-block  /* blue left-border analysis callout */
.geo-alert       /* amber left-border geopolitical/risk alert */
.pred-block      /* green left-border prediction market callout */
.implication     /* ⚡ Implication footer for each section */
.level-box       /* 4-column key levels grid */
.two-col         /* 2-column card grid */
.badge-live      /* green LIVE badge */
.badge-est       /* amber estimated badge */
.badge-vol       /* red Vol Spike badge */
.badge-event     /* dark red event badge (earnings, votes, etc.) */
.pos / .neg / .neutral  /* colored change values */
```

### Title
The HTML header title must read: **"The Morning Edge ☀️"** (with sun emoji after the name).
The `<title>` tag must also include the ☀️ emoji.

### Back navigation
Always include at the very top before `.page-wrap`:
```html
<div style="font-family:sans-serif;font-size:12px;padding:8px 16px;background:#0A1628;">
  <a href="../../index.html" style="color:#8BA4C0;text-decoration:none;">← All Briefings</a>
</div>
```

### File naming & saving
Save as `market-briefing.html` in `C:\Users\Tony\Documents\briefings-site\briefings\YYYY-MM-DD\`
Use today's actual date. HTML only — no PDF.

---

## Section Order & Requirements

Run sections in this order. Every section MUST contain a stated position/view.

### 1. 🌍 Global Macro Snapshot
Analysis: What is the single dominant macro variable today? State the path of least resistance.
Include RBA/APAC context if any rate decisions or data releases are due.
Table: SPX, NDX, Dow, VIX, ASX 200, Nikkei, Hang Seng, 10Y yield, 30Y yield, DXY, Gold, WTI — level, 1D, read.
Flag any prediction market signal that contradicts or confirms the macro view.
⚡ Implication: One sentence on positioning.

### 2. 📈 Equities & Sector Rotation
Analysis: Risk-on or risk-off? What is rotating and why? Take a view on whether the trend continues.
Two-column cards: Overweight/Into vs Underweight/Avoid with specific reasoning.
Top Volume Table: Top 8–10 highest-volume stocks. Show: Ticker | Sector | Price | Change% | Volume | Driver.
Bold any unusual volume spikes (>2x average) with a `Vol Spike` badge. State what the volume signals.
Include earnings or calendar events with an `Event` badge.
⚡ Implication: One sentence on the rotation trade.

### 3. 💹 Bitcoin & Crypto Markets
Analysis: What is BTC's structural setup — accumulating or distributing? State a directional view.
Use TrueNorth derivatives as the primary smart-money signal. Use Fear & Greed for sentiment.
Callout box: Major developments from past 48h (ETF flows, regulatory actions, whale moves).
Main table: BTC, ETH, SOL, XRP, HYPE, DOGE — price, 1D, 7D, funding (annualised), OI, 24h vol, MCap.
Key Level Boxes (4-column): BTC Price / Fear & Greed / BTC Dominance / Short Liq Trigger
Two-column cards:
  Left — Derivatives detail: OI, funding, liquidation map, imbalance (from TrueNorth)
  Right — ETF flow detail + whale intelligence (from web search)
⚡ Implication: One sentence on the crypto trade.

### 4. 🎯 Prediction Market Intelligence
Analysis: What are prediction markets signalling that price action and media aren't?
Lead with what the volume data shows — where are bettors putting the most money today?
Top Markets Table: Top markets by volume. Columns: Market Name | Category | Leading Outcome | Odds | Volume
Flag estimated data clearly. Note Polymarket timeout if it occurred.
Two-column cards: Macro/Geopolitical markets (Left) vs Crypto/Tech markets (Right)
⚡ Implication: One sentence on what prediction markets are pricing that traditional markets aren't.

### 5. 🤖 AI & Semiconductor Watch
Analysis: AI capex supercycle accelerating or showing fatigue? Take a view on NVDA and semis.
Two-column cards: Key stock/event detail / Broader landscape (TSMC, AMD, Broadcom, export controls)
⚡ Implication: One sentence on the trade.

### 6. 🌐 Geopolitical Calendar
Amber alert boxes: One box per active risk event.
For each: explain the TRANSMISSION MECHANISM (how it's moving markets) + what the reversal looks like.
Don't just state the event — explain exactly how it flows through to asset prices.

### 7. 🔭 Today's Watchlist
Exactly 5 items. Format: numbered list with bold title, level/event, one sentence on why it matters today.
Items should be specific and actionable — a price level, a scheduled event, or a data release.

---

## Source Priority

### Crypto Derivatives & Sentiment
1. TrueNorth MCP (`mcp__truenorth__derivatives_analysis`) — OI, funding, liquidation map (PRIMARY)
2. CoinGecko MCP (`mcp__coingecko__execute`) — prices, market caps, volumes (PRIMARY)
3. Velo.xyz (browser) — CVD per exchange, basis (use only if TrueNorth doesn't cover it)
4. CoinGlass (browser) — Fear & Greed, dominance (use only if not available via web search)

### Prediction Markets
1. prediction-markets-mcp (`mcp__prediction-markets-mcp__get-prediction-markets`) — PRIMARY
2. polymarketanalytics.com (browser) — if MCP fails
3. Web search for Polymarket data — fallback if all above fail; flag as estimated

### Market Indices & Equities
1. TrueNorth MCP (`mcp__truenorth__market_index_price` + `mcp__truenorth__stock_price_snapshot`) — PRIMARY
2. Web search (Reuters, CNBC, Yahoo Finance) — for context and news drivers

### Macro & News
1. WebSearch — for news, context, earnings, geopolitical events
2. WebFetch Yahoo Finance — for top volume stocks

---

## What to Avoid
- Vague language ("markets face uncertainty", "crypto remains volatile")
- Sections with no stated view
- Generic summaries without specific data points
- Skipping the liquidation map data from TrueNorth derivatives
- Skipping the Top Volume Stocks table — mandatory every briefing
- Skipping the Prediction Market section even if data is estimated
- Citing paywall bypass tool — always cite the original publication
- Using the browser when MCP tools can provide the same data
