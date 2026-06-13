---
name: briefing-ai-cortex
description: >
  Site-output contract for the daily AI Intelligence Briefing ("Cortex") published to the GM-Research
  archive at briefings/YYYY-MM-DD/ai-briefing.html. PRIMARY CONTENT AUTHORING — what to cover (model
  releases, benchmarks, AI business/strategy, AI x Crypto, research papers), how to source it, and the
  editorial voice — is handled by the user's Cowork "ai-briefing" skill, NOT this file. This repo-side
  file documents only what the published HTML must satisfy so generate-index.js and the health-check bot
  index the card correctly: the gm-meta block, filename, title, og:description, the extraction fallback,
  and the back-link. Read this when publishing the ai-briefing into this repo or debugging why its index
  card renders wrong.
---

# AI Intelligence Briefing ("Cortex") — Site Output Contract

This is the **publishing/site contract** for the AI Intelligence Briefing, not its authoring guide.

**Content authoring lives elsewhere.** What the briefing covers, how its sources are gathered and
verified, and its house voice are owned by the user's Cowork **"ai-briefing"** skill (the global skill
triggered by "ai briefing", "ai report", "run the ai brief", etc.). That skill produces the styled HTML.
**Do not duplicate or re-derive its content-sourcing methodology here** — this file would only become a
competing, drifting source of truth. This document covers exactly one thing: **what the GM-Research repo
needs from the published HTML so the homepage index card, tags, and "Today's Lead" hero come out right.**

If you are editing *what the briefing says*, that is the Cowork skill's job. If you are making sure the
file lands in the archive and indexes cleanly, you are in the right place.

---

## Cadence

**The AI briefing publishes DAILY** — it is one of the daily briefing types (alongside market-briefing
and rabbit-hole), not part of an odd/even pair. The health-check bot's missing-briefing detection expects
an `ai-briefing.html` for each day.

> Evidence: the published archive (`Glob` of `briefings/*/ai-briefing.html`) shows issues on effectively
> consecutive days through March–June 2026 (e.g. 2026-06-11, 2026-06-12, 2026-06-13), spanning both odd
> and even dates — which rules out an odd/even split. The "daily" label is also stated on the briefing
> itself (`<div class="label">AI Intelligence Briefing · Daily</div>` in `template.html`).

---

## Canonical template reference

The verbatim CSS + structure is in `template.html` in this folder
(`skills-briefings-files/briefing-ai-cortex/template.html`). **Do NOT reconstruct the design from a prior
full briefing** — the template is the source of truth, and it carries the comment "Do NOT read a prior
full briefing — this is canonical." Replace the `{{tokens}}` and fill the `<!-- Fill -->` stubs.

Structure you do not need to re-derive (all in the template):
- `Syne` body font + `DM Serif Display` headlines + `DM Mono` labels; dark `#0A1628` header with a
  `#D4845E` accent rule; light `#F4F6F8` page.
- `.header` (label · `<h1 class="title">`, `.meta` date line, `.badges` with the issue number + three
  `{{TOP_HEADLINE_*}}` badges).
- A collapsible `.toc` sidebar (the `§ Contents` toggle button + its inline `<script>`).
- A `#tldr` section whose thesis paragraph carries **both** classes: `<p class="skim tldr-text">` — this
  dual class matters for the index fallback (see the Output Contract).
- Eight numbered `<section>` blocks (`#s01`–`#s08`), each with an `<h2>` title, a `.skim` one-line summary,
  and `<h3>` story headlines + analysis paragraphs. Special section themes: `.claude-section`,
  `.crypto-section` (with a `.token-grid`), `.tech-section`. §08 is the watchlist.
- Component classes: `.skim`, `.pill` (+ variants `launch|update|benchmark|funding|regulatory|workflow|
  usecase|rumour|research|crypto|security`), `.analysis`, `.alert`, `.explainer`, `.model-card`
  (+ vendor variants), `.watchlist-item`. A dark `footer` with the sources list.

---

## Output Contract (REQUIRED for the site to work)

These elements are mandatory — `generate-index.js`, `scripts/lib/briefings.js`, and the health-check bot
depend on them.

1. **Filename:** the output **must** be exactly `ai-briefing.html`, in `briefings/YYYY-MM-DD/`. The index
   and health-check key off this exact name.

2. **`gm-meta` block (authoritative card metadata — PREFERRED path).** Replace `{{GM_META}}` in the
   template's `<head>` (`<script type="application/json" id="gm-meta">{{GM_META}}</script>`) with a JSON
   object of the form:
   `{"headline":"<exact card headline, plain text, no HTML, <=90 chars>","preview":"<one-sentence card summary, plain text, <=180 chars>","tags":["tag1","tag2","tag3"]}`
   (1–3 short tags). It MUST be valid JSON — escape any double quotes inside strings, no trailing commas,
   and use **real Unicode** characters (write `—`, `&`, `−` directly; **no** HTML entities like `&amp;` /
   `&mdash;` / `&minus;`, which would surface as literal jibberish on the index). This block is
   **authoritative**: `readMeta()` in `scripts/lib/briefings.js` runs *first*, and if the block is present
   with a non-empty `headline`, the homepage uses its `headline` / `preview` / `tags` **verbatim** for the
   ai card and the "Today's Lead" hero, skipping every regex strategy. Keep it consistent with the visible
   thesis in the `#tldr` paragraph (same claim and wording).

3. **Extraction fallback — the populated `.tldr-text` paragraph (NOT `<h3>`).** If `gm-meta` is missing or
   malformed, `generate-index.js` silently falls back to **Strategy 1**, which reads the
   `class="tldr-text"` element. In this template that is the TL;DR thesis paragraph
   `<p class="skim tldr-text">…</p>`. Strategy 1 takes the **first sentence as the card headline** (split
   on a `". Capital"` boundary or a semicolon) and the **second sentence as the preview**. So the TL;DR
   must be real prose with a clear first-sentence thesis — never generic section names. Keep it populated
   even when you also emit `gm-meta`, so the fallback stays correct.

   > ⚠ Correction vs. a common assumption: there is **no `<h3>`-reading strategy** in `generate-index.js`
   > for the ai briefing — a grep of the script for `<h3` / `key === 'ai-briefing'` returns nothing
   > (verified this session). The `<h3>` elements are the *visible story headlines* inside each section;
   > they are styled (`section h3`) but are **not** what the index extracts. The headline/preview come
   > from `gm-meta` first, then the `.tldr-text` paragraph. If you were told the fallback reads `<h3>`,
   > that is inaccurate for the current code.

4. **`<title>` element** — present and dated. The template ships
   `AI Intelligence Briefing — Issue {{ISSUE_NUMBER}} · {{DATE}}`.

5. **`og:description`** — `<meta property="og:description" content="...">` must be present (health-check
   accepts `og:description` *or* a `meta name="description"`; the template ships `og:description`). For a
   richer social preview, write a real one-sentence summary; the template's dated default
   (`AI Intelligence Briefing — Issue {{ISSUE_NUMBER}} · {{DATE}}`) is what the archive currently uses and
   passes the check.

6. **Index TAGS** come from a shared regex over the whole HTML when `gm-meta` is absent. The ai pattern in
   `scripts/lib/briefings.js` is
   `\b(Claude|GPT|Gemini|DeepSeek|Mistral|NVIDIA|Llama|Anthropic|OpenAI|Google)\b` (first three matches →
   tags). Real ai-briefing content mentions these names naturally, so tags resolve on their own — but when
   you emit `gm-meta`, its `tags` array wins and is used verbatim, so set 1–3 clean tags there.

7. **Back-link to `../../index.html`** — keep the template's existing small dark back-link `<div>` at the
   top of `<body>` (health-check expects an index back-link in every briefing). **Do NOT add a second,
   larger "← All Briefings" nav bar** — the site-wide nav bar was removed 2026-05-20 and the index page
   handles navigation. (Note: the template's back-link uses the `&#8592;` entity for the arrow *glyph*
   inside the link text — that is fine; the entity ban applies to extracted headline/preview/tag text, not
   to this static nav glyph.)

---

## Pre-Publish Checklist

Run before committing — all must pass:

- [ ] File saved as `briefings/YYYY-MM-DD/ai-briefing.html` (exact filename).
- [ ] `gm-meta` block present and **valid JSON** — `headline` ≤90 chars, `preview` ≤180 chars, 1–3
      `tags`, real Unicode (no `&amp;` / `&mdash;` / `&minus;`), no trailing commas, double quotes escaped.
      Consistent with the visible `#tldr` thesis.
- [ ] The `<p class="skim tldr-text">` thesis is populated with real prose leading on a clear
      first-sentence thesis (this is the fallback that drives the card if `gm-meta` is dropped).
- [ ] `<title>` and `og:description` present and dated.
- [ ] Back-link to `../../index.html` present; no second nav bar added.
- [ ] **Run `node scripts/generate-index.js`** and confirm:
  - no `⚠️` lines for the ai card (especially `RAW HTML ENTITY in headline` and
    `EMPTY headline` / `EMPTY preview`),
  - no `⚠  [validator] ai-briefing … headline looks like a section header` — if you see this, the
    extraction fell back to a generic section name; fix `gm-meta` / `.tldr-text` and re-run,
  - the ai card on the index shows your real thesis headline + tags,
  - output ends with `✓  UI validator: all card extractions look clean`.

---

## Publish

**On Windows (local scheduled-task run):** the Cowork skill / wrapper handles writing the file, running
`generate-index.js`, and `git push origin main`. Do not push manually if the wrapper will — running both
double-publishes. Per the project `CLAUDE.md`, all automated/scheduled work lands on `main`.

**On cloud/Linux** (no wrapper): publish via the GitHub Contents API the way the other briefing skills do
— base64-encode the HTML, PUT it to `briefings/YYYY-MM-DD/ai-briefing.html` on `main`, then regenerate the
index.
