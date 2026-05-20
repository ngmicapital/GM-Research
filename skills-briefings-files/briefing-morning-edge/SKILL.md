# Market Intelligence Briefing (The Morning Edge ☀️)

Produce a daily pre-market intelligence briefing for an independent crypto trader using Wyckoff
methodology, based in Sydney, Australia. Every section must contain a stated view or thesis — not
just a summary of news. Think am/FX by Brent Donnelly: opinionated, specific, trader-first.

## CANONICAL DESIGN REFERENCE

**The template to follow is `briefings/2026-05-15/market-briefing.html`.** Read that file first to understand the design system. Future briefings MUST match its visual style — do NOT use older templates from before 2026-05-15.

Key visual elements (all required):
- **Inter + JetBrains Mono fonts** from Google Fonts (preconnect + stylesheet links in `<head>`)
- **Reading time badge** in the header ("~10 min read")
- **Conviction badge** at top right with color-coded background
- **Catalyst banner** (dark red) under the header for major event days
- **TOC strip** (dark blue) with 8 numbered section anchors (s1–s8)
- **TradingView iframe widgets** (`.tv-widget`) — 3-column grid in macro and crypto sections
- **8 sections** in this order: Macro / Equities / Crypto / Regulatory / AI & Semis / Prediction / Geopolitical / Watchlist
- **Section number circles** (`.section-num`) prefixing each section title
- **Analysis blocks** (`.analysis`) blue / **Geo alerts** (`.geo-alert`) amber / **Pred blocks** (`.pred-block`) green / **Learn blocks** (`.learn-block`) purple / **Callouts** (`.callout`) orange
- **Implications** (`.implication--macro/equities/crypto/ai/pred/reg/geo`) themed by section
- **Key boxes** (`.key-boxes`) 4-column metric display
- **Fear & Greed gauge** with linear-gradient bar and marker
- **Live / Est / Vol Spike / Event** badges in tables
- **`td.pos` and `td.neg`** with gradient backgrounds (not flat color)
- **Footer** with data sources + disclaimer

## CRITICAL: DO NOT INCLUDE
- **No "← All Briefings" back navigation bar** at the top of the body. Begin `<body>` directly with `<div class="page-wrap">`. The site already handles navigation via the index page. This bar was removed on 2026-05-20.

## Trigger

Phrases: "briefing", "morning briefing", "run the briefing", "daily briefing"

If the user has pasted any of the following, incorporate it directly before generating:
- Velo.xyz data (BTC/ETH funding rates, OI, CVD) → use in crypto derivatives section
- X/Twitter posts from @KobeissiLetter, @credo__v, @layerggofficial → weave in with attribution
- Any raw data or screenshots → incorporate where relevant

---

## Step 1: Fetch Live Data (MCP tools FIRST, browser only as fallback)

Use MCP tools for ALL data collection before writing. These always work without a browser.

### Crypto prices & global — CoinGecko MCP (ALWAYS USE FIRST)
```
mcp__coingecko__execute — markets.get for: bitcoin, ethereum, solana, ripple, hyperliquid, dogecoin
mcp__coingecko__execute — global.get for dominance, total market cap, volume
```

### Derivatives — TrueNorth MCP (PRIMARY for liquidation map & funding)
```
mcp__truenorth__derivatives_analysis — token: "bitcoin"
mcp__truenorth__derivatives_analysis — token: "ethereum"
```
Returns: OI, funding rate (annualised), liquidation map (long/short clusters with USD amounts and distance %), imbalance ratio

### Market indices — TrueNorth MCP
```
mcp__truenorth__market_index_price — index: "all"
```
Returns: SPX, NDX, NASDAQ, DJI, VIX, TNX (10Y), DXY, FTSE, DAX, Nikkei, Hang Seng

### Equity snapshots — TrueNorth MCP
```
mcp__truenorth__stock_price_snapshot — NVDA, INTC, SPY, QQQ, plus any session-relevant tickers
```

### Prediction markets
```
mcp__prediction-markets-mcp__get-prediction-markets — keyword: "bitcoin"
mcp__prediction-markets-mcp__get-prediction-markets — keyword: "federal reserve"
mcp__prediction-markets-mcp__get-prediction-markets — keyword: "recession"
mcp__prediction-markets-mcp__get-prediction-markets — keyword: "inflation"
```
If Polymarket times out, flag data as `<span class="est-badge">EST</span>` + a `<span class="est-badge">Polymarket MCP Timeout</span>` next to the section title.

### News & macro — WebSearch
```
WebSearch — "crypto bitcoin news today [date] ETF flows whale"
WebSearch — "NVDA nvidia AI semiconductor news [date]"
WebSearch — current major macro story (Fed, Moody's, CPI, etc.)
WebSearch — "geopolitical risk market [date]"
WebSearch — "most active stocks today [date]"
WebSearch — "bitcoin fear greed index [date]"
WebSearch — "ASX 200 [date]"
WebSearch — "DXY gold WTI crude [date]"
```

### Top volume stocks
```
WebFetch — https://finance.yahoo.com/markets/stocks/most-active/
```
Extract top 8–10: ticker, sector, price, change%, volume, driver

### Velo.xyz — Browser ONLY if TrueNorth doesn't return CVD by exchange
Only fall back to browser if `mcp__truenorth__derivatives_analysis` doesn't provide per-exchange CVD (Binance, Bybit, OKX). Otherwise skip.

---

## Step 2: Write the Briefing

After all data is collected, write the full HTML following the May 15 template.

### Voice & Style
- Each section opens with a bold one-sentence directional view, then 2–3 sentences of analysis
- Take a position. Say what the path of least resistance is. Say what you would watch.
- Bold tickers, prices, bill numbers, key names
- **Banned phrases**: "markets face uncertainty", "crypto remains volatile", "mixed signals"
- Flag data limitations inline with `<span class="est-badge">EST</span>` badges
- Live MCP data gets `<span class="live-badge">LIVE</span>` next to section titles
- Prediction market odds cited as probability % (e.g. "62% Yes"), never as prices

### HTML Structure (in order)
1. `<head>` with Inter + JetBrains Mono Google Fonts preconnect/link
2. Full `<style>` block (copy from 2026-05-15 template)
3. `<body>` → directly `<div class="page-wrap">` (NO back-nav bar)
4. `.header` with title "The Morning Edge ☀️", date, reading time, conviction badge
5. `.catalyst-banner` (if major event day) — dark red, single line
6. `.toc-strip` with 8 anchor links (#s1 through #s8)
7. `.tldr` with thesis paragraph
8. `.container` wrapping all 8 sections
9. `.footer` with data sources

### Title
HTML `<title>` tag: `The Morning Edge ☀️ - [DD Month YYYY]`
Header `<h1>`: `The Morning Edge &#9728;&#65039;` (renders as "The Morning Edge ☀️")

### File saving
Save to: `C:\Users\Tony\Documents\briefings-site\briefings\YYYY-MM-DD\market-briefing.html`

---

## Section Order & Requirements

Every section MUST contain a stated position/view. Use the May 15 template's exact structure.

### 1. 🌍 Global Macro Snapshot
- Bold one-sentence thesis (dominant macro variable today)
- 3-column TradingView grid: SPX, US 10Y (or WTI), DXY
- Table: SPX, Nasdaq 100, Dow, ASX 200, Nikkei, Hang Seng, VIX, 30Y, 10Y, DXY, Gold, WTI
- `.analysis` block with deeper context
- `.implication implication--macro` footer

### 2. 📈 Equities & Sector Rotation
- Thesis
- 2-col cards: Overweight (green dot) vs Underweight (red dot)
- Top Volume Stocks table (8–10 rows) with Vol Spike / Event badges as appropriate
- `.callout` for key signal
- `.implication implication--equities`

### 3. 💹 Bitcoin & Crypto Markets
- Thesis (Wyckoff phase context: accumulation / markup / distribution / markdown)
- 3-column TradingView grid: BTC/USD, ETH/USD, **Fear & Greed gauge** (third widget is a custom div with the gauge)
- `.callout` for 48h developments
- Crypto market table: BTC, ETH, SOL, XRP, HYPE, DOGE — Price, 1D, 7D, Funding (ann.), 24h Vol, OI, MCap
- `.key-boxes` 4-column: BTC Key Levels, F&G, BTC Dominance, Short Liq Trigger
- 2-col cards: Derivatives Detail (TrueNorth) / ETF & Whale Intelligence
- `.implication implication--crypto`

### 4. ⚖️ Regulatory & Legal Radar
- Thesis (active bills/rulemakings today)
- 2-col cards: Active Legislation / Today's Decision Points
- `.implication implication--reg`

### 5. 🤖 AI & Semiconductor Watch
- Thesis on AI capex cycle (accelerating/broadening/fatiguing)
- 2-col cards: Key earnings/movers / Broader landscape
- `.learn-block` purple for educational context
- `.implication implication--ai`

### 6. 🎯 Prediction Market Intelligence
- Thesis on what prediction markets signal vs equity markets
- Top Markets by Volume table (8–10 rows)
- `.pred-block` for trending
- 2-col cards: Macro & Geopolitical / Crypto & Tech
- `.implication implication--pred`

### 7. 🌐 Geopolitical Calendar
- 3–5 `.geo-alert` blocks (amber). Each has:
  - **Status:** current state
  - **Transmission Mechanism:** how it flows to asset prices
  - **Reversal:** what signal would change the read
- `.implication implication--geo`

### 8. 🔭 Today's Watchlist
- Exactly 5 numbered items in an `<ol>`
- Each: bold title, level/event, one specific actionable sentence

---

## What to Avoid
- Vague language ("markets face uncertainty", "crypto remains volatile")
- Sections with no stated view
- Generic summaries without specific data points
- **The "← All Briefings" back-nav bar** (removed 2026-05-20)
- Using the older April template style (no Inter font, no TOC, no TradingView widgets)
- Skipping the liquidation map data from TrueNorth derivatives
- Skipping the Top Volume Stocks table — mandatory every briefing
- Skipping the Prediction Market section even if data is estimated
- Using the browser when MCP tools can provide the same data
- Citing paywall bypass tools — always cite the original publication
