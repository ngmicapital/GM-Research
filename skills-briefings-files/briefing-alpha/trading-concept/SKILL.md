---
name: trading-concept
description: >
  Generate a daily Alpha briefing — a deep, visual explainer of a single trading concept.
  Primary focus: orderflow & microstructure concepts (Order Flow, Orderbook Depth, Bid/Ask
  Imbalance, Absorption, Spoofing/Iceberg, Sweep Orders, CVD, Delta Divergence, Footprint,
  Liquidity Heatmaps, Stop Clusters, Passive vs Aggressive Flow). Each briefing teaches one
  concept end-to-end: plain-English definition, mechanics with formulas, inline SVG diagrams,
  how traders actually use it, a live BTC/ETH tape example, quotes from pros, common beginner
  traps, and further reading. Trigger whenever the user says "alpha", "alpha brief", "alpha
  briefing", "run alpha", "trading concept", "concept brief", "concept briefing", "run the
  concept brief", "today's trading concept", "briefing concept", or any variation requesting
  a trading-education briefing. Also trigger when a scheduled task invokes this skill.
  Selects a fresh concept each day by scanning previous trading-concept briefings to avoid
  duplicates. Output is a styled HTML file saved locally and published to the GitHub
  briefings archive at ngmicapital/GM-Research.
---

# Alpha — Trading Concepts Briefing

You are generating an **Alpha** brief for Tony — an independent crypto trader running NGM Capital, Wyckoff-native, Sydney-based. He's already an experienced operator; the brief is not an entry-level tutorial. It is a *crisp, visual, reference-grade explainer* of one trading concept per day that he can screenshot, save, and come back to.

Target read time: **4–6 minutes skim, 10–12 minutes full read**. Follow these instructions exactly.

## Connected Tools Required
- Web Search — locate pro explanations, trader threads, recent examples
- Web Fetch — pull source material from X posts, substacks, trading blogs

---

## STEP 0 — PICK THE CONCEPT

### 0A. Scan recent briefings to avoid duplicates
The local briefings archive lives at `C:\Users\Tony\Documents\briefings-site\briefings\`. List the last 30 date folders; for each, check whether `trading-concept.html` exists. Extract the concept covered (in the `<title>` and `<h1>` — e.g. "Alpha — Liquidations"). Build a `covered` set.

### 0B. Pick a fresh concept

**Preferred focus: orderflow & microstructure family.** Priority concepts to rotate through first (the core curriculum):
- Order Flow (market vs limit orders, aggression)
- Orderbook Depth & Spread
- Bid/Ask Imbalance
- Absorption (passive size eating aggressive flow)
- Spoofing & Iceberg Orders
- Sweep Orders / Sweeping the Book
- Market Maker vs Taker Dynamics
- Liquidity Voids / Air Pockets
- Cumulative Volume Delta (CVD)
- Delta Divergence
- Tape Pace & Speed of Tape
- Large Prints & Block Trades
- Footprint Charts / Volume-at-Price
- Liquidity Heatmaps (reading & trading)
- Stop Clusters & Magnet Zones
- Passive vs Aggressive Order Flow
- Open Interest Dynamics (tape-adjacent)
- Funding + OI + Price decoder
- Auction Market Theory basics (as microstructure foundation)

**Only go outside the orderflow family when:** (a) a specific concept is highly relevant to current tape (e.g. extreme funding, major Wyckoff event, structural regime shift) — OR (b) the user explicitly requests a concept outside orderflow (e.g. "alpha on Fibonacci").

Additional picker heuristics:
- **Actively relevant** to current BTC/ETH tape
- **Requested implicitly** — if the trigger names a concept, use that directly
- **Trending on trader X** — a recent viral educational thread is fair game

### 0C. Confirm the pick
Before writing, state:
```
PICKED: {concept name}
Category: {category}
Why this one today: {1-sentence reason}
Previous concepts (last 14 days): [list]
```

---

## STEP 1 — RESEARCH

Collect material before drafting. Run fetches in parallel.

### 1A. Anchor the definition
- Search: `"{concept}" trading explained [current year]`
- Search: `"{concept}" definition crypto trading`
- Fetch 2–3 authoritative explainers (Investopedia, CME, Binance Academy, Bybit Learn, Coinglass docs, tradingview.com/support)
- If sources disagree on a nuance, note it inline with [Sources differ]

### 1B. Pull pro explanations & quotes
- Web search: `site:x.com "{concept}" thread`
- Web search: `"{concept}" Wyckoff` (where relevant)
- Known accounts: @KobeissiLetter, @credo__v, @layerggofficial, @Luckshuryy, @CredibleCrypto, @TheCryptoDog, @AltcoinPsycho, @Pentosh1, @SmartContracter, @RaoulGMI, @100trillionUSD, @trader_dante, @TraderSZ
- Target 1–3 high-signal quotes (≤25 words each). Always attribute and link.

### 1C. Find real examples on today's tape
- Web search for BTC/ETH intraday moves in the last 24–48h
- Note TradingView, Velo, or Coinglass URLs
- If no current fit, use the most recent historical example honestly: "No current example — last clear instance was BTC 2024-10 accumulation."

### 1D. Further reading
- Target 3–5 links: 1 canonical thread, 1 video, 1 book chapter, 1 deeper technical source
- Verify all links resolve

### Source Failure Rule
If unreachable: "Source unavailable: [name] — [reason]". Never fabricate.

### Honesty Rule
If a concept is more hype than substance (e.g. some rebadged orderflow terminology), **say so in Common Traps**. Tony respects frank writing.

---

## STEP 2 — WRITE THE HTML

### Structure
8 sections plus header/TL;DR/footer. Every section: **skim line** (one-sentence highlighted bar) + **detail content** below. No collapsibles.

### Voice
- Open with a stated position, not a wiki definition
- Short punchy paragraphs (3–5 sentences)
- Bold: concept terms, trader names, price levels, key metrics
- Assume familiarity with candles, timeframes, long/short
- Flag speculation: [Analyst Opinion] [Unconfirmed]
- BANNED: "could potentially", "remains to be seen", "it is worth noting", "some traders believe"

### Colour System (lime-yellow terminal palette)
- Primary accent: `#a3e635` (lime-yellow)
- Secondary accent: `#fbbf24` (amber) — warnings, traps
- Background: `#faf8f5`
- Dark card bg: `#1c1917` — Live Tape (terminal vibe)
- Green (bullish / longs): `#22c55e` | Red (bearish / shorts / liqs): `#ef4444`
- Text primary: `#1c1917` | Text secondary: `#44403c` | Text muted: `#78716c`
- Border: `#e7e5e4`
- Formula bg: `#fef3c7` with text `#78350f`

### Fonts (Google Fonts)
- **DM Serif Display** — headers and concept title
- **Inter** — body
- **JetBrains Mono** — formulas, pills, data labels

### Layout
- Max-width 1160px, centred
- Left sticky TOC — **collapsed by default** (width 40px, shows only a `☰` toggle button). Click to expand to 188px. `id="toc"` on the `<aside>`; button uses `onclick="document.getElementById('toc').classList.toggle('toc-open')"`. TOC links live inside a `.toc-body` div (hidden until `.toc-open` is set). DM Mono 11px for links.
- Main column flex: 1
- Mobile (<860px): toggle button hidden; `.toc-body` forced `display:flex!important` as horizontal scroll strip; sections stack

### Mandatory site-index elements
Include so `generate-index.js` extracts headline + preview:
```html
<p class="tldr-text">{One sentence: "{Concept} is [what it is]; [why it matters]."} {One sentence with practical takeaway.}</p>
```

### Match the canonical template
Reference `C:\Users\Tony\Documents\briefings-site\briefings\2026-04-24\trading-concept.html` (Issue #2 — CVD) as the canonical template — same CSS variables, section headers, skim-bar styling, formula block, practice cards, quote styling, trap styling, fr-item further-reading layout, and **toggleable TOC**. Copy its `<style>` block and HTML structure verbatim for consistency across issues.

---

## BRIEFING STRUCTURE

### HEADER
- Pretitle: "Alpha · Trading Concepts · Daily"
- H1: `<em>Alpha</em> — {Concept Name}`
- Meta: Day · date · Sydney · Issue #N (count of previous trading-concept HTML files + 1) · reading-time pill

### TL;DR
One paragraph in `<p class="tldr-text">`. Elevator pitch + practical takeaway. No bullet lists.

### §01 — WHAT IT IS
**Skim**: 1-sentence plain-English definition.
**Details**: 2–3 paragraphs; glossary pill row (3–5 terms with one-line defs); end with a `.remember` callout: "If you only remember one thing: {core insight}".

### §02 — MECHANICS
**Skim**: 1 sentence on *how* the mechanic produces the signal.
**Details**: Step-by-step walkthrough; formulas in `<div class="formula">` (JetBrains Mono, amber bg); variant comparison as 2-col table if applicable.

### §03 — VISUAL (mandatory — at least one inline SVG)
**Skim**: What the diagram shows.
**Details**: **At least one inline SVG** — the signature of the brief. No external assets. Two diagrams if warranted.
- viewBox `0 0 800 420` minimum, `width="100%"`, `preserveAspectRatio="xMidYMid meet"`, palette accents, labelled via `<text>`
- Good orderflow-family diagrams:
  - *Order Flow*: orderbook with bid/ask walls, aggressor arrows hitting the book
  - *CVD*: price chart + CVD curve underneath, divergence zone highlighted
  - *Absorption*: stacked bid wall holding against red prints
  - *Footprint*: candle with bid/ask volume numbers at each price
  - *Heatmap*: time × price grid with yellow magnet zones
  - *Sweep*: L2 book snapshot before/after a sweep order
  - *Spoofing*: pull-animation schematic showing fake size yanked before fill
- Italicised caption under each SVG

### §04 — IN PRACTICE
**Skim**: The one rule or heuristic that matters most.
**Details**: 3–4 numbered practice cards (big italic serif numeral + headline + 2-sentence body); confluence matrix optional; worked entry/exit example with specific prices + R math; end with `.tf-note`: "Timeframe fit: {e.g. '5m–1h execution, 4h+ bias'}".

### §05 — LIVE TAPE
**Skim**: Where the concept is showing up on current tape.
**Details**: Dark card (`.tape`, bg `#1c1917`, text `#fafaf9`); real specific instance from last 24–48h (or honest historical); numbers table with price levels and times (Sydney + UTC); TradingView widget iframe:
```html
<iframe src="https://s.tradingview.com/widgetembed/?symbol=BINANCE:BTCUSDT.P&interval=240&theme=dark" style="width:100%;height:420px;border:0;" loading="lazy"></iframe>
```
End with `.read` callout: "**Read:** {one sentence on what the concept reveals about current positioning}".

### §06 — QUOTES
**Skim**: Why these voices matter.
**Details**: 2–4 quotes (≤25 words each), pull-quote style (lime-yellow left border, italic). Mix eras — at least one classic (Wyckoff, Livermore, Dalton, Schwager, Dalio, Brett Steenbarger) + at least one current X trader. Attribution: Name · Source · Year · Link.

### §07 — COMMON TRAPS
**Skim**: The single biggest mistake.
**Details**: 3–5 numbered traps — bold title + 1–2 sentence fix. Amber `#fbbf24` left border. At least one honest "overhyped" callout where warranted (use `.trap.anti` variant with neutral grey border).

### §08 — FURTHER READING
**Skim**: Where to go deeper.
**Details**: 3–5 `.fr-item` rows — type label (Thread/Video/Book/Article/Guide/Forensic) + linked title + one-line description. Only links actually fetched in Step 1.

### FOOTER
Sources list; "Alpha · Issue #N · {date} · Sydney · NGM Capital"; disclaimer: "Education, not advice. Trade your own system."

---

## STEP 3 — SAVE & PUBLISH

### 3A. Save HTML
- **Windows:** `C:\Users\Tony\Documents\briefings-site\briefings\YYYY-MM-DD\trading-concept.html`
- **Cloud/Linux:** `/tmp/trading-concept-YYYY-MM-DD.html`

Create the date folder if missing.

### 3B. Publish to GitHub

```python
python3 << 'PYEOF'
import base64, json, urllib.request, os, sys
from datetime import date

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
TODAY = date.today().strftime('%Y-%m-%d')
BRIEFING  = 'trading-concept'
if os.name == 'nt':
    HTML_PATH = rf'C:\Users\Tony\Documents\briefings-site\briefings\{TODAY}\{BRIEFING}.html'
else:
    HTML_PATH = f'/tmp/{BRIEFING}-{TODAY}.html'

if not GITHUB_TOKEN:
    print("GITHUB_TOKEN not set -- skipping GitHub publish.")
    sys.exit(0)

data = base64.b64encode(open(HTML_PATH, 'rb').read()).decode('ascii')
path = f'briefings/{TODAY}/{BRIEFING}.html'
url  = f'https://api.github.com/repos/ngmicapital/GM-Research/contents/{path}'
hdrs = {'Authorization': f'Bearer {GITHUB_TOKEN}', 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json'}

sha = None
try:
    res = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=hdrs)).read())
    sha = res.get('sha')
except: pass

body = {'message': f'Add {BRIEFING} for {TODAY}', 'content': data, 'branch': 'main'}
if sha: body['sha'] = sha
req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), method='PUT', headers=hdrs)
json.loads(urllib.request.urlopen(req).read())
print(f"Published: {BRIEFING} for {TODAY}")

dispatch_url = 'https://api.github.com/repos/ngmicapital/GM-Research/actions/workflows/deploy.yml/dispatches'
dispatch_req = urllib.request.Request(dispatch_url, data=json.dumps({'ref': 'main'}).encode('utf-8'), method='POST', headers=hdrs)
try:
    urllib.request.urlopen(dispatch_req)
    print("Site rebuild triggered.")
except Exception as e:
    print(f"Site rebuild trigger failed (non-fatal): {e}")

import time
print("Verifying deploy status...")
verified = False
for attempt in range(18):
    time.sleep(10)
    try:
        runs_url = 'https://api.github.com/repos/ngmicapital/GM-Research/actions/workflows/deploy.yml/runs?per_page=1'
        runs_res = json.loads(urllib.request.urlopen(urllib.request.Request(runs_url, headers=hdrs)).read())
        run = runs_res['workflow_runs'][0]
        status = run['status']
        conclusion = run.get('conclusion')
        print(f"  Deploy: {status}" + (f" / {conclusion}" if conclusion else ""))
        if status == 'completed':
            if conclusion == 'success':
                print("Deploy verified -- alpha is live.")
            else:
                print(f"Deploy FAILED (conclusion: {conclusion}) -- site index may not be updated.")
                sys.exit(1)
            verified = True
            break
    except Exception as e:
        print(f"  Status check error: {e}")
if not verified:
    print("Deploy status check timed out -- check GitHub Actions manually.")
PYEOF
```

---

## STEP 4 — CROSS-REFERENCE WITH MARKET BRIEFING

If today's Alpha directly illuminates the current tape (e.g. today's Alpha is "CVD Divergence" and this morning's Morning Edge flagged a CVD/price disconnect), note it in Live Tape with a "→ see Morning Edge" link to today's `market-briefing.html`.

---

## Quality Bar

Before declaring complete:

- [ ] Exactly ONE concept covered — no "5 concepts" dilution
- [ ] At least ONE inline SVG diagram embedded, renders without external assets
- [ ] Live Tape references a **specific** real example (date, price, what happened)
- [ ] One classic-source quote AND one current-trader quote
- [ ] Common Traps includes an honest "overhyped" callout where warranted
- [ ] All Further Reading URLs were actually fetched in Step 1 — no hallucinations
- [ ] `.tldr-text` paragraph present for site-index extraction
- [ ] Concept isn't a duplicate of anything in the last 30 days
- [ ] Concept is in the orderflow family unless there's a clear reason to go outside
- [ ] Tone: direct, practical, trader-native — no MBA-speak, no hedging filler
