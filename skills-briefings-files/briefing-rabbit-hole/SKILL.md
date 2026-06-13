---
name: briefing-rabbit-hole
description: >
  Generate the Rabbit Hole briefing — a single-topic deep-dive explainer that takes one fascinating
  subject (a piece of history, science, a market disaster, a strange phenomenon) and follows it all the
  way down: the story, the mechanism behind it, the unexpected connections, and the threads worth
  chasing further. Trigger whenever the user says "rabbit hole", "rabbit-hole", "briefing rabbit hole",
  "run rabbit hole", "deep dive", or any variation requesting the Rabbit Hole report. Also trigger when a
  scheduled task invokes this skill. Rabbit Hole is topic-agnostic and curiosity-driven: history,
  biography, nature, science, technology, geopolitics, market microstructure, "how things work" — one
  topic per issue, explored with depth and narrative momentum. The point is not to summarise the news —
  it is to make one strange or under-explained thing feel inevitable and connected by the end. Output is
  a warm-brown styled HTML file with an amber (#D97706) accent, saved to the GitHub briefings archive at
  briefings/YYYY-MM-DD/rabbit-hole.html.
---

# Rabbit Hole — One Topic, All the Way Down

You are generating "Rabbit Hole" — a recurring intelligence briefing for a sharp, endlessly curious
generalist (an independent trader, operator, and lifelong learner based in Sydney). Where the other
briefings track *the news* (markets, law, AI, health), Rabbit Hole tracks *a single fascination*: it
picks one topic — a forgotten discovery, an engineering catastrophe, a biological oddity, a Cold War
secret — and follows it from the surface story down through the mechanism and out into its unexpected
connections. Each issue is a self-contained essay, not a roundup.

The whole game is **narrative momentum plus depth**. A good issue answers three questions in order:
**what happened, why does it actually work that way, and what does it connect to that you'd never have
guessed?** It opens with a hook that feels almost too strange to be true, earns that strangeness with
real mechanism, and closes by linking the topic outward to other domains (often including the reader's
own — markets, AI, behaviour). If an issue reads as a Wikipedia summary with nicer fonts, it has failed,
no matter how interesting the topic.

**DEPTH AND TRUTH ARE PARAMOUNT.** The signature move of Rabbit Hole is the *earned* surprise: a claim
that sounds unbelievable ("nobody named the smell of rain until 1964", "an automated Soviet system can
still launch the entire arsenal with no human command", "a forgotten server lost $440M in 45 minutes")
followed by the precise, sourced explanation of why it's true. Every striking number in the header
banner and every quote in a pull-quote must trace to a real, citable source listed in the footer. The
voice is confident and vivid, but it never manufactures precision — where the science is uncertain or a
figure isn't directly comparable, the issue says so in its own voice (see the geosmin-vs-shark caveat in
the 2026-06-13 issue: *"The numbers are not directly comparable … but the scale suggests …"*).

---

## CANONICAL DESIGN REFERENCE

Read `template.html` in this folder (`skills-briefings-files/briefing-rabbit-hole/template.html`).
Replace the `{{tokens}}` and fill each `<!-- Section -->` stub. The template has the verbatim CSS +
full structure. **Do NOT reconstruct the design from a prior full briefing** — the template is the
source of truth. (You may read 1–2 recent published issues to calibrate tone, depth, and section
length — e.g. 2026-06-13, 2026-06-12, 2026-06-11 — but not to copy styling.)

Key visual elements (all in the template — no need to re-derive):
- `Syne` body font + `DM Serif Display` for headlines/`<h1>`/section `<h2>` + `DM Mono` for
  labels/eyebrows; warm-brown `#78350F` header on an `#F4F5F8` page, amber `#D97706` accent throughout.
- `.header` (brown, rounded top) with `.header-label` (`Rabbit Hole · {date}`), the **`.header-category`**
  eyebrow (drives index tags — see contract), `<h1>` with an `<em>` accent phrase, a `.header-meta`
  one-line summary, a hidden `.tldr-text`, and a 4-up `.header-banner` of `.header-stat`
  (`.stat-value` + `.stat-label`) for the issue's killer numbers.
- A white `.tldr-section` (amber left border) with a `.tldr-label` + a single rich TL;DR `<p>`.
- Numbered `.section` blocks (`.section-number` "Section 0N" + `<h2>`), with content components:
  `.pull-quote` (brown box, big serif, optional `<em>` accent and an inline attribution line),
  `.data-callout` (amber `#FEF3C7` box with a `.dc-label` eyebrow + `<p>`) for a person, study, dataset,
  or named episode that earns its own box.
- A `.cards-section` ("Further Down the Hole") with a `.cards-grid` of `.card` (`.card-icon` emoji +
  `.card-title` + `.card-text`).
- A dark `.footer` ("Sources") with a `.sources-list` of linked `<li>` source citations.

## CRITICAL: DO NOT INCLUDE
- **No NEW "← All Briefings" navigation bar.** The current template ships with a small dark back-link
  `<div>` linking to `../../index.html` at the top of `<body>` — leave that template markup exactly as
  is; do not add a *second*, larger nav bar on top of it. (The site-wide nav bar was removed 2026-05-20
  and the index page handles navigation.)

---

## Cadence

**Rabbit Hole publishes DAILY** — it is one of the daily briefing types, not part of an odd/even pair.
(The praxis/biohacker pair alternates odd/even days; Rabbit Hole runs every day.) This is enforced by
the health-check bot's missing-briefing detection, which expects a `rabbit-hole.html` for each day.

> Source note: the daily cadence is **stated as a known build-system fact** for this task and is
> corroborated by the published archive — `Glob` of `briefings/*/rabbit-hole.html` shows issues on
> effectively consecutive days through April–June 2026 (e.g. 2026-06-11, 2026-06-12, 2026-06-13),
> including both odd and even dates, which rules out an odd/even split.

---

## Trigger

Phrases: "rabbit hole", "rabbit-hole", "briefing rabbit hole", "run rabbit hole", "deep dive".

If the user has pasted any of the following, treat it as the seed for the issue before generating:
- A topic, question, or "did you know…" prompt → that is the rabbit hole; go research it.
- An article, paper, thread, or link → mine it for the spine of the story and chase its primary sources.
- A screenshot or quote they want anchored in the issue → build the issue around it.

If no topic is supplied, pick one yourself: a single, specific, *surprising* subject with a real
mechanism and real sources behind it. Favour topics that connect outward to the reader's interests
(markets, behaviour, AI, systems failure) but the brief is genuinely topic-agnostic — history, nature,
biography, and "how things work" are all in-scope, as the archive shows.

---

## Step 0: Deduplication Check (don't re-run a recent topic)

Rabbit Hole runs daily, so it is easy to drift back to a recent subject or domain. Before drafting, scan
the **prior 3–4 issues** so you don't repeat a topic or lean on the same category two days running. Do
NOT read prior HTML in full — grep the headline/category lines:

**On Windows (local):**
```powershell
Select-String -Path "C:\Users\Tony\Documents\briefings-site\briefings\*\rabbit-hole.html" `
  -Pattern '<title>|header-category' -SimpleMatch | Sort-Object Filename | Select-Object -Last 30
```
(The `<title>` lines carry the topic; the `header-category` lines carry the domain pair, e.g.
`Nature · How Things Work`, `Geopolitics · History`, `Market Microstructure · Algorithmic Trading`.)

**Rules:**
1. **Don't repeat the topic.** A topic covered in the last 3–4 issues is off the table.
2. **Rotate the domain.** Vary the `header-category` across issues so the brief doesn't become
   single-lane (don't run "Market Microstructure" three days in a row just because it's the reader's
   world).
3. **A genuinely new angle on a recurring theme is fine** — a different disaster, a different organism,
   a different war — but not the same story re-told.

---

## Step 1: Research the Topic (primary sources, verify the surprises)

Rabbit Hole is **research-grade**. Based on what published issues actually cite, the input is:

- **Primary and authoritative sources (the backbone):** the original paper or filing, the institution's
  own write-up, the definitive book. *(Evidence: the 2026-06-13 petrichor issue cites the original 1964
  Bear & Thomas paper in* Nature*, the CSIRO write-up, the 2015 MIT/* Nature Communications *aerosol
  paper, the 2024 OR11A1 receptor paper in the* Journal of Agricultural and Food Chemistry*, and a 2020*
  Nature Microbiology *study; the 2026-06-11 Perimeter issue cites GlobalSecurity.org, the National
  Security Archive, the* Bulletin of the Atomic Scientists*, and David Hoffman's* The Dead Hand*; the
  2026-06-12 Knight Capital issue cites the SEC press release, the firm's SEC EDGAR 8-K, a WilmerHale
  client alert, and the SEC's Reg SCI.)*
- **Reference encyclopaedia entries (orientation, not authority):** Wikipedia and similar appear in
  footers as a starting map (e.g. the Petrichor/Geosmin entries), but the load-bearing claims are pinned
  to the primary source, not the encyclopaedia.
- **The killer numbers:** every `.header-stat` value (a year, a threshold, a dollar figure, a duration)
  must come from a source you can cite — these are the issue's most scrutinised claims because they sit
  in the banner.

**The curation bar:** the topic must carry at least one *earned surprise* — a fact that sounds
implausible until the mechanism explains it — plus enough verifiable substance to fill the four sections
without padding. If you can't source the surprise, pick a different topic.

**Verify before anchoring.** Quotes in `.pull-quote` must be verbatim and attributed (see the Yarynich
quote in the 2026-06-11 issue, with an inline `— Name, role, year` line). Numbers must trace to the
actual study/filing, not a paraphrase. Where a comparison is loose or the science is contested, say so
in the prose rather than manufacturing precision. Cite the primary source for every data point in the
footer.

---

## Step 2: Write the Briefing

After researching, write the full HTML from `template.html`.

### Voice & Style
- **Open with the hook, then earn it.** The `<h1>` and the first paragraph of Section 01 state the
  almost-unbelievable thing; the rest of the issue makes it feel inevitable. Headlines are vivid and
  specific ("The Smell Nobody Could *Name* Until 1964", "How Knight Capital Lost $440M in 45 Minutes"),
  with the sharpest phrase wrapped in `<em>` for the amber accent.
- **Explain the mechanism for real.** Section 02 is where depth is proven — the actual chemistry,
  physics, code path, or decision tree. Don't hand-wave; walk the reader through how it works.
- **Connect outward.** Section 03 paragraphs each open with a bold `<strong>Short label.</strong>` and
  link the topic to other domains, competing explanations, an ironic coda, and the live/modern dimension
  (the published issues consistently land an AI or markets parallel here when the topic allows).
- **Bold the load-bearing names, numbers, and turns.** Use `<strong>` for the pivotal figure or claim;
  keep the surrounding prose readable.
- **Use the components deliberately.** `.pull-quote` for a striking quote or turning point;
  `.data-callout` for a person, study, dataset, or named episode that deserves its own box. Don't
  overuse them — roughly one or two per section.
- **Banned phrases:** "in today's fast-paced world", "now more than ever", "it's important to remember",
  "studies show" (name the study), "experts say" (name the expert), "little did they know".
- **Attribute everything.** Every quote gets its author; every figure gets its source. No anonymous
  "research suggests".

### HTML Structure (in order)
1. `<head>` with `<title>Rabbit Hole — [Topic] — [Date]</title>`, `<meta property="og:description">`,
   the full `<style>` block (from template — do not re-derive), and the **`gm-meta`** `<script>` block.
2. `<body>` → template's existing back-link `<div>` → `.page-wrap`.
3. `.header` (label · date, `.header-category`, `<h1>`, `.header-meta`, hidden `.tldr-text`, 4-up
   `.header-banner`).
4. `.tldr-section` (rich TL;DR paragraph).
5. The four numbered sections (01–04; 04 is the `.cards-section`).
6. `.footer` with the full sources list.

### Title & Date
- HTML `<title>`: `Rabbit Hole — [Topic Title] — [DD Month YYYY]` (the template ships
  `Rabbit Hole &mdash; {{TOPIC_TITLE}} &mdash; {{DATE}}`).
- Header label: `Rabbit Hole · [DD Month YYYY]`.
- Use a consistent human date in the header, `og:description`, and `<title>`.

### File saving
Save to:
- **Windows (local):** `C:\Users\Tony\Documents\briefings-site\briefings\YYYY-MM-DD\rabbit-hole.html`
- **Cloud/Linux:** `/tmp/rabbit-hole-YYYY-MM-DD.html`

The output filename **must** be `rabbit-hole.html` — the index/health-check key off this exact name.

---

## Section Structure

The four numbered sections are the canonical spine (verbatim section *numbers* from the template; the
`<h2>` titles may be topic-specific). Each published issue uses `Section 01`–`Section 04`:

### 01. The Story
- The narrative opening: 3–5 `<p>` introducing the protagonist, discovery, or inciting event, built
  around the hook.
- Use one `.pull-quote` for a striking quote or turning point, and one `.data-callout` for a key person
  or named episode that deserves its own box.
- The `<h2>` can be the generic "The Story" or a topic-specific title — published issues do both
  (2026-06-13 uses "The Story"; 2026-06-12 uses "The Morning Everything Broke"). The `.section-number`
  stays "Section 01" either way.

### 02. The Mechanism
- The depth section: 3–5 `<p>` explaining the underlying logic, science, system, or code path — *how and
  why it actually works*.
- Use a `.pull-quote` for the core insight stated most sharply and a `.data-callout` for a key study,
  dataset, component, or named finding.
- `<h2>` is "The Mechanism" or a topic-specific equivalent ("Why Markets Are Built to Fail This Way").

### 03. The Connections
- The outward turn: 4–6 `<p>`, **each opened with a `<strong>Short label.</strong>**. Cover
  cross-domain / international parallels, why competing explanations fall short, an ironic or tragic
  coda, and the current/live dimension (often the AI or markets tie-in).
- Use one `.data-callout` for a named modern application or ongoing parallel.
- `<h2>` is "The Connections" or a topic-specific equivalent ("What Knight Changed — and What It
  Didn't").

### 04. Further Down the Hole
- A `.cards-section` with a `.cards-grid` of **4–5 `.card`s**, each a thread worth chasing further: a
  `.card-icon` emoji, a `.card-title` (the book, concept, person, or sub-rabbit-hole), and a
  `.card-text` of 1–3 sentences saying *why it's worth the reader's time*. Reference real books, papers,
  or articles where natural (e.g. *The Dead Hand*, the Wired Yarynich interview).
- `<h2>` is "Further Down the Hole" in every published issue.

---

## Output Contract (REQUIRED for the site to work)

These elements are mandatory — `generate-index.js` and the health-check bot depend on them:

1. **Filename:** `rabbit-hole.html`, in `briefings/YYYY-MM-DD/`.
2. **`<title>` element** — present and dated.
3. **`og:description`** — `<meta property="og:description" content="...">`. The template ships a generic
   `Rabbit Hole — {{TOPIC_TITLE}} — {{DATE}}` here, which matches the published issues; for a richer
   social preview you may write a real one-sentence summary of the topic, but a dated topic line is
   acceptable and is what the archive currently uses. (Health-check looks for an `og:description` *or* a
   `meta name="description"`; keep the `og:description`.)
4. **`.header-category` eyebrow (drives the index TAGS).** Fill `{{PRIMARY_CATEGORY}} &middot;
   {{SECONDARY_CATEGORY}}` with the issue's domain pair, e.g. `Nature · How Things Work`,
   `Geopolitics · History`, `Market Microstructure · Algorithmic Trading`. The shared extractor
   (`scripts/lib/briefings.js`) reads `class="header-category">…</div>`, **splits on `·`**, and uses the
   parts as the card's tags. If `.header-category` is missing, tags fall back to capitalised words
   scraped from `<strong>` blocks — so always fill it with a clean, real category pair (no HTML
   entities in the visible text).
5. **Populated hidden `.tldr-text`** — the `<p class="tldr-text" style="display:none">…</p>` in the
   header. **This is the headline/preview fallback that actually drives the index card when no `gm-meta`
   is present** (which is the case for every published issue to date). `generate-index.js` Strategy 1
   reads `.tldr-text`, takes the **first sentence as the card headline** (split on a `". Capital"`
   boundary or a semicolon) and the **second sentence as the preview**. Write it as real prose with a
   clear first-sentence hook, e.g. the 2026-06-13 issue's *"The smell of rain has a name — petrichor —
   but nobody coined it until 1964 …"*. If `.tldr-text` is empty, the index falls back to a generic
   section title and the validator warns — so this must always be populated even when you also fill
   `gm-meta`.
6. **`gm-meta` block (authoritative card metadata — PREFERRED path).** Replace `{{GM_META}}` in the
   template's `<head>` with a JSON object of the form
   `{"headline":"<exact card headline, plain text, no HTML, <=90 chars>","preview":"<one-sentence card summary, plain text, <=180 chars>","tags":["tag1","tag2","tag3"]}`
   (1–3 short tags). It MUST be valid JSON — escape any double quotes inside strings, no trailing commas,
   and use real Unicode characters (no HTML entities like `&amp;` / `&mdash;` — write `—` and `&`
   directly). This block is **authoritative**: `readMeta()` in `generate-index.js` runs *first* and, if
   the block is present and has a non-empty `headline`, the homepage uses its `headline`/`preview`/`tags`
   **verbatim** and skips all the regex strategies. Keep it consistent with the visible
   `.header-category` (tags) and the hidden `.tldr-text` (same hook and wording). If you omit it or it is
   malformed, `generate-index.js` silently falls back to scraping `.tldr-text` (item 5) and
   `.header-category` (item 4) — the legacy behaviour — so filling `gm-meta` is strongly preferred but the
   fallbacks must still be correct.
7. **Back-link to `../../index.html`** — keep the template's existing back-link `<div>` (health-check
   expects an index back-link in every briefing). Do not add a second, larger nav bar.
8. **Amber `#D97706` accent + warm-brown `#78350F` header** — keep the template's palette and fonts
   (`Syne` / `DM Serif Display` / `DM Mono`). No theme toggle (this template is single-theme, unlike
   praxis).

---

## Pre-Publish Checklist

Run before committing — all must pass:

- [ ] File saved as `briefings/YYYY-MM-DD/rabbit-hole.html` (exact filename).
- [ ] `<title>`, `og:description`, and the hidden `.tldr-text` are all present and dated; the
      `.tldr-text` leads with a clear first-sentence hook (the card headline) and has a strong second
      sentence (the preview).
- [ ] `.header-category` is filled with a real `Primary · Secondary` domain pair (no HTML entities in
      the visible text), and the 4 `.header-stat`s carry real, sourced numbers.
- [ ] `gm-meta` block present and **valid JSON** — `headline` ≤90 chars, `preview` ≤180 chars, 1–3
      `tags`, real Unicode (no `&amp;`/`&mdash;`), no trailing commas, double quotes escaped. Consistent
      with `.tldr-text` and `.header-category`.
- [ ] §01 (The Story) opens with the hook and runs 3–5 `<p>` with one `.pull-quote` + one
      `.data-callout`; §02 (The Mechanism) actually explains how it works; §03 (The Connections) has 4–6
      `<strong>`-led paragraphs; §04 (Further Down the Hole) has 4–5 `.card`s.
- [ ] Every quote is verbatim + attributed; every header-banner number and in-text figure traces to a
      primary source; the footer `.sources-list` lists all sources with author/org, title, and link.
- [ ] Back-link to `../../index.html` present; no second nav bar; amber accent + brown header intact.
- [ ] **Run `node scripts/generate-index.js`** and confirm:
  - no `⚠️` lines for the rabbit-hole card (especially `RAW HTML ENTITY in headline` and
    `EMPTY headline` / `EMPTY preview`),
  - **no `⚠  [validator] rabbit-hole … headline looks like a section header`** — if you see this, the
    extraction fell back to a generic section name; fix the `gm-meta` / `.tldr-text` and re-run,
  - the rabbit-hole card shows your real topic headline + tags (from `gm-meta`, or from
    `.tldr-text` + `.header-category` if you didn't emit `gm-meta`),
  - output ends with `✓  UI validator: all card extractions look clean`.

---

## Step 3: Publish

**On Windows (local scheduled-task run):** do NOT push manually — the wrapper runs `generate-index.js`
then `git push origin main` after this skill completes. Running both would double-publish. (Per the
project `CLAUDE.md`, all automated/scheduled work lands on `main`.)

**On cloud/Linux** (no wrapper), publish via the GitHub Contents API the same way the other briefing
skills do: base64-encode the HTML, PUT it to `briefings/YYYY-MM-DD/rabbit-hole.html` on `main`, then
regenerate the index.

---

## What to Avoid

- A Wikipedia-style summary with no earned surprise and no mechanism — the depth and the "how it
  actually works" are the whole point.
- A topic with no citable primary source for its central surprising claim — pick a different topic.
- Fabricated quotes or invented precision on figures — verify against the primary source or cut it; flag
  loose comparisons in the prose.
- A missing or generic `.header-category` (breaks the tags) or an empty `.tldr-text` (breaks the index
  headline/preview when no `gm-meta` is present).
- A malformed `gm-meta` block (HTML entities, trailing commas, unescaped quotes) — it silently disables
  the preferred path and may surface entity jibberish; re-run `generate-index.js` to confirm clean
  extraction.
- Adding a second, larger "← All Briefings" nav bar (the template's small back-link already covers it).
- Repeating a topic or domain from the last 3–4 issues — rotate the rabbit hole.
- Changing the headline/category markup without re-running `generate-index.js` to confirm the
  rabbit-hole card still extracts your real topic.
