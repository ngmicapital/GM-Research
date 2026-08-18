# Cloud Market-Briefing routine — current instructions (Pyth-primary)

> **This is a local READ-ONLY copy for review.** The authoritative, editable version is the
> prompt of the cloud routine **"Market Briefing Daily (Cloud TEST — review branch)"** at
> **claude.ai/code/routines** (trigger id `trig_015Qx7h2gbj4rU27mcggKVNJ`). Editing THIS file
> does nothing — edit the routine in claude.ai, or tell me to push changes to it.
>
> **Before running:** enable the **Pyth** connector on this routine (it currently has 7
> connectors; Pyth isn't one — I couldn't add it from the CLI session). The routine is
> DISABLED (won't fire on its own); you Run it manually. It publishes to a throwaway
> `cloud-test/...` branch, never to main.

---

# Market Briefing Daily — CLOUD TEST RUN (Pyth-primary, review branch, NOT main)
# Second cloud test of the Morning Edge market briefing. The PRODUCTION job runs
# LOCALLY at 06:32 AEST and already publishes to main daily — this cloud run is a
# QUALITY TEST ONLY and must NEVER push to main or touch the live site. It writes
# to a fresh review branch for dc to read before deciding whether to promote cloud
# generation for this briefing type.
#
# DATA STRATEGY (this is the whole point of the test): use the **Pyth** connector as
# the PRIMARY live price source (it is first-party oracle data, free to read, and
# works in this cloud environment), and server-side `curl` to free public JSON APIs
# for everything Pyth doesn't carry (derivatives, prediction markets, dominance,
# Fear&Greed). Do NOT rely on the WebFetch TOOL for market data — it gets 403'd from
# this datacenter; `curl`/Node https from Bash works where the tool does not.
#
# PREREQUISITE: the Pyth connector must be enabled on THIS routine. If Pyth's tools
# are not available when you start, note that in your summary and proceed with the
# curl sources below (do not abort).

Working directory: /home/user/GM-Research (checked out from ngmicapital/GM-Research).

## Step 0 — Date + branch (AEST)
```bash
cd /home/user/GM-Research
git fetch origin main && git checkout main && git pull --rebase origin main
AEST_TODAY=$(TZ=Australia/Sydney date +%Y-%m-%d)
AEST_HUMAN=$(TZ=Australia/Sydney date +"%A, %-d %B %Y")
BRANCH="cloud-test/market-briefing-${AEST_TODAY}-$(date +%H%M)"
git checkout -b "$BRANCH"
```
Use $AEST_TODAY for every date — never the UTC date. The real market-briefing.html for
today usually already exists on main (local job runs first); that's fine — this test
writes DIFFERENT files so it never collides:
content-${AEST_TODAY}-cloudtest.json (draft) and market-briefing.cloudtest.html (note the
.cloudtest suffix — do NOT overwrite the real files).

## Step 1 — Gather data
First run `node scripts/recent-coverage.js market-briefing` for the since-yesterday delta.
Then read skills-briefings-files/briefing-morning-edge/content-guide.md — it is your output
contract (voice, sections, JSON shape). The guide assumes richer local MCP data than the
cloud has; the DATA-SOURCE MAP below overrides its "fetch" instructions for this run.

### A. Pyth connector — PRIMARY for live prices (crypto, equities, metals)
If Pyth tools are available, use them first (they give price + confidence interval, high
quality). Steps: call Pyth **Get symbols** once to see the exact feed names available, then
**Get latest price** for the ones you need, and **Get candlestick data** for any technical
read. Expect symbol formats like `Crypto.BTC/USD`, `Crypto.ETH/USD`, `Crypto.SOL/USD`,
`Equity.US.NVDA/USD`, `Metal.XAU/USD`. Pull:
- Crypto majors: BTC, ETH, SOL (price + intraday move).
- Equities/semis IF present in the symbol list: NVDA, and SPY/QQQ or an S&P feed if Pyth
  carries one; otherwise get these from Yahoo in step C.
- Gold (Metal.XAU/USD). Also WTI/oil if Pyth lists a commodity feed for it.
Tag every Pyth-sourced number as LIVE (`<span class="live-badge">LIVE</span>` as the first
element of that section body, per the content-guide). If Pyth is unavailable or lacks a
feed, fall through to the curl sources — do not fabricate.

### B. Derivatives (OI + funding) — Pyth does NOT cover this; use curl
Bybit FIRST (Binance often returns 451 from US datacenters; Bybit gives price + OI +
funding in one call):
```bash
curl -s --max-time 15 "https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT"
curl -s --max-time 15 "https://api.bybit.com/v5/market/tickers?category=linear&symbol=ETHUSDT"
```
(fields: lastPrice, openInterest, openInterestValue, fundingRate, price24hPcnt). If Bybit
fails, try Binance `https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT` +
`.../premiumIndex?symbol=BTCUSDT`, or OKX `https://www.okx.com/api/v5/public/open-interest?instId=BTC-USDT-SWAP` + `/public/funding-rate`.
**Liquidation CLUSTERS / heatmap are NOT available for free — do NOT invent them.** State
"liquidation-cluster map unavailable this run" and lean the derivatives read on OI + funding
+ Fear&Greed instead. Annualize funding consistently and show the raw rate too.

### C. Macro indices + equities Pyth lacks — curl Yahoo v8 (browser UA)
```bash
UA='Mozilla/5.0 (compatible; gm-research/1.0)'
for S in '%5EGSPC' '%5EVIX' 'DX-Y.NYB' 'CL=F' 'GC=F' 'NVDA'; do
  curl -s --max-time 15 -H "User-Agent: $UA" "https://query1.finance.yahoo.com/v8/finance/chart/$S?interval=1d&range=5d"; echo; done
```
(read .chart.result[0].meta.regularMarketPrice and .chartPreviousClose → % change.
^GSPC=S&P500, ^VIX=VIX, DX-Y.NYB=DXY, CL=F=WTI, GC=F=gold.) These are web-sourced — tag
them EST (`<span class="est-badge">EST</span>`), not LIVE.

### D. Dominance + total market cap — curl CoinGecko
```bash
curl -s --max-time 15 -H "User-Agent: Mozilla/5.0" "https://api.coingecko.com/api/v3/global"
```
(data.market_cap_percentage.btc = BTC dominance; data.total_market_cap.usd; data.market_cap_change_percentage_24h_usd.) CoinGecko simple/price is also a fine crypto-price fallback if Pyth is down: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`.

### E. Prediction markets — curl Polymarket + Kalshi
```bash
curl -s --max-time 15 "https://gamma-api.polymarket.com/markets?closed=false&order=volume24hr&ascending=false&limit=6"
curl -s --max-time 15 "https://api.elections.kalshi.com/trade-api/v2/markets?limit=12&status=open"
```
Pick 2-3 markets relevant to today's macro/crypto/political narrative; store each market's
question + YES price/odds + volume. Tag EST.

### F. Fear & Greed — curl
```bash
curl -s --max-time 15 "https://api.alternative.me/fng/?limit=1"
```
(data[0].value + value_classification.)

### Hard rules
- **NEVER ABORT, NEVER FABRICATE.** Any datum you couldn't get → omit the line or mark it
  EST; never invent a number, a liquidation level, or a funding percentile. A shorter,
  fully-sourced briefing beats a complete-looking one with invented data.
- LIVE badge = Pyth only. EST badge = every curl/web source. Say clearly in each section
  where the numbers came from.

Write ONLY the content JSON to:
skills-briefings-files/briefing-morning-edge/drafts/content-${AEST_TODAY}-cloudtest.json

## Step 2 — Render (deterministic, zero AI)
```bash
node scripts/render-briefing.js market-briefing \
  skills-briefings-files/briefing-morning-edge/drafts/content-${AEST_TODAY}-cloudtest.json \
  briefings/${AEST_TODAY}/market-briefing.cloudtest.html
```
Exit non-zero → read the validation error, fix only what failed in the content JSON yourself
(you are the writer; no subagent to delegate to), re-render. Up to 2 attempts. Never hand-edit
the HTML. If it still fails after 2 tries, commit what you have with a clear note and explain
in the summary (do NOT fall back to free-form HTML).

## Step 3 — Commit to the review branch (NOT main, NOT publish-briefing.js)
```bash
node scripts/generate-index.js
git add "skills-briefings-files/briefing-morning-edge/drafts/content-${AEST_TODAY}-cloudtest.json" \
        "briefings/${AEST_TODAY}/market-briefing.cloudtest.html"
git commit -m "Cloud test (Pyth): market-briefing for ${AEST_TODAY} (review branch, not for publish)"
git push -u origin "$BRANCH"
```
Do NOT run publish-briefing.js and do NOT push to main or merge.

## Final summary (make it genuinely useful to dc)
Report, precisely: (1) whether the **Pyth** connector was available and which feeds/prices you
got from it (this is the key signal — did Pyth work in the cloud?); (2) which numbers came from
Pyth (LIVE) vs each curl source (EST), per section; (3) which curl sources succeeded vs
failed (esp. did Bybit/Binance work, or geo-block?); (4) the branch name + GitHub review link;
(5) any render validation failures and how you fixed them; (6) your one-line honest quality
read (publish-ready, or rough). Precision about what worked beats a polished summary.
