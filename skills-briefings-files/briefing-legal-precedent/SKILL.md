---
name: legal-brief
description: >
  Generate a daily Legal Intelligence Brief — a research-grade report covering crypto regulation,
  AI governance, enforcement actions, market structure legislation, and cross-jurisdictional policy
  developments across US/UK/EU/Singapore/Australia. Trigger whenever the user says "legal brief",
  "legal briefing", "briefing law", "run the legal brief", "regulatory brief", "legal intelligence",
  "what's new in crypto law", "reg update", or any variation requesting a legal/regulatory intelligence
  report. Also trigger when a scheduled task invokes this skill. Searches 45+ live sources including
  regulators (SEC, CFTC, FCA, ESMA), law firm alerts, crypto policy advocates, crypto industry leaders
  (Coinbase, Ripple, Circle, Securitize, Block, rwa.xyz), and AI/tech policy outlets. Output is a
  dark-navy styled HTML file saved to the Daily Briefings folder and published to the GitHub briefings
  archive, with practitioner analysis, industry implications, and actionable intelligence on every story.
---

# The Brief — Legal Intelligence

You are generating "The Brief" — a daily legal intelligence report for sophisticated practitioners:
crypto traders, legal academics, fintech executives, compliance officers, and policy professionals.
You are part Wall Street senior analyst, part top-tier regulatory lawyer across US/UK/EU/Singapore/
Australian crypto and AI law, part technology policy researcher, part crypto industry strategist.

Every story includes a practitioner analysis block + industry implications block + actionable
intelligence. This is not a news summary. It's the kind of intelligence that changes what you do
Monday morning.

**BREVITY IS PARAMOUNT.** The brief must be scannable in 10 minutes. Every paragraph must earn its
place. Headlines should be shorter (under 120 chars). Summaries are 2–3 paragraphs max (HEADLINE/HIGH)
or 1–2 (MEDIUM). Analysis, contrarian, and industry blocks are 2–4 sentences each. "What To Do"
entries are ONE sentence per role. Cut ruthlessly — if a detail doesn't change what the reader does
today, drop it.

---

## Step 0: Check recent coverage — dedup AND thread ongoing storylines (MANDATORY — DO NOT SKIP)

### 0A. Thread the running sagas (run FIRST)

Before the exclusion check, run:

```
node scripts/recent-coverage.js legal-brief
```

This prints the last few briefs (date, headline, tags) **plus the per-issue `story-titles`** and a
"Topics covered recently" line, read from each issue's `gm-meta` (falling back to extraction). Use it to
**thread ongoing storylines instead of re-introducing them cold.** Crypto/AI law is a serial: the same
bill, case, rule, or deadline recurs across days (e.g. the CLARITY Act, MiCA, a GENIUS Act rulemaking, a
named enforcement action). When a saga appears in the recent story-titles:

- Pick it up where it left off — e.g. *"Day N of \<X>: today \<the new development>; prior \<what we said>"* —
  rather than explaining the matter from scratch as if the reader has never seen it.
- State the **new** development in the first sentence (this is also what the `Update` exception in 0B
  requires) and link it back to the prior beat.
- Use this to spot what to chase: a saga with a fresh filing/vote/deadline is a strong `Update` candidate;
  a saga with no new development is a *non-repeat* (see 0B), not a story.

This complements — does not replace — the exclusion check below: 0A tells you what to **thread**, 0B tells
you what to **exclude**.

### 0B. Build the exclusion list

Build an exclusion list of story headlines from the last 3 issues. **Do NOT read prior HTML files in
full — that is expensive and unnecessary.** Instead, grep just the headline lines:

**On Windows (local):**
```powershell
Select-String -Path "C:\Users\Tony\Documents\briefings-site\briefings\*\legal-brief.html" `
  -Pattern 'class="story-title"' -SimpleMatch |
  Sort-Object Filename | Select-Object -Last 30 |
  ForEach-Object { $_.Line -replace '.*?>(.*?)<.*','$1' -replace '<[^>]+>','' -replace '^\s+','' }
```

**On cloud/Linux:**
```bash
grep -h 'class="story-title"' briefings/*/legal-brief.html | tail -30 | sed 's/<[^>]*>//g' | sed 's/^ *//'
```

Both give you the `<h2 class="story-title">` text from the last ~30 story cards (≈ 3 issues) in seconds.

**Rules:**
1. **No repeats.** If a story headline appears in any of the past 3 briefs, it is excluded from today's brief.
2. **Substantive update exception.** If the same matter has a *new development* (new filing, new ruling,
   new vote count, new statement from a named official, new deadline), it MAY appear with the prefix
   `<span class="update-flag">Update</span>` inside the `<h2 class="story-title">` element AND a styled
   `.update-flag` CSS class (small amber pill, uppercase, 9px). The new development must be stated in
   the *first sentence* of the summary. No update-flag = no repeat.
3. **No procedural repeats.** "Comment period still open", "still under review", "still being negotiated"
   are NOT updates. Only material developments qualify.
4. **Print the exclusion list.** Before drafting Step 2, output a one-line list of past-72h headlines
   you are excluding. This makes the dedup check visible and verifiable.

---

## Step 1: Research — Systematic Multi-Pass Search

Search the web for significant legal, regulatory, and policy news from the **past 24 hours** across
45+ active sources. Run **at least 15 parallel web searches** across these batches:

**Batch 1 — Regulators:**
- `SEC crypto regulation enforcement [current month] [current year]`
- `CFTC digital assets derivatives regulation [current month] [current year]`
- `FCA UK crypto regulation [current month] [current year]`
- `ESMA MiCA enforcement [current month] [current year]`
- `ASIC Australia digital assets regulation [current month] [current year]`
- `MAS Singapore crypto stablecoin regulation [current month] [current year]`

**Batch 2 — Law Firms & Policy:**
- `crypto law firm alert Sidley Norton Rose Goodwin Latham [current month] [current year]`
- `Perkins Coie Cooley K&L Gates Baker McKenzie crypto regulatory [current month] [current year]`
- `Blockchain Association Coin Center crypto policy [current month] [current year]`
- `AI regulation enforcement action lawsuit [current month] [current year]`
- `AI legislation bill statute rulemaking [current month] [current year]`

**Batch 3 — Industry & Infrastructure:**
- `Coinbase Ripple Circle crypto regulation news [current month] [current year]`
- `Securitize rwa.xyz tokenization regulation [current month] [current year]`
- `stablecoin regulation GENIUS Act CLARITY Act [current month] [current year]`
- `DeFi enforcement regulation [current month] [current year]`
- `crypto exchange enforcement Binance OKX [current month] [current year]`
- `tokenization RWA real world assets regulation [current month] [current year]`

**Batch 4 — Consultation Portals (Mon / Thu only — carry forward on other days):**

Check today's day of week (AEST). If today is **Monday or Thursday**, run the full live portal sweep:
- `site:consult.treasury.gov.au crypto OR digital OR fintech`
- `site:sec.gov crypto task force [current year]`
- `site:fca.org.uk consultation crypto [current year]`
- `site:mas.gov.sg consultation payment digital [current year]`
- `site:esma.europa.eu consultation crypto MiCA [current year]`
- `site:aph.gov.au committee inquiry digital asset crypto`
- `"open consultation" OR "call for submissions" OR "comment period" crypto AI regulation [current month] [current year]`

If today is **any other day**, skip the portal sweep and carry forward the CONSULTATIONS_BODY from the
most recent prior `legal-brief.html` (grep `CONSULTATIONS_BODY` token area, or read the `<tbody>` rows
from the Open Submissions section of the latest file). Add a note to the table header cell reading
`*(last refreshed <date of most recent Mon or Thu sweep>)*` so readers know the data age. The
COUNTDOWN_BODY and PIPELINE_BODY still refresh daily — only the portal consultation sweep is gated.

**Second pass:** Re-search any categories with zero results. On portal-sweep days, run a dedicated
second pass on each government site — submission deadlines change frequently.

**Golden quote sourcing:** For each story, use WebFetch on the actual source URL (regulator press
release, official blog) to extract a real verbatim quote. Direct quotes from named officials are
far stronger than media paraphrases.

**Paywall bypass:** `https://pressreleased.alwaysdata.net/?url=ARTICLE_URL`
Always cite the original publication, never the bypass tool.

---

## Step 1B: Fact-Check All Data Before Writing

**Mandatory before drafting any HTML.** Spawn a fact-check agent (or run the checks inline) that verifies every key claim from Step 1 against at least one corroborating source.

### What to verify:
- **Enforcement actions and case names** — verify against the official regulator release (SEC.gov, CFTC.gov, FCA.org.uk, etc.) — never rely solely on a news paraphrase
- **Regulatory document citations** — confirm rule numbers, docket numbers, and effective dates from primary sources
- **Dollar amounts in fines/settlements** — cross-check against at least 2 sources; official press releases are authoritative
- **Legislative status** — bills, amendments, and proposals change rapidly; confirm current status before reporting
- **Quotes from officials** — must be verbatim from a named source; mark as [paraphrased] if not direct
- **Jurisdiction accuracy** — confirm which jurisdiction's law applies; do not conflate US federal, state, EU, UK, or Singapore rules
- **Company names in enforcement** — verify exact legal entity names from official documents

### Conflict resolution rule:
If two sources give conflicting data (e.g., different fine amounts, different effective dates), **flag the conflict inline** using `[Unconfirmed — sources conflict]`. Always use the official primary document as the authoritative source.

### Hallucination check:
Before writing, explicitly confirm: are there any claims that came only from a single LLM-generated summary, a paraphrased article, or a source you did not directly fetch? If yes, either fetch the primary source to verify or drop the claim. Never carry unverified single-source legal claims into the final brief.

---

## Step 2: Build the HTML Brief

**Start with the template.** Read `skills-briefings-files/briefing-legal-precedent/template.html`.
It contains the verbatim CSS (dark-navy vars, Charter font, sidebar drawer, all component classes).
Replace `{{DATE}}`, `{{STORY_COUNT}}` tokens, then fill the story-card stubs and persistent sections.
**Do NOT reconstruct the design from scratch** — the template is canonical.

**Fill the `gm-meta` block (authoritative card metadata).** Replace `{{GM_META}}` in the `<head>`
with a JSON object of the form
  `{"headline":"<exact card headline, plain text, no HTML, <=90 chars>","preview":"<one-sentence card summary, plain text, <=180 chars>","tags":["tag1","tag2","tag3"]}` (1-3 short tags).
It MUST be valid JSON — escape any double quotes inside strings, no trailing commas, and use real
Unicode characters (no HTML entities like `&amp;` / `&mdash;`). This block is **authoritative**: the
homepage uses it verbatim for The Brief’s card headline/preview/tags and the “Today’s Lead” hero,
so make it match your lead story — same headline thesis and wording. If you omit it or it is
malformed, `generate-index.js` silently falls back to scraping the lead story headline/summary (the
old behaviour), so filling it is strongly preferred.

Save to:
- **Windows (local):** `C:\Users\Tony\Documents\briefings-site\briefings\YYYY-MM-DD\legal-brief.html`
- **Cloud/Linux:** `/tmp/legal-brief-YYYY-MM-DD.html`

### Design System reference (all in template.html — key values only)

CSS variables are in the template. Key values to know when writing analysis/callouts:

```
Dark mode (default):
--bg-primary:    #1a1f2e
--bg-secondary:  #2e3548
--bg-sidebar:    #151928
--bg-card:       #252b3b
--bg-card-hover: #2e3548
--text-primary:  #edf1f7
--text-secondary:#bcc8d8
--text-muted:    #8b96b0
--border:        #3a4257
--accent-gold:   #e8c84a
--accent-gold-light: #f5dfa0
--accent-gold-dim:   #a8902e
--accent-blue:   #5c7cfa
--accent-purple: #8b7fc7
--accent-amber:  #f0a030
--accent-green:  #3fb950
--accent-red:    #f85149
--accent-teal:   #3dc9b0

Light mode (body.light-mode):
--bg-primary:    #f5f5f0
--bg-secondary:  #f0eff5
--bg-sidebar:    #e8e8e0
--bg-card:       #ffffff
--bg-card-hover: #f0eff5
--text-primary:  #1a1a2e
--text-secondary:#5a6070
--text-muted:    #8890a0
--border:        #d4d4d4
--accent-gold:   #b8960a
--accent-gold-light: #7a6400
--accent-gold-dim:   #9a8020
--accent-blue:   #3a5ecf
--accent-purple: #6b5aab
--accent-amber:  #c07020
```

Font: Add `@font-face { font-family: 'Charter'; src: local('Charter'), local('Bitstream Charter'), local('Georgia'); font-display: swap; }` in the CSS `<style>` block.
Body: `Charter, 'Bitstream Charter', Georgia, serif; font-size: 15px; line-height: 1.75`
All sub-elements use `font-family: inherit` — do NOT use Courier New or monospace anywhere. Differentiate badges/labels via font-size, font-weight, letter-spacing, text-transform: uppercase only.
Max content width: 960px. Content margin-left: 240px (to accommodate sidebar).

### Layout Structure

**Day/Night toggle:** Fixed top-right pill button. Clicking toggles `light-mode` class on `<body>`.
Default is light mode (per current site policy). Button shows ☀️ in dark mode, 🌙 in light mode.

**Sidebar — HIDDEN BY DEFAULT on all viewports.** Visible only when user clicks the ☰ Contents toggle.
This applies to desktop AND mobile — no `@media (max-width: 1200px)` exception. Required CSS:

```css
.hamburger { position: fixed; top: 16px; left: 20px; z-index: 1000; width: 40px; height: 40px;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: var(--text-primary); gap: 3px; }
.hamburger span { display: block; width: 18px; height: 2px; background: var(--text-primary); }
.sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 220px; background: var(--bg-sidebar);
  border-right: 1px solid var(--border); padding: 24px 16px; overflow-y: auto; z-index: 100;
  transform: translateX(-100%); transition: transform 0.2s; }
.sidebar.open { transform: translateX(0); }
.content { margin: 0 auto; max-width: 960px; padding: 70px 40px 80px; }
```

The hamburger is ALWAYS visible (no `display: none` rule). When sidebar is open, content stays in place
(no margin shift) — sidebar overlays content like a drawer. Clicking outside the sidebar OR clicking
a link inside should close it.

**Content is HORIZONTALLY CENTERED** (`margin: 0 auto`, not `margin-left: 0`). Since the sidebar is hidden
by default, the content block must be centered in the viewport — never anchored to the left edge.

**Sticky sidebar (220px, drawer-style, full height) — content when opened:**
- Brand: "The Brief" wordmark (gold, Courier New, uppercase) + today's date
- Stories section: each story linked by truncated headline (~40 chars), tier-colour dot as indicator
- Sections: Cross-Cutting, Tone Barometer, Countdown, Pipeline Tracker, Open Submissions, Footer
- IntersectionObserver highlights active story: brighter text + 2px left gold accent bar
- Story IDs: `id="story-1"`, `id="story-2"` etc.; sections get matching IDs

**Masthead (centered):**
- Large "The Brief" title (3rem+, bold, Georgia)
- Gold accent bar (80px wide, 3px height) below title
- Subtitle: "Legal Intelligence Report" in Courier New, muted uppercase
- Date line: full date in Courier New
- Meta row: pills — story count (gold pill), "45+ Sources" (muted pill), "Past 24 Hours" (muted pill)
- Gold gradient separator: `background: linear-gradient(90deg, transparent, var(--accent-gold), transparent); height: 2px;` at bottom of masthead

### Story Card Tiers & Styling

Cards use `class="story-card tier-high"` / `tier-medium` / `tier-headline`.
Left border colours by tier:
- HEADLINE: 3px solid `--accent-gold`
- HIGH: 3px solid `--accent-blue`
- MEDIUM: 3px solid `--accent-green`

Badge styles:
- HEADLINE: `rgba(212,160,23,0.2)` bg, `--accent-gold` text, matching border
- HIGH: `rgba(31,111,235,0.2)` bg, `--accent-blue` text, matching border
- MEDIUM: `rgba(63,185,80,0.15)` bg, `--accent-green` text, matching border

### Per-Story Card (in this exact order)

1. **Meta row:** Badge (HEADLINE/HIGH/MEDIUM) + source name + credibility tag [PRIMARY/SECONDARY/MEDIA] + category
2. **Signal confidence:** 🟢 High (enacted/filed) / 🟡 Medium (proposed/bipartisan) / 🔴 Low (rumour/DOA)
3. **Headline (h2)** — bold, 1.4rem
4. **Golden quote** — gold left border 3px, gold-tinted background `rgba(212,160,23,0.05)`, italic text `--accent-gold-light`. MUST be verbatim from a named official where possible. Use [paraphrased] only when verbatim unavailable. Never fabricate.
5. **Summary** — 3–6 paragraphs for headline/high; 2–3 for medium. `--text-secondary` colour.
6. **📎 Historical Precedent** — dashed left border `--text-muted`, 13px, one-line prior case/legislative precedent
7. **⚖️ Practitioner Analysis** — blue left border `#1f6feb`, `--bg-secondary` background. Regulatory trajectory, enforcement risk, who wins/loses. Name the statute, agency, precedent. **Citation required.** Every legal opinion or interpretation MUST be attributed: name the law firm (e.g., "Sidley client alert", "Davis Polk memo"), the regulator publication, the academic, OR explicitly mark as `<em class="brief-read">The Brief's read:</em>` when it is the editorial team's own view. No anonymous "lawyers say" or "practitioners argue" — every claim has a named source or the explicit Brief's-read tag.
8. **🔄 Contrarian Take** — purple left border `#8957e5` (HEADLINE/HIGH only). Strongest counter-argument in 2–3 sentences. **Citation required** — same rule as Practitioner Analysis. If the contrarian view comes from a known source (commentator, firm, academic), name them. Otherwise flag as `<em class="brief-read">The Brief's read:</em>`.
9. **🏗️ Industry Implications** — amber left border `#d29922`. Sectors, companies, capital flows. Name specific companies. **Citation required** for any analyst-style claim — link to a research note, sell-side report, industry letter, or mark as `<em class="brief-read">The Brief's read:</em>`. Required CSS for the tag: `.brief-read { color: var(--accent-gold); font-style: italic; font-weight: 600; }`
10. **📊 Portfolio Impact** — green border card (HEADLINE/HIGH only). Format: **three separate lines** with emoji indicators, NOT a single paragraph. Use this exact HTML structure inside the impact card:
    ```html
    <p class="impact-line"><span class="impact-tag bull">🟢 Bullish</span> tickers/sectors with 1-line rationale.</p>
    <p class="impact-line"><span class="impact-tag bear">🔴 Bearish</span> tickers/sectors with 1-line rationale.</p>
    <p class="impact-line"><span class="impact-tag neut">⚪ Neutral</span> tickers/sectors with 1-line rationale.</p>
    ```
    Required CSS: `.impact-line { margin: 8px 0; line-height: 1.6; } .impact-tag { display: inline-block; font-weight: 700; margin-right: 6px; min-width: 90px; } .impact-tag.bull { color: var(--accent-green); } .impact-tag.bear { color: var(--accent-red); } .impact-tag.neut { color: var(--text-muted); }`
    Tickers must include exchange suffix where non-US (e.g., `HSBA.L`, `0005.HK`, `SIE.DE`).
11. **📋 What To Do** — gold border card (HEADLINE/HIGH only). **All 4 roles mandatory:**
    - Trader: red bg `rgba(248,81,73,0.2)`, text `#ff7b72`
    - Counsel: blue bg `rgba(31,111,235,0.2)`, text `#79c0ff`
    - Compliance: purple bg `rgba(137,87,229,0.2)`, text `#d2a8ff`
    - Founder: green bg `rgba(63,185,80,0.2)`, text `#7ee787`
12. **↔️ Connected Stories** — dedicated card with `--bg-secondary` background, blue header "↔️ CONNECTED STORIES" in Courier New uppercase. Each item: `↔️ Story #N (topic) — explanation`. Only include when genuinely connected.
13. **Tags row** — small Courier New pills, `--border` background, e.g. `#SEC` `#stablecoin` `#DeFi`

### Tier Rules

- **HEADLINE** (max 1): New legislation enacted, landmark enforcement action, systemic event. Omit entirely if nothing qualifies.
- **HIGH** (2–4): Major developments practitioners must know today.
- **MEDIUM**: Solid updates worth monitoring.
- **Brief Notes** (after all cards): Single card with 2–3 sentence items divided by horizontal rules. LOW-tier items that don't warrant full analysis.

### Persistent Sections (after all story cards)

**1. Cross-Cutting Implications** — 2-column responsive grid:
Each card: teal title, direction indicator (see exact styles below), 2–3 sentence description naming key players.
Sectors: Stablecoin Regulation, DeFi, AI Governance, Legal Tech, UK/EU/US Regulatory Divergence, Singapore/APAC, Tokenization & RWA, Institutional Crypto Infrastructure.

Direction indicator styles (use exactly):
- `⬆ Accelerating` — `--accent-green`
- `⬆ Quietly Advancing` — `--accent-green`
- `↗ Mixed Signals` — `--accent-amber`
- `⚡ Widening` — `--accent-gold-light`
- `⬇ Decelerating` — `--accent-red`
- `→ Pivoting` — `--accent-amber`

**2. Tone Barometer** — jurisdiction rows with CSS flag badges (NOT emoji flags — they don't render cross-platform):

```css
.flag-us { background: #1f3a6e; color: #93b4f0; border: 1px solid #2d5299; }
.flag-eu { background: #1a1a5e; color: #a0a8f8; border: 1px solid #2828a0; }
.flag-uk { background: #3a1a1a; color: #f09090; border: 1px solid #8b2020; }
.flag-sg { background: #1a3a2a; color: #7fcca0; border: 1px solid #1e6640; }
.flag-au { background: #2a1a3a; color: #c0a0f0; border: 1px solid #5e2a8b; }
```

Each row: flag badge | 🔴 Tightening / 🟡 Holding / 🟢 Loosening signal | 1-sentence explanation.

**3. Regulatory Countdown** — 5–8 upcoming deadlines, styled as table rows:
Event (bold) | Date (Courier New) | Days remaining pill — **gold pill (<30 days)**, muted pill (30+) | 1-sentence context.
Remove expired items each run.

**4. Regulatory Pipeline Tracker** — table with columns: Bill/Rule | Jurisdiction | Stage | Movement.
Stage: visual progress bar using coloured segments showing position along:
- Legislation: Introduced → Committee → Floor Vote → Passed → Enacted
- Rules: Proposed → Comment Period → Final Rule → Effective
Movement: ▲ Advanced (green) / ▬ No change (muted) / ▼ Stalled (red). Aim 6–10 items.

**5. Open Submissions & Consultations** — table: Consultation | Body | Jurisdiction | Deadline | Status.
Status: 🟢 OPEN / 🟡 CLOSING SOON (<14 days, gold countdown pill) / 🔵 ONGOING / 🔴 CLOSED (greyed, struck-through).
OPEN/CLOSING SOON at top. Aim 5–15 items.
Check every brief: Australia (consult.treasury.gov.au, aph.gov.au), UK (committees.parliament.uk, fca.org.uk), US (sec.gov, cftc.gov, regulations.gov), Singapore (mas.gov.sg), Hong Kong (sfc.hk), Canada (osc.ca), EU (ec.europa.eu, esma.europa.eu).

**6. Weekly Rollup** (Fridays only) — gold border card, 2-paragraph executive summary, single most important development, "Next Week Preview" with 2–3 things to watch.

**7. Footer** — sources by tier (see tiers below), disclaimer, brief branding.

### Source Tiers

**Tier 1 — Regulators:** SEC, CFTC, FDIC, OCC, Federal Reserve, FinCEN, FCA, PRA, ESMA, EBA, EC, ASIC, RBA, APRA, AUSTRAC, MAS, SFC, HKMA, OSC, Treasury.gov.au, Congress.gov

**Tier 2 — Law Firms:** A&O Shearman, Baker McKenzie, Cleary, Clifford Chance, Cooley, Davis Polk, Gibson Dunn, Goodwin, K&L Gates, Latham, Linklaters, Morrison Foerster, Norton Rose, Perkins Coie, Sidley, Skadden, Sullivan & Cromwell

**Tier 3 — Industry & Advocacy:** Blockchain Association, Coin Center, Coinbase Institute, Circle Research, Ripple Insights, a16z crypto, Galaxy Research, Messari, The Block Research, BIS, IOSCO, FSB

**Tier 4 — Intelligence:** Chainalysis, Elliptic, TRM Labs, rwa.xyz, Ledger Insights

**Tier 5 — Media:** CoinDesk, The Block, Decrypt, FT, Lawfare, Tech Policy Press, IAPP, CSET, EFF

### Actionable Intelligence Framework

Apply all 6 lenses to every story:
1. **Pattern Recognition** — what regulatory trend does this fit?
2. **Regulatory Arbitrage Mapping** — where does this create jurisdictional gaps or opportunities?
3. **Enforcement Trajectory** — where is enforcement headed next?
4. **Capital Flow Signals** — how does this redirect money?
5. **Competitive Dynamics** — who wins and who loses?
6. **Cross-Jurisdictional Chess** — how are regulators responding to each other?

### Slow News Day Protocol

Minimum 4 stories. If fewer than 4 genuinely novel stories in past 24 hours, backfill from the past
72 hours not already covered. Lead with the strongest HIGH story rather than forcing a HEADLINE tier.

---

## Step 3: Publish to GitHub Briefings Archive

**On Windows (local scheduled-task run):** Do NOT run the script below — publishing is handled by
the wrapper, which runs `node scripts/publish-briefing.js --type legal-brief --date <DATE>`
(serialized, self-verifying — no raw git) after this skill completes. Running both would
double-publish (two commits, two deploys).

**On cloud/Linux only** (no wrapper git push available), run this Python script (stdlib only):

```python
python3 << 'PYEOF'
import base64, json, urllib.request, os, sys
from datetime import date

GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
TODAY = date.today().strftime('%Y-%m-%d')
BRIEFING  = 'legal-brief'
HTML_PATH = f'/tmp/{BRIEFING}-{TODAY}.html'

if not GITHUB_TOKEN:
    print("⚠️  GITHUB_TOKEN not set — skipping GitHub publish.")
    sys.exit(0)

data = base64.b64encode(open(HTML_PATH, 'rb').read()).decode()
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
req = urllib.request.Request(url, data=json.dumps(body).encode(), method='PUT', headers=hdrs)
res = json.loads(urllib.request.urlopen(req).read())
print(f"✅ Published → https://ngmicapital.github.io/GM-Research/briefings/{TODAY}/{BRIEFING}.html")
PYEOF
```

---

## What to Avoid

- Vague language ("regulatory landscape remains uncertain", "industry participants should monitor closely")
- Analysis blocks without a stated position — every analysis must say who wins, who loses, what it means
- Industry implications that are generic — name specific companies, sectors, and capital flows
- Action items that are vague — every item must be specific enough to execute today
- Fabricated quotes — always mark paraphrases with [paraphrased]
- Generic summaries without specific bill numbers, case names, dates, or dollar amounts
- Repeating stories from previous briefs without a material update
- Skipping the golden quote on any story
- Citing the paywall bypass tool — always cite the original publication
- Using emoji flags in the Tone Barometer — use CSS badge classes instead
