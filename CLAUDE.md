# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

GM Research is a static GitHub Pages site (https://ngmicapital.github.io/GM-Research/) publishing daily AI-generated intelligence briefings, video transcripts, and visualizations. There is **no package.json and no third-party dependencies** — tooling is plain Node (≥20, stdlib only) scripts in `scripts/`, with shared helpers in `scripts/lib/` covered by a zero-dependency `node:test` suite. The site is plain hand-written/generated HTML.

## Branch policy for automated tasks

**Health check bot and all scheduled/automated tasks must push directly to `main`.**

The harness assigns a random feature branch (`claude/pensive-darwin-*` etc.) per session for safety, but for this repo all bot work should land on main immediately. At the end of every automated task:

1. Note your current branch (call it `FEATURE_BRANCH`)
2. Run: `git checkout main && git pull origin main`
3. Cherry-pick your commits: `git log --oneline origin/main..FEATURE_BRANCH` → `git cherry-pick <sha>...`
4. Push: `git push origin main`

If cherry-pick has conflicts (unlikely for health checks), abort and push the feature branch — a human will merge.

This is intentional and authorised. Do not skip this step. (User-initiated tasks follow whatever branch instructions the session gives.)

## Key commands

```
node scripts/generate-index.js           # regenerate index.html (run after any briefing change)
node scripts/generate-visualizations.js  # regenerate visualizations.html
node scripts/health-check.js             # full site health check; auto-fixes tables/images, writes health-reports/YYYY-MM-DD.json
node scripts/fetch-ticker.js             # refresh data/ticker.json from Yahoo Finance (normally run hourly by CI)
node scripts/generate-corpus.js          # regenerate corpus.html — requires a sibling ../corpus checkout, not present in this repo
node --test scripts/lib/lib.test.js      # unit tests for the shared lib (also run in CI)
node scripts/generate-index.js --strict  # as above, but exit non-zero on extraction warnings (authoring pre-publish gate)
```

## generate-index.js warnings are BLOCKING — fix before committing

Any `⚠️` line in `generate-index.js` output is a defect in the published site. **Do not commit until all warnings are resolved.** (The script always exits 0 — warnings do not fail the build, so you must read the output.)

The most common warning is `RAW HTML ENTITY in headline` — an HTML entity (e.g. `&minus;`, `&times;`, `&plusmn;`) survived into the extracted headline text and will display as literal jibberish on the index page. Fix it one of two ways (do both if the entity is new):

1. **Fix the source briefing** — replace the entity with the actual Unicode character in any text that gets extracted as a headline (the `.tldr-text` or `.tldr p` element). E.g. replace `&minus;` with `−`.
2. **Fix the extractor** — add the entity to the `stripHtml` named-entity list in `scripts/lib/text.js` (shared by all generators). This prevents recurrence in all future briefings.

Re-run `node scripts/generate-index.js` after the fix and confirm the output ends with `✓  UI validator: all card extractions look clean` before proceeding.

Two distinct check layers run after the build:
- **Extraction warnings** (`⚠️` / `⚠  [validator]`) — content-quality issues (generic headline, raw entity, empty preview). Non-fatal by default; `node scripts/generate-index.js --strict` makes them exit non-zero (briefing-authoring pre-publish gate).
- **Output-integrity check** (`✗  OUTPUT INTEGRITY FAILED`) — broken generated markup (backslash-close tag artifacts, unbalanced `<b>`/`<small>`). Always **FATAL** — a generator/template bug that must never publish.

## Architecture

### Content pipeline

```
skills-briefings-files/<type>/SKILL.md + template.html   (briefing authoring skills)
        ↓ (Claude writes a new briefing)
briefings/YYYY-MM-DD/<slug>.html                          (one folder per day)
        ↓ node scripts/generate-index.js                  (regex-extracts headline/preview/tags)
index.html                                                (generated — never hand-edit)
        ↓ push to main → .github/workflows/deploy.yml     (re-runs both generators, deploys Pages)
```

- **Seven briefing types**, fixed filenames: `market-briefing.html`, `legal-brief.html`, `ai-briefing.html`, `biohacker-report.html`, `rabbit-hole.html`, `praxis-brief.html`, `trading-concept.html`. Five are expected daily; `praxis-brief` runs odd days-of-month, `biohacker-report` even days (enforced by health-check's missing-briefing detection).
- **Each type has an authoring skill** in `skills-briefings-files/<type>/` with a `SKILL.md` and a canonical `template.html`. The template is the styling source of truth — do not derive styling from prior briefing HTML.
- **`index.html` and `visualizations.html` are generated artifacts.** Edit the generators in `scripts/`, never the output. The deploy workflow regenerates both on every push to main, so stale committed copies are harmless but warnings are not.
- **Shared build library** in `scripts/lib/` is the single source of truth for cross-script logic: `text.js` (`escapeHtml`/`stripHtml`), `dates.js` (date formatters + AEST `today`), `briefings.js` (`BRIEFING_META`, `ORDER`, `BRIEFING_FILENAMES`, `TAG_PATTERNS`, `extractTags`). `generate-index.js`, `generate-visualizations.js` and `health-check.js` all import from it — **do not re-add per-script copies.** Covered by `scripts/lib/lib.test.js`.
- **CI** (`.github/workflows/ci.yml`) runs on feature branches + PRs to main: syntax check, lib unit tests, run both generators, assert no markup artifacts. Direct-to-main briefing pushes are covered by `deploy.yml` instead.

### Headline/tag extraction (the fragile part)

`scripts/generate-index.js` extracts each briefing's card content via regex strategies keyed to CSS classes in the briefing HTML: `.tldr-text` / `.tldr p` / `.tldr li` (most types), `story-title` (legal-brief), `card-title` (praxis-brief), `header-category` (rabbit-hole), with a generic `section-title` fallback that triggers validator warnings. New briefings must include one of these elements or the index card degrades.

Per-type tag regex patterns + the `extractTags` logic now live in **one place** — `scripts/lib/briefings.js` (`TAG_PATTERNS` / `extractTags`), imported by both `generate-index.js` and `health-check.js`. Change tags there once; the two scripts can no longer diverge (they previously did, for `biohacker-report` and `trading-concept`). `extractTags` resets each pattern's `lastIndex`, so the module-scoped regexes are safe to reuse across calls.

### Other site sections

- **`transcripts/<slug>/index.html`** + `transcripts/manifest.json` — manifest entries carry `slug`, `date`, `has_echo`, `has_spark`; health-check validates that flagged `echo.html` / `spark_*.html` files exist.
- **`data/ticker.json`** — equity/macro quotes (SPX, WTI, Gold, VIX, DXY) baked hourly by `.github/workflows/update-ticker.yml` via `fetch-ticker.js`; the index page reads it client-side (crypto prices come live from CoinGecko in the browser). `deploy.yml` has `paths-ignore: data/ticker.json`, so the hourly ticker-only commit does **not** trigger a Pages rebuild — `ticker.json` is republished on the next content deploy (briefings publish several times daily; equity/macro levels are daily-grain so this is fresh enough).
- **`scout/`** — weekly content-discovery routine that overwrites `content-scout.html` at the repo root; see `scout/README.md`. Channel-list changes must also be applied to the Cowork skill's copy of `scan_channels.py`.
- **`corpus.html`**, **`wyckoff.html`**, **`recipes/`** — additional standalone pages; `corpus.html` is generated from a sibling `../corpus` repo by `generate-corpus.js`.
- **`health-reports/`** — JSON + summary output of `health-check.js`. Listed in `.gitignore` but historical reports are force-tracked; new reports need `git add -f`.
- **`skills-briefings-files/**/drafts/`** — gitignored. Finished-but-unpublished briefings live here until promoted into `briefings/YYYY-MM-DD/`. The whole repo deploys to Pages, so drafts must stay untracked to avoid being publicly fetchable.

### Health check behavior

`scripts/health-check.js` both reports and **mutates briefing files in place**: it wraps bare `<table>`s in `<div style="overflow-x:auto">` and adds `max-width:100%;height:auto` to unbound `<img>`s. Its report buckets findings into `auto_fixed`, `needs_ai` (e.g. rabbit-hole tag suggestions, headline-quality warnings parsed from generate-index stderr), and `needs_human`.

## Conventions

- **Timezone is AEST** (`Australia/Sydney`) — `generate-index.js` computes "today" in AEST for the lead-story hero and TODAY tag. Date folders follow that convention; occasional gap days are normal.
- Briefing pages must keep a `<title>`, an `og:description` (or `meta name="description"`), and a back-link to the index (`../../index.html`) — health-check flags recent files missing these.
- Do not add a "← All Briefings" back-navigation bar at the top of briefing bodies — removed site-wide 2026-05-20; the index handles navigation.
- Commit message style follows the existing history: `Add <type> for YYYY-MM-DD`, `chore: daily health check [YYYY-MM-DD]`, `chore(index): regenerate ...`.
