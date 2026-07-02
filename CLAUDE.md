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
node scripts/render-briefing.js <type> <content.json> <out.html>   # deterministic renderer: content-contract JSON → final briefing HTML
node scripts/publish-briefing.js --type <type> --date YYYY-MM-DD   # THE publish path for automated jobs: strict-gate + lock + commit + push + verify
node scripts/generate-index.js           # regenerate index.html (run after any briefing change)
node scripts/generate-visualizations.js  # regenerate visualizations.html
node scripts/health-check.js             # full site health check; auto-fixes tables/images, writes health-reports/YYYY-MM-DD.json
node scripts/fetch-ticker.js             # refresh data/ticker.json from Yahoo Finance (normally run hourly by CI)
node scripts/generate-corpus.js          # regenerate corpus.html — requires a sibling ../corpus checkout, not present in this repo
node --test scripts/lib/lib.test.js scripts/lib/render.test.js scripts/lib/publish.test.js   # full unit suite (also gates ci.yml AND every deploy)
node scripts/generate-index.js --strict  # as above, but exit non-zero on extraction warnings (authoring pre-publish gate)
```

## generate-index.js warnings are BLOCKING — fix before committing

Any `⚠️` line in `generate-index.js` output is a defect in the published site. **Do not commit until all warnings are resolved.** (The script always exits 0 — warnings do not fail the build, so you must read the output.)

The most common warning is `RAW HTML ENTITY in headline` — an HTML entity (e.g. `&minus;`, `&times;`, `&plusmn;`) survived into the extracted headline text and will display as literal jibberish on the index page. Fix it one of two ways (do both if the entity is new):

1. **Fix the source briefing** — replace the entity with the actual Unicode character in any text that gets extracted as a headline (the `.tldr-text` or `.tldr p` element). E.g. replace `&minus;` with `−`.
2. **Fix the extractor** — add the entity to the `stripHtml` named-entity list in `scripts/lib/text.js` (shared by all generators). This prevents recurrence in all future briefings.

Re-run `node scripts/generate-index.js` after the fix and confirm the output ends with `✓  UI validator: all card extractions look clean` before proceeding.

Three distinct check layers run after the build:
- **Extraction warnings** (`⚠️` / `⚠  [validator]`) — content-quality issues (generic headline, raw entity, empty preview). Non-fatal by default; `node scripts/generate-index.js --strict` makes them exit non-zero (briefing-authoring pre-publish gate).
- **Output-integrity check** (`✗  OUTPUT INTEGRITY FAILED`) — broken generated markup (backslash-close tag artifacts, unbalanced `<b>`/`<small>`). Always **FATAL** — a generator/template bug that must never publish.
- **Blocking content defects** (`X  BLOCKING content defect(s)`) — a leaked template token (`{{...}}`), a leftover `<!-- TEMPLATE for ... -->` comment, or a raw HTML entity in extracted card text, in any of the latest 3 dates. Always **FATAL regardless of `--strict`** — these publish visibly-broken briefings.

## Architecture

### Content pipeline

```
skills-briefings-files/<type>/content-guide.md            (authoring contract per type)
        ↓ (a pinned-Sonnet writer produces structured JSON)
skills-briefings-files/<type>/drafts/content-YYYY-MM-DD.json   (gitignored draft)
        ↓ node scripts/render-briefing.js                 (deterministic render, zero AI — template.render.html + scripts/lib/render.js)
briefings/YYYY-MM-DD/<slug>.html                          (one folder per day)
        ↓ node scripts/publish-briefing.js                (strict gate + publish lock + commit + push + content-verify)
        ↓ push to main → .github/workflows/deploy.yml     (tests + both generators, deploys Pages)
index.html / feed.xml / sitemap.xml / visualizations.html (generated — never hand-edit)
```

- **The deterministic renderer is the production authoring path for all 7 types** (since 2026-06-27): the model writes a smaller content-contract JSON; `scripts/render-briefing.js` + `scripts/lib/render.js` turn it into final styled HTML via each type's `template.render.html`, enforcing per-section depth floors (an under-delivering model aborts the render instead of publishing a stunted page). Its byte-stable output contract lives in `scripts/lib/render.test.js` (24 tests) — changes must keep those green or consciously update them. The legacy full-HTML skills remain as fallback only.
- **Publishing goes through `scripts/publish-briefing.js` — automated jobs must never run raw `git add/commit/push` here.** Multiple scheduled briefing jobs share this one checkout; the publisher serializes them with an on-disk lock (`.git/gm-publish.lock`, stale-takeover), runs `generate-index.js --strict` + `generate-visualizations.js` after syncing, stages only the given content files plus the generated artifacts, auto-resolves rebase conflicts on generated artifacts only, and exits 0 only after verifying the file's blob hash on `origin/main`. Contract in `scripts/lib/publish.test.js`.
- **Seven briefing types**, fixed filenames: `market-briefing.html`, `legal-brief.html`, `ai-briefing.html`, `biohacker-report.html`, `rabbit-hole.html`, `praxis-brief.html`, `trading-concept.html`. Four are expected daily; `rabbit-hole` runs Mon–Fri; `praxis-brief` runs odd days-of-month, `biohacker-report` even days (all enforced by health-check's missing-briefing detection; a 07:45 AEST scheduled recovery task regenerates misses).
- **Skill folder ↔ type key ↔ filename mapping** (folder names do NOT match filenames — authoritative table is `TEMPLATES` in `scripts/render-briefing.js`): `briefing-morning-edge/`→`market-briefing`, `briefing-legal-precedent/`→`legal-brief`, `briefing-ai-cortex/`→`ai-briefing`, `briefing-alpha/trading-concept/`→`trading-concept`, `briefing-rabbit-hole/`→`rabbit-hole`, `briefing-praxis/`→`praxis-brief`, `briefing-biohacker/`→`biohacker-report`.
- **Each type has an authoring skill** in `skills-briefings-files/<type>/` with a `content-guide.md` + `template.render.html` (renderer path) and a legacy `SKILL.md` + `template.html` (fallback). The render template is the styling source of truth — do not derive styling from prior briefing HTML.
- **`index.html` and `visualizations.html` are generated artifacts.** Edit the generators in `scripts/`, never the output. The deploy workflow regenerates both on every push to main, so stale committed copies are harmless but warnings are not.
- **Shared build library** in `scripts/lib/` is the single source of truth for cross-script logic: `text.js` (`escapeHtml`/`stripHtml`), `dates.js` (date formatters + AEST `today`), `briefings.js` (`BRIEFING_META`, `ORDER`, `BRIEFING_FILENAMES`, `TAG_PATTERNS`, `extractTags`), `render.js` (deterministic renderer), `publish.js` (serialized publish flow). `generate-index.js`, `generate-visualizations.js` and `health-check.js` all import from it — **do not re-add per-script copies.** Covered by `lib.test.js` + `render.test.js` + `publish.test.js`.
- **CI** (`.github/workflows/ci.yml`) runs on feature branches + PRs to main: syntax check, all three unit suites, run both generators, assert no markup artifacts. Direct-to-main pushes are gated by `deploy.yml`, which also runs all three suites before building — a failing test blocks the deploy and `notify-failure.yml` alerts Telegram.

### Headline/tag extraction (the fragile part)

`scripts/generate-index.js` extracts each briefing's card content via regex strategies keyed to CSS classes in the briefing HTML: `.tldr-text` / `.tldr p` / `.tldr li` (most types), `story-title` (legal-brief), `card-title` (praxis-brief), `header-category` (rabbit-hole), with a generic `section-title` fallback that triggers validator warnings. New briefings must include one of these elements or the index card degrades.

Per-type tag regex patterns + the `extractTags` logic now live in **one place** — `scripts/lib/briefings.js` (`TAG_PATTERNS` / `extractTags`), imported by both `generate-index.js` and `health-check.js`. Change tags there once; the two scripts can no longer diverge (they previously did, for `biohacker-report` and `trading-concept`). `extractTags` resets each pattern's `lastIndex`, so the module-scoped regexes are safe to reuse across calls.

### Other site sections

- **`transcripts/<slug>/index.html`** + `transcripts/manifest.json` — manifest entries carry `slug`, `date`, `has_echo`, `has_spark`; health-check validates that flagged `echo.html` / `spark_*.html` files exist.
- **`data/ticker.json` + the `ticker-data` branch** — equity/macro quotes (SPX, WTI, Gold, VIX, DXY). `update-ticker.yml` (cron every 3h) runs `fetch-ticker.js` and publishes the JSON to a dedicated **`ticker-data` orphan branch** via git plumbing (`commit-tree`/`push refs/heads/ticker-data`) — so **main gets zero ticker commits**. The index reads it client-side from `https://raw.githubusercontent.com/ngmicapital/GM-Research/ticker-data/data/ticker.json` (CORS-enabled, ~5min cache), falling back to the same-origin `data/ticker.json` snapshot if the CDN is unavailable. Crypto prices come live from CoinGecko in the browser. (`deploy.yml`'s `paths-ignore: data/ticker.json` is now redundant — main's copy no longer changes — but harmless. To update the ticker manually, run `fetch-ticker.js` then push the JSON to `ticker-data`.)
- **`scout/`** — weekly content-discovery routine that overwrites `content-scout.html` at the repo root; see `scout/README.md`. Channel-list changes must also be applied to the Cowork skill's copy of `scan_channels.py`.
- **`corpus.html`**, **`wyckoff.html`**, **`recipes/`** — additional standalone pages; `corpus.html` is generated from a sibling `../corpus` repo by `generate-corpus.js`.
- **`health-reports/`** — JSON + summary output of `health-check.js`. Listed in `.gitignore` but historical reports are force-tracked; new reports need `git add -f`.
- **`skills-briefings-files/**/drafts/`** — gitignored. Finished-but-unpublished briefings live here until promoted into `briefings/YYYY-MM-DD/`. The whole repo deploys to Pages, so drafts must stay untracked to avoid being publicly fetchable.

### Health check behavior

`scripts/health-check.js` both reports and **mutates briefing files in place**: it wraps bare `<table>`s in `<div style="overflow-x:auto">` and adds `max-width:100%;height:auto` to unbound `<img>`s. Its report buckets findings into `auto_fixed`, `needs_ai` (e.g. rabbit-hole tag suggestions, headline-quality warnings parsed from generate-index stderr), and `needs_human`.

## Conventions

- **Timezone is AEST** (`Australia/Sydney`) — `generate-index.js` computes "today" in AEST for the lead-story hero and TODAY tag. Date folders follow that convention; occasional gap days are normal.
- Briefing pages must keep a `<title>`, an `og:description` (or `meta name="description"`), and a back-link to the index (`../../index.html`) — health-check flags recent files missing these.
- Do not add a "← All Briefings" back-navigation bar at the top of briefing bodies — removed site-wide 2026-05-20. The required index back-link (above) instead lives in the FOOTER — templates ship a small centered footer link to `../../index.html` just before `</body>`. health-check checks for the link anywhere in the file (position-agnostic), so footer placement satisfies the back-link requirement without re-introducing a top bar.
- Commit message style follows the existing history: `Add <type> for YYYY-MM-DD`, `chore: daily health check [YYYY-MM-DD]`, `chore(index): regenerate ...`.
