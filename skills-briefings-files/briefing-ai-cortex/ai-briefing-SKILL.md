---
name: ai-briefing
description: >
  Generate a daily AI Intelligence Briefing — a research-grade daily report covering model
  releases, benchmarks, Claude ecosystem developments, AI×crypto token moves, open-source
  pulse (GitHub trending, new releases), deals & regulation, workflow tools, and research
  papers. Trigger whenever a scheduled task invokes this skill, or the user says "ai briefing",
  "ai report", "ai update", "run the ai brief", "what's new in ai", "ai news", or any variation
  requesting an AI-focused intelligence report.
---

# AI Intelligence Briefing

You are generating the **AI Intelligence Briefing** — a daily, opinionated, trader-adjacent
intelligence report for Tony (NGM Capital, Sydney). He follows models, open-source, and AI×crypto
closely. This is not a news summary — it is a **carry-forward decision log**: what changed since
yesterday, what it means for the positions and workflows that matter to him.

**Voice:** Specific, direct, numbers-first. If a model update doesn't change what you do today,
it gets one sentence. If it does, it gets analysis. Use `.delta ⚡` spans to flag same-day
developments. No MBA-speak. No filler hedges.

---

## STEP 0 — DEDUP (lean grep, not a full HTML read)

Build an exclusion list of topics already covered in the last 3 issues. Do NOT read prior briefings
in full — that's expensive. Instead, grep just the h3 headlines:

```powershell
Select-String -Path "C:\Users\Tony\Documents\briefings-site\briefings\*\ai-briefing.html" `
  -Pattern '<h3>' -SimpleMatch | Sort-Object Filename | Select-Object -Last 90 |
  ForEach-Object { $_.Line -replace '.*<h3[^>]*>(.*?)</h3>.*','$1' -replace '<[^>]+>','' }
```

Print the extracted list as "EXCLUDING (already covered):" before drafting. A story may be
carried forward only if there is a **new development** (new number, new name, new announcement,
new action) — prefix it with `<span class="delta">⚡ Update:</span>` in the h3.

---

## STEP 1 — RESEARCH

Run these searches **in parallel**. Target the past 24 hours.

**Model landscape:**
- `anthropic claude model release update [date]`
- `openai model gpt release update [date]`
- `google deepmind gemini model update [date]`
- `meta llama mistral model release [date]`

**Benchmarks & evals:**
- `AI benchmark LLM leaderboard [month] [year]`
- `SWE-bench HumanEval MMLU results [date]`

**AI × Crypto:**
- WebSearch or CoinGecko MCP for TAO (Bittensor), AKT (Akash), RENDER prices + 24h/7d/30d %
- `AI crypto token news TAO AKT RENDER [date]`

**Open-source:**
- `GitHub trending AI models [date]`
- `open source LLM release huggingface [date]`

**Deals, regulation & corporate:**
- `AI company funding IPO acquisition [date]`
- `AI regulation policy EU US [date]`

**Workflow & tools:**
- `AI coding tool agent workflow update [date]`
- `Claude Code MCP tools update [date]`

**Research:**
- `AI safety alignment research paper [date]`
- `LLM reasoning memory paper arxiv [date]`

For any story with a direct source URL (official blog, press release, arxiv), WebFetch it
to pull the actual quote. Paraphrases are acceptable only when the primary source is paywalled
or unavailable — mark as `[paraphrased]`.

---

## STEP 2 — BUILD THE HTML

Read `template.html` in this folder (path: `skills-briefings-files/briefing-ai-cortex/template.html`).
Replace the `{{tokens}}`, fill each `<!-- SECTION -->` body, then save as `briefings/YYYY-MM-DD/ai-briefing.html`.

**If `template.html` doesn't exist yet:** read only the `<head>` + `<style>` block from the most recent
`briefings/*/ai-briefing.html` (the CSS, not the body content), then construct the body from scratch.
In that case, after saving, also create `template.html` by stripping day-specific content from your output
so future runs have it. Either way, do NOT read a prior full briefing body for content reference.

### Section order (IDs s01–s08)

1. **§01 — Model Landscape** — what shipped, what changed, what the version number actually means
2. **§02 — Claude Ecosystem** — Claude model status, Claude Code/SDK updates, Anthropic corporate
3. **§03 — AI × Crypto** — TAO, AKT, RENDER prices + position carry-forward from yesterday's issue
4. **§04 — Open-Source Pulse** — GitHub trending, new HuggingFace releases, community moves
5. **§05 — Deals & Regulation** — funding, M&A, IPO pipeline, policy/regulatory moves
6. **§06 — Workflow & Tools** — new tools, MCP servers, agent frameworks, productivity wins
7. **§07 — Research Radar** — 1–3 papers worth tracking, one-paragraph each
8. **§08 — Watchlist** — 3–5 numbered items: what to watch next 24h and why

### TL;DR / index extraction
The `<p class="skim tldr-text">` in the TL;DR section is the fallback `generate-index.js` extracts
as the card headline + preview. It must open with the **single biggest development** in bold, then
carry the key numbers for each section. This is the most-read sentence in the whole brief.

**gm-meta (AUTHORITATIVE — fill this too):** the template's `<head>` carries a
`<script type="application/json" id="gm-meta">{{GM_META}}</script>` block. Replace `{{GM_META}}`
with valid JSON of this exact shape:

```json
{"headline":"<=90 chars plain text","preview":"<=180 chars plain text","tags":["t1","t2","t3"]}
```

When present and well-formed, this block is **authoritative** for the homepage index card + hero —
it overrides the `.tldr-text` extraction. If you omit it or it is malformed JSON, the index
**falls back** to the `.skim tldr-text` above. Rules:
- Plain text only — use real Unicode characters (−, ×, ±, —), never HTML entities (`&minus;`, `&times;`).
- Escape any `"` inside string values as `\"` so the JSON stays valid.
- Keep `headline` / `preview` consistent with the visible TL;DR — same biggest development, not a divergent one.
- `tags` = up to 3 short topic tags (e.g. the key model / open-source / AI×crypto themes of this issue).

### Issue numbering
Count existing `ai-briefing.html` files: `(ls briefings/*/ai-briefing.html).Count` on Windows.
Issue #N = that count + 1.

### Key structural elements
- Back-nav bar: `<div style="font-family:sans-serif;font-size:12px;padding:8px 16px;background:#0A1628;"><a href="../../index.html" style="color:#8BA4C0;text-decoration:none;">&#8592; All Briefings</a></div>` — keep it, appears before `<header>`
- `.delta ⚡` span: use on same-day developments to visually flag what's new vs carry
- `.skim` bar before each section body: one-sentence position statement

---

## STEP 3 — SAVE

Save to: `C:\Users\Tony\Documents\briefings-site\briefings\YYYY-MM-DD\ai-briefing.html`

The wrapper (scheduled-task SKILL.md) handles: `node scripts/generate-index.js`, git commit, and
push. Do not run those steps here — just save the HTML file and confirm it exists.

---

## What to avoid

- Repeating yesterday's stories without a new development
- Sections with no stated position ("remains to be seen", "could potentially")
- AI×Crypto section without actual prices pulled from CoinGecko or a search
- Generic model summaries without version numbers or benchmark scores
- Fabricating quotes — always fetch the primary source or mark [paraphrased]
- Reading a prior full briefing HTML for styling — use `template.html`
