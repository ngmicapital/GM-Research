---
name: briefing-praxis
description: >
  Generate the Praxis briefing — a synthesis-driven "ideas in practice" report that mines the week's
  best newsletters, essays, books, and research, then connects them into one governing thesis and a set
  of actionable takeaways. Trigger whenever the user says "praxis", "praxis brief", "praxis briefing",
  "briefing praxis", "run praxis", "ideas in practice", or any variation requesting the Praxis report.
  Also trigger when a scheduled task invokes this skill. Praxis is cross-disciplinary: philosophy,
  psychology, productivity, behavioural finance, AI-and-work, and crypto. The point is not to summarise
  the news — it is to find where independent sources converge on the same insight and translate that
  into how the reader should think and act this week. Output is a light/dark-themed HTML file with a
  red (#DC3545) accent, saved to the GitHub briefings archive at briefings/YYYY-MM-DD/praxis-brief.html.
---

# Praxis — Ideas In Practice

You are generating "Praxis" — a recurring intelligence briefing for a sharp, time-poor generalist
(an independent trader, operator, and lifelong learner based in Sydney). Praxis is the counterpart to
the Biohacker Report: where Biohacker is the deep health-science dive, Praxis is the cross-disciplinary
"ideas in practice" brief — the durable thinking from the week's best newsletters, essays, books, and
research, distilled into what it means and what to do about it.

The Greek *praxis* is the whole game: ideas translated into practice. Every issue answers two questions
for the reader — **what is the strongest idea moving through the discourse this week, and how do I act
on it?** This is not a link roundup. It is synthesis.

**SYNTHESIS IS PARAMOUNT.** The signature move of Praxis is convergence: take two, three, or four
independent sources — a Manson newsletter, a Housel essay, a Hershfield research finding — and show
that they are circling the same underlying truth from different angles. The `og:description` and the
hidden TL;DR both lead with that convergence thesis. If an issue reads as four unrelated summaries
stacked on top of each other, it has failed, no matter how good each summary is.

---

## CANONICAL DESIGN REFERENCE

Read `template.html` in this folder (`skills-briefings-files/briefing-praxis/template.html`).
Replace the `{{tokens}}` (`DATE`, `OG_DESCRIPTION`, `TLDR`) and fill each `<!-- SECTION -->` stub.
The template has the verbatim CSS + 4-section structure. **Do NOT reconstruct the design from a prior
full briefing** — the template is the source of truth. (You may read 1–2 recent published issues to
calibrate tone and section depth, but not to copy styling.)

Key visual elements (all in the template — no need to re-derive):
- Inter body font + Courier New for labels/eyebrows; red `#DC3545` accent throughout
- Fixed top-right theme toggle (🌙 / ☀️), light default, persisted to `localStorage` key `praxis-theme`
- Pink-gradient `.header` with `.header-label`, `<h1>Praxis</h1>`, `.header-sub`, and a hidden `.tldr-text`
- 4 numbered sections (`.section` + `.section-header` with `.section-number` / `.section-title`)
- Content components: `.card` (with `.card-label`, `<h3>` headline, `<p>` body), `.insight-block`
  (red-bordered synthesis pull), `.takeaway-list` (arrow-bulleted action steps), `.standalone-quote`
  (cited block quote), `.tool-card` (icon + tag + name + description), `.horizon-item` (tagged
  forward-look). `.horizon-tag` classes: `finance | work | regulation | ai | mind | culture | health | crypto`.

## CRITICAL: DO NOT INCLUDE
- **No "← All Briefings" back-navigation bar** as a new addition. (The current template ships with a
  small dark back-link `<div>` linking to `../../index.html` near the top of `<body>` — leave the
  template's existing markup as-is; do not add a *second*, larger nav bar on top of it. The site-wide
  nav bar was removed 2026-05-20 and the index handles navigation.)

---

## Cadence

**Praxis publishes on ODD days of the month** (1, 3, 5, 7, …). Its counterpart, the Biohacker Report,
runs on EVEN days. This is enforced by the health-check bot's missing-briefing detection.

> Source note: the odd-day cadence is **inferred**, corroborated by (a) the published archive —
> issues exist for 2026-06-11 and 2026-06-13 and are absent on 2026-06-12, and the broader `Glob`
> of `briefings/*/praxis-brief.html` shows an all-odd-date pattern through April–June 2026 — and
> (b) the project's known build-system rule that praxis runs odd days / biohacker runs even days.
> If you are running this skill manually on an even day at the user's request, just generate it;
> the cadence rule governs the *scheduled* run and the health-check's absence alarm, not ad-hoc runs.

---

## Trigger

Phrases: "praxis", "praxis brief", "praxis briefing", "briefing praxis", "run praxis", "ideas in practice".

If the user has pasted any of the following, incorporate it directly before generating:
- A newsletter issue, essay, or transcript (Manson, James Clear 3-2-1, Housel/Collab Fund, One Useful
  Thing, Daily Stoic, Farnam Street, a Cookbook/markets note, etc.) → treat it as a primary input
- A book passage, research paper, or quote they want anchored in the issue
- Any link or screenshot → mine it for the week's thread

---

## Step 0: Deduplication Check (do not repeat last issue's thread)

Praxis recurs every other day, so the same idea can resurface fast. Before drafting, scan the **prior
2–3 issues** so you don't re-run the same authors and the same governing thesis. Do NOT read prior
HTML in full — grep the headline lines:

**On Windows (local):**
```powershell
Select-String -Path "C:\Users\Tony\Documents\briefings-site\briefings\*\praxis-brief.html" `
  -Pattern 'card-label|<h3>' -SimpleMatch | Sort-Object Filename | Select-Object -Last 30
```
(The `.card-label` lines carry the source/author; the `<h3>` lines carry the card headlines. Together
they tell you which authors and which thesis you used last time.)

**Rules:**
1. **Don't repeat the thread.** If last issue's governing thesis was "the leverage is internal" built on
   Manson + Housel + Clear, do not lead with the same authors on the same idea two issues running.
2. **A genuinely new development on the same author is fine** — a new Manson piece making a *different*
   point is fair game; re-summarising the same piece is not.
3. **Rotate the disciplines.** Across issues, vary the mix (philosophy / psychology / productivity /
   finance / AI / crypto) so the brief doesn't become single-lane.

---

## Step 1: Source the Week's Ideas

Praxis draws on **curated long-form thinking**, not breaking news. Based on what published issues
actually cite, the primary input categories are:

- **Newsletters / essays (the backbone):** Mark Manson (*The Breakthrough*), James Clear (*3-2-1
  Thursday*), Morgan Housel (*Collab Fund*), Ethan Mollick (*One Useful Thing*), Daily Stoic, Farnam
  Street, Cedric Chin (*Commoncog*), and markets/operator notes (e.g. the *Cookbook* newsletter).
  *(Evidence: the 2026-06-13 issue is built on Manson, James Clear/Housel, and Hershfield; the
  2026-06-11 issue on Mollick, Microsoft WTI, PwC, METR, and Chin; the 2026-04-01 issue on Daily
  Stoic, the School of Practical Philosophy, Manson, Dan Go, and the Cookbook newsletter.)*
- **Books:** the standing reference works behind the week's idea (e.g. Gloria Mark, *Attention Span*;
  Hal Hershfield, *Your Future Self*; Seneca, *On the Shortness of Life*) — surfaced in §03.
- **Research / reports:** the empirical backbone that gives a popular idea teeth (e.g. Hershfield on
  future-self continuity, Gloria Mark's attention data, Microsoft's *Work Trend Index*, METR time
  horizons, PwC surveys).
- **Primary sources:** when a newsletter quotes an essay, go to the essay itself and cite it directly
  (e.g. Housel's "The Biggest Returns" at collabfund.com), not the newsletter's paraphrase.

**The curation bar:** every item must carry a *portable idea* — a mental model, reframe, or practice the
reader keeps after they close the tab. If something is just news, it belongs in another briefing.
Prefer ideas where you can find a **second independent source that converges**, because that convergence
is the issue's spine.

**Verify before anchoring.** Quotes must be verbatim from the named source; numbers (e.g. "47 seconds",
"23 minutes 15 seconds", "67/32") must trace to the actual study or report, not a paraphrase. If you
can't verify a figure, drop it or hedge it — do not manufacture precision. Cite the primary source for
every data point in the footer.

---

## Step 2: Write the Briefing

After sourcing, write the full HTML from `template.html`.

### Voice & Style
- **Lead with the idea, then make it land.** Each card's `<h3>` is a thesis, not a topic — a full
  sentence that states the insight (e.g. "Your Attention Isn't Being Stolen — You're Giving It Away
  Without a Fight"), not a label ("On Attention").
- **Synthesise, don't summarise.** Show how the source's claim connects to a second source or a piece
  of research. End the strongest cards with an `.insight-block` that states the convergence in the
  briefing's own voice (italic, one or two sentences).
- **Bold the load-bearing claims, names, and numbers.** Use `<strong>` for the specific figure or the
  pivotal quote; keep the surrounding prose readable.
- **Action over abstraction in §02.** Strategy cards turn the ideas into a `.takeaway-list` of 3–4
  concrete, do-this-week steps, each with a bold step title.
- **Banned phrases:** "in today's fast-paced world", "now more than ever", "it's important to remember",
  "studies show" (name the study), "experts say" (name the expert).
- **Attribute everything.** Every quote gets its author; every figure gets its source. No anonymous
  "research suggests".

### HTML Structure (in order)
1. `<head>` with `<title>Praxis — [Date]</title>`, `<meta property="og:description">`, full `<style>`
   block (from template — do not re-derive)
2. `<body>` → template's existing back-link `<div>` → `.theme-toggle` button
3. `.header` (label · date, `<h1>Praxis</h1>`, sub-line, **hidden `.tldr-text`**, accent bar)
4. `.container` wrapping the 4 sections
5. `.footer` with the issue's one-line focus + a full sources list
6. The theme-toggle `<script>` (from template)

### Title & Date
- HTML `<title>`: `Praxis — [DD Month YYYY]` (the template ships `Praxis &mdash; {{DATE}}`)
- Header label: `Praxis · Intelligence Briefing · [Date]`
- Use a consistent human date in the header, footer, and `<title>`.

### File saving
Save to:
- **Windows (local):** `C:\Users\Tony\Documents\briefings-site\briefings\YYYY-MM-DD\praxis-brief.html`
- **Cloud/Linux:** `/tmp/praxis-brief-YYYY-MM-DD.html`

The output filename **must** be `praxis-brief.html` — the index/health-check key off this exact name.

---

## Section Structure

The four sections are fixed (verbatim from the template and every published issue). Numbered `01`–`04`:

### 01. Key Ideas & Insights
- The heart of the issue: 3–4 `.card` blocks, one per idea.
- Each card: a `.card-label` eyebrow (format seen in issues:
  `{Source type} · {Author} · "{Item title}" · {Date}` — e.g. `Newsletter · Mark Manson · "You Gave
  Away Your Attention" · Jun 11, 2026`), a thesis `<h3>` headline, 2–3 `<p>` of synthesis, an optional
  `.insight-block` convergence pull, and an optional `.standalone-quote` with a `<cite>`.

### 02. Strategy & Practice
- Turns the ideas into action: 2–3 `.card` blocks.
- Each card: a `.card-label` (`Practice · {who it's drawn from}`), a `<h3>` imperative headline, a short
  intro `<p>`, then a `.takeaway-list` of 3–4 steps (`<li><strong>Step title.</strong> Detail.</li>`),
  with an optional closing `.insight-block`.

### 03. Tools & Resources
- The references behind the week's thread: 4–6 `.tool-card` blocks.
- Each: a `.tool-icon` emoji, a `.tool-tag` (one of: `Primary Source | Concept | Reporting | Book |
  Podcast / Newsletter | Tool | Framework`), a `<h4>` name, and a one-paragraph `<p>` description that
  says *why it's worth the reader's time*. Include a URL/source where natural.

### 04. On the Horizon
- Forward-looking implications: 3–4 `.horizon-item` blocks.
- Each: a `.horizon-tag {class}` pill (`finance | work | regulation | ai | mind | culture | health |
  crypto`), a `<h4>` headline, and one `<p>` of where-this-is-heading analysis tied back to the issue's
  thesis.

---

## Output Contract (REQUIRED for the site to work)

These elements are mandatory — `generate-index.js` and the health-check bot depend on them:

1. **Filename:** `praxis-brief.html`, in `briefings/YYYY-MM-DD/`.
2. **`<title>` element** — present and dated.
3. **`og:description`** — `<meta property="og:description" content="...">` with a **real 1–2 sentence
   content summary** that leads with the convergence thesis and names the key sources. NOT generic
   section names. *(This is the social-preview text and a fallback the validator looks for.)*
4. **Populated hidden `.tldr-text`** — the `<p class="tldr-text" style="display:none">…</p>` in the
   header must contain the **full convergence thesis** (a richer version of the `og:description`).
   **This is what actually drives the index card.** `generate-index.js` Strategy 1 reads `.tldr-text`
   first to build the headline + preview shown on the homepage and the "Today's Lead" hero. Write it as
   real prose with a clear first-sentence thesis (the extractor splits on the first `". Capital"`
   sentence boundary or a semicolon), e.g. the 2026-06-13 issue's *"This week's newsletters converge on
   one move: the highest-leverage gains are internal…"*.
5. **`card-title` elements (extraction fallback — see the mismatch note below).** The index has a
   praxis-specific extractor, **Strategy 3a**, that reads elements matching `class="card-title"` (first
   one → headline, next ones → preview) when the `.tldr-text` path doesn't fully populate. To keep that
   safety net working, the card headlines in §01 should be reachable as `card-title`. **Belt-and-braces
   recommendation: give each §01 card headline both — e.g. `<h3 class="card-title">…</h3>` — so the card
   renders correctly (template styles `.card h3`) AND Strategy 3a can extract it.**
6. **Back-link to `../../index.html`** — keep the template's existing back-link `<div>` (health-check
   expects an index back-link in every briefing).
7. **Theme toggle + `#DC3545` accent** — keep the template's toggle button, the `praxis-theme`
   localStorage logic, and the red accent variables. Light theme is the default.
8. **`gm-meta` block (authoritative card metadata).** Replace `{{GM_META}}` in the template’s
   `<head>` with a JSON object of the form
  `{"headline":"<exact card headline, plain text, no HTML, <=90 chars>","preview":"<one-sentence card summary, plain text, <=180 chars>","tags":["tag1","tag2","tag3"]}` (1-3 short tags).
   It MUST be valid JSON — escape any double quotes inside strings, no trailing commas, and use real
   Unicode characters (no HTML entities like `&amp;` / `&mdash;`). This block is **authoritative**: the
   homepage uses it verbatim for the praxis card’s headline/preview/tags and the “Today’s Lead” hero.
   Keep it consistent with the visible convergence thesis in the hidden `.tldr-text` (same thesis and
   wording). If you omit it or it is malformed, `generate-index.js` silently falls back to scraping
   `.tldr-text` (the old behaviour, item 4) — so filling it is strongly preferred.

> **⚠ Known template/extractor mismatch — VERIFY, don't assume (flagged from evidence this session).**
> The *current* `template.html` and the recent published issues (2026-06-11, 2026-06-13) use
> `<h3>` inside `.card` for headlines and do **not** use a `class="card-title"`. The only archived issue
> that uses `class="card-title"` is the older 2026-04-01 file. Meanwhile `generate-index.js`
> Strategy 3a still matches on `card-title`. In practice the current issues extract fine because the
> populated `.tldr-text` (Strategy 1) wins before 3a is needed — so item 4 above is doing the real work.
> The `card-title` advice in item 5 hardens the fallback at zero cost. If you change the headline markup,
> re-run `generate-index.js` and confirm the praxis card on the index shows your real thesis (not a
> generic section name) before committing.

---

## Pre-Publish Checklist

Run before committing — all must pass:

- [ ] File saved as `briefings/YYYY-MM-DD/praxis-brief.html` (exact filename).
- [ ] `<title>`, `og:description`, and the hidden `.tldr-text` are all present, dated, and lead with the
      **convergence thesis** (not generic section names).
- [ ] §01 has 3–4 idea cards, each with a thesis `<h3>` headline; the strongest carry an `.insight-block`.
- [ ] §01 card headlines are reachable as `card-title` (recommend `<h3 class="card-title">`) so the
      index Strategy 3a fallback can extract them.
- [ ] §02 turns ideas into a `.takeaway-list` of concrete steps; §03 has 4–6 `.tool-card`s with valid
      `.tool-tag`s; §04 has 3–4 `.horizon-item`s with valid `.horizon-tag` classes.
- [ ] Every quote is verbatim + attributed; every figure traces to a primary source; footer lists all
      sources with author, title, publication/URL, and date.
- [ ] Back-link to `../../index.html` present; theme toggle present; accent is `#DC3545`.
- [ ] **Run `node scripts/generate-index.js`** and confirm:
  - no `⚠️` lines for the praxis card (especially `RAW HTML ENTITY in headline` and
    `EMPTY headline` / `EMPTY preview`),
  - **no `⚠  [validator] praxis-brief … headline looks like a section header`** — if you see this, the
    extraction fell back to a generic section name; fix the `.tldr-text` / `card-title` and re-run,
  - output ends with `✓  UI validator: all card extractions look clean`.
- [ ] Open the file and toggle light/dark once to confirm the theme switch works.

---

## Step 3: Publish

**On Windows (local scheduled-task run):** do NOT push manually — the wrapper runs `generate-index.js`
then `git push origin main` after this skill completes. Running both would double-publish.

**On cloud/Linux** (no wrapper), publish via the GitHub Contents API the same way the other briefing
skills do (see `briefing-legal-precedent/SKILL.md` Step 3 for the stdlib Python pattern): base64-encode
the HTML, PUT it to `briefings/YYYY-MM-DD/praxis-brief.html` on `main`, then regenerate the index.

---

## What to Avoid

- A link roundup with no synthesis — the convergence thesis is the whole point.
- Card headlines that are topics ("On Stoicism") instead of theses (a full-sentence insight).
- Fabricated quotes or invented precision on figures — verify against the primary source or cut it.
- A generic `.tldr-text` / `og:description` that just names the sections — it must state the real idea,
  or the index card and hero will read as boilerplate.
- Changing the headline markup without re-running `generate-index.js` to confirm clean extraction.
- Adding a second, larger "← All Briefings" nav bar (the template's small back-link already covers it).
- Single-lane issues — rotate disciplines across the week so Praxis stays cross-disciplinary.
