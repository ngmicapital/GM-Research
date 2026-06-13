---
name: briefing-biohacker
description: >
  Site-output contract for the Biohacker Report published to the GM-Research archive at
  briefings/YYYY-MM-DD/biohacker-report.html. PRIMARY CONTENT AUTHORING — what to cover (longevity
  science, training & hypertrophy, supplements, nutrition, daily wisdom), how to source and tier the
  evidence, and the editorial voice — is handled by the user's Cowork "biohacker-report" skill, NOT this
  file. This repo-side file documents only what the published HTML must satisfy so generate-index.js and
  the health-check bot index the card correctly: the gm-meta block, filename, title, og:description, the
  extraction fallback, and the back-link. Read this when publishing the biohacker report into this repo
  or debugging why its index card renders wrong.
---

# Biohacker Report — Site Output Contract

This is the **publishing/site contract** for the Biohacker Report, not its authoring guide.

**Content authoring lives elsewhere.** What the report covers, how its studies/sources are gathered,
verified, and evidence-tiered, its dedup rules, and its house voice are owned by the user's Cowork
**"biohacker-report"** skill (the global skill triggered by "biohacker report", "briefing health",
"health briefing", "run biohacker", etc.). That skill produces the styled HTML. **Do not duplicate or
re-derive its content-sourcing methodology here** — this file would only become a competing, drifting
source of truth. This document covers exactly one thing: **what the GM-Research repo needs from the
published HTML so the homepage index card, tags, and "Today's Lead" hero come out right.**

If you are editing *what the report says*, that is the Cowork skill's job. If you are making sure the file
lands in the archive and indexes cleanly, you are in the right place.

---

## Step 0: Check recent coverage (DEDUP — run before authoring the report)

The Biohacker Report has a known recurring failure: it repeats the same topics — **creatine, Zone 2,
sleep** — cycle after cycle without a new angle. The fix is a mechanical dedup pass against the recently
published issues. Before writing the report, run:

```
node scripts/recent-coverage.js biohacker-report
```

It prints the last few issues (date, headline, tags) and a "Topics covered recently" line, read from each
issue's `gm-meta` (falling back to extraction). **Do not repeat a topic shown there unless you have a
genuinely new finding** — and if you do, frame it explicitly as a follow-up (the new study/result first),
not a re-run of the same evergreen explainer. Rotate to fresh material otherwise.

> **IMPORTANT — where this actually runs.** Because the report's *content* is authored by the user's Cowork
> **"biohacker-report"** skill (not this repo file — see the framing above), **that Cowork skill is the one
> that must run this command as its dedup step**, since it owns topic selection. This repo-side file only
> **documents the mechanism**: the helper lives in this repo (`scripts/recent-coverage.js`) and reads this
> repo's published archive, so the Cowork skill should invoke it (or the equivalent recent-coverage check)
> against `C:\Users\Tony\Documents\briefings-site` before picking topics. Keeping the dedup note here means
> the mechanism is discoverable from the site contract even though enforcement happens in the Cowork skill.

---

## Cadence

**The Biohacker Report publishes on EVEN days of the month** (2, 4, 6, 8, …). Its counterpart, **Praxis**,
runs on ODD days. This is enforced by the health-check bot's missing-briefing detection.

> Evidence: stated as a known build-system fact for this task (biohacker = even, praxis = odd), and
> corroborated by the published archive — `Glob` of `briefings/*/biohacker-report.html` shows an all-even
> date pattern through April–June 2026 (e.g. 2026-06-10, 2026-06-12; absent on the odd 2026-06-11/13).
> If you are running the underlying Cowork skill manually on an odd day at the user's request, just
> generate it; the cadence rule governs the *scheduled* run and the health-check's absence alarm, not
> ad-hoc runs.

---

## Canonical template reference

The verbatim CSS + structure is in `template.html` in this folder
(`skills-briefings-files/briefing-biohacker/template.html`). **Do NOT reconstruct the design from a prior
full briefing** — the template is the source of truth, and it carries the comment "Do NOT read a prior
full briefing — this is canonical." Replace the `{{tokens}}` and fill the `<!-- SECTION -->` stubs.

Structure you do not need to re-derive (all in the template):
- `Syne` body font + `DM Serif Display` headlines + `DM Mono` labels; green `#1A3D2B` header on a light
  `#F4F6F8` page, `#2D7A4F` accent throughout; 900px `.wrapper`.
- `.header` (label · `.header-title`, `.header-meta` date, `.header-badges` with `{{EDITION_LABEL}}` +
  issue number) containing a **hidden `<p class="tldr-text" style="display:none">`** — this hidden element
  is the index fallback (see the Output Contract).
- A visible `.tldr` "Driving Thesis" block, then numbered sections: §00 Wisdom (`.wisdom-section`),
  §01 Longevity & Performance Science, §02 Training & Performance, §03 Supplements & Nutrition,
  §04 Notable Reads, §05 Watchlist, and a green `.footer` with the sources list.
- Component classes: `.analysis-block`, `.story-card` (+ `.featured`), `.pill` (+ evidence variants
  `pill-rct|pill-meta|pill-obs|pill-mech|pill-expert|pill-preprint|pill-guide`), `.implication-block`,
  `.hype-block`, `.two-col` / `.grid-card`, `.notable-item` / `.tier-pill`, `.watchlist-item` /
  `.status-pill`.

---

## Output Contract (REQUIRED for the site to work)

These elements are mandatory — `generate-index.js`, `scripts/lib/briefings.js`, and the health-check bot
depend on them.

1. **Filename:** the output **must** be exactly `biohacker-report.html`, in `briefings/YYYY-MM-DD/`. The
   index and health-check key off this exact name.

2. **`gm-meta` block (authoritative card metadata — PREFERRED path).** Replace `{{GM_META}}` in the
   template's `<head>` (`<script type="application/json" id="gm-meta">{{GM_META}}</script>`) with a JSON
   object of the form:
   `{"headline":"<exact card headline, plain text, no HTML, <=90 chars>","preview":"<one-sentence card summary, plain text, <=180 chars>","tags":["tag1","tag2","tag3"]}`
   (1–3 short tags). It MUST be valid JSON — escape any double quotes inside strings, no trailing commas,
   and use **real Unicode** characters (write `—`, `&`, `−` directly; **no** HTML entities like `&amp;` /
   `&mdash;` / `&minus;`, which would surface as literal jibberish on the index). This block is
   **authoritative**: `readMeta()` in `scripts/lib/briefings.js` runs *first*, and if the block is present
   with a non-empty `headline`, the homepage uses its `headline` / `preview` / `tags` **verbatim** for the
   biohacker card and the "Today's Lead" hero, skipping every regex strategy. Keep it consistent with the
   hidden `.tldr-text` (same finding and wording).

3. **Extraction fallback — the hidden `.tldr-text` element.** If `gm-meta` is missing or malformed,
   `generate-index.js` silently falls back to **Strategy 1**, which reads the `class="tldr-text"` element.
   In this template that is the **hidden** `<p class="tldr-text" style="display:none">…</p>` in the
   `.header` (the template flags it: "REQUIRED for site index: first sentence = card headline, second =
   preview"). Strategy 1 takes the **first sentence as the card headline** (split on a `". Capital"`
   boundary or a semicolon) and the **second sentence as the preview**. So this hidden element must hold
   real prose — the most important finding this cycle first, supporting context second — never generic
   section names. Keep it populated even when you also emit `gm-meta`, so the fallback stays correct.

   > Note: this hidden `.tldr-text` is distinct from the *visible* `.tldr` "Driving Thesis" block below
   > the header. The index reads the hidden one. Both should carry the same thesis, but the hidden
   > `.tldr-text` is the one the extractor depends on.

4. **`<title>` element** — present and dated. The template ships
   `Biohacker Report · Issue #{{ISSUE_NUMBER}} · {{DATE}}`.

5. **`og:description`** — `<meta property="og:description" content="...">` must be present (health-check
   accepts `og:description` *or* a `meta name="description"`; the template ships `og:description`). For a
   richer social preview, write a real one-sentence summary; the template's dated default
   (`Biohacker Report · Issue #{{ISSUE_NUMBER}} · {{DATE}}`) is what the archive currently uses and passes
   the check.

6. **Index TAGS** come from a shared regex over the whole HTML when `gm-meta` is absent. The biohacker
   pattern in `scripts/lib/briefings.js` is
   `\b(Creatine|GLP-1|VO2max|Huberman|Zone 2|Sleep|HRV|Cortisol|Testosterone)\b` (first three matches →
   tags). This list is narrow, so a cycle covering topics outside it may yield few/no regex tags — another
   reason to emit `gm-meta`, whose `tags` array wins and is used verbatim. Set 1–3 clean tags there.

7. **Back-link to `../../index.html`** — keep the template's existing small dark back-link `<div>` at the
   top of `<body>` (health-check expects an index back-link in every briefing). **Do NOT add a second,
   larger "← All Briefings" nav bar** — the site-wide nav bar was removed 2026-05-20 and the index page
   handles navigation. (Note: the template's back-link uses the `&#8592;` entity for the arrow *glyph*
   inside the link text — that is fine; the entity ban applies to extracted headline/preview/tag text, not
   to this static nav glyph.)

---

## Pre-Publish Checklist

Run before committing — all must pass:

- [ ] File saved as `briefings/YYYY-MM-DD/biohacker-report.html` (exact filename).
- [ ] `gm-meta` block present and **valid JSON** — `headline` ≤90 chars, `preview` ≤180 chars, 1–3
      `tags`, real Unicode (no `&amp;` / `&mdash;` / `&minus;`), no trailing commas, double quotes escaped.
      Consistent with the hidden `.tldr-text`.
- [ ] The hidden `<p class="tldr-text" style="display:none">` is populated with real prose — the cycle's
      key finding first, supporting context second (this is the fallback that drives the card if `gm-meta`
      is dropped).
- [ ] `<title>` and `og:description` present and dated.
- [ ] Back-link to `../../index.html` present; no second nav bar added.
- [ ] **Run `node scripts/generate-index.js`** and confirm:
  - no `⚠️` lines for the biohacker card (especially `RAW HTML ENTITY in headline` and
    `EMPTY headline` / `EMPTY preview`),
  - no `⚠  [validator] biohacker-report … headline looks like a section header` — if you see this, the
    extraction fell back to a generic section name; fix `gm-meta` / `.tldr-text` and re-run,
  - the biohacker card on the index shows your real finding headline + tags,
  - output ends with `✓  UI validator: all card extractions look clean`.

---

## Publish

**On Windows (local scheduled-task run):** the Cowork skill / wrapper handles writing the file, running
`generate-index.js`, and `git push origin main`. Do not push manually if the wrapper will — running both
double-publishes. Per the project `CLAUDE.md`, all automated/scheduled work lands on `main`.

**On cloud/Linux** (no wrapper): publish via the GitHub Contents API the way the other briefing skills do
— base64-encode the HTML, PUT it to `briefings/YYYY-MM-DD/biohacker-report.html` on `main`, then
regenerate the index.
