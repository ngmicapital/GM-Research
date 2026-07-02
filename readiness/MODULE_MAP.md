# MODULE_MAP.md — GM Research repo readiness map

Generated for handoff to a fresh AI model. Evidence-based: every "Wired?" claim below
is backed by a grep/read performed while building this document. Nothing was moved,
deleted, or modified to produce this file — it is pure documentation.

## 1. Orientation

GM Research (`https://ngmicapital.github.io/GM-Research/`) is a zero-dependency static
GitHub Pages site publishing daily AI-generated intelligence briefings, video-transcript
write-ups, and visualizations. There is no `package.json` and no npm dependencies —
all tooling is plain Node ≥20 (stdlib only) under `scripts/`, with cross-script shared
logic in `scripts/lib/` covered by a `node:test` suite. Content flows in one direction:
an authoring **skill** (in `skills-briefings-files/<type>/`, each with a `SKILL.md` and
a canonical `template.html`) is used by Claude to write a new briefing file into
`briefings/YYYY-MM-DD/<slug>.html`. That file is committed and pushed straight to `main`
(bots and humans both push directly — there is no PR step for daily content). On push,
`.github/workflows/deploy.yml` checks out the repo, regenerates `index.html` and
`visualizations.html` from scratch via two Node scripts (which regex-extract headline/
preview/tag data out of every briefing HTML file and every transcript), and deploys the
whole repo tree to GitHub Pages. `index.html`, `visualizations.html`, `feed.xml`, and
`sitemap.xml` are therefore **generated artifacts** — committed copies exist in the repo
for convenience/history, but they are always rebuilt fresh at deploy time, so a stale
committed copy is harmless (CI flags it as a warning, not an error). A second, entirely
separate pipeline (`render.js` / `render-briefing.js`, wired into the skill/content-guide
docs for all 7 briefing types) is the **shipped deterministic renderer** ("Stage C" of
authoring): the model writes a smaller "content contract" JSON and the CLI turns it into
the styled HTML. It reached all 7 types on 2026-06-27 (`5fd675e`) and is in active use
(see `drafts/content-*.json` for 28 Jun–1 Jul). It is an **authoring-time** tool and is
**correctly not part of CI/deploy** — deploy only regenerates the index; the rendered HTML
is committed by the authoring job. The real gap is not the renderer's status but that its
test suite (`render.test.js`, 24 tests) is **not wired into CI** — see the `render.test.js`
row below and `TRUTH_TABLE.md`. (An earlier draft of this map, and a stale project memory,
called the renderer "in-progress/opt-in"; git is authoritative — it shipped.)

## 2. CRITICAL BUILD/DEPLOY PATH

> **Do not break these without re-running the full check sequence below.**
>
> - `scripts/generate-index.js` — rebuilds `index.html`, `feed.xml`, `sitemap.xml` from
>   `briefings/**` + `transcripts/manifest.json`. Regex-extraction logic keyed to CSS
>   classes in briefing HTML (`.tldr-text`, `.tldr p`, `story-title`, `card-title`,
>   `header-category`) — new briefing markup must match one of these or the index card
>   degrades to a generic-fallback warning.
> - `scripts/generate-visualizations.js` — rebuilds `visualizations.html` from the same
>   briefing corpus.
> - `scripts/lib/text.js`, `scripts/lib/dates.js`, `scripts/lib/briefings.js` — shared
>   helpers imported by the two generators above plus `health-check.js` and
>   `recent-coverage.js`. A bug here breaks every consumer at once.
> - `.github/workflows/deploy.yml` (job `build-and-deploy`) — on every push to `main`
>   (except a path-ignored `data/ticker.json`-only push), runs
>   `node scripts/generate-index.js` then `node scripts/generate-visualizations.js`,
>   then `actions/upload-pages-artifact` + `actions/deploy-pages` publish the **entire
>   repo tree** (`path: '.'`) to GitHub Pages. This is the only thing that actually
>   ships content to the public URL.
> - `.github/workflows/ci.yml` (job `validate`) — runs on feature branches/PRs only
>   (briefings push straight to main and skip this): `node --check` syntax gate on every
>   `scripts/*.js` + `scripts/lib/*.js`, `node --test scripts/lib/lib.test.js`, runs both
>   generators, then greps the generated HTML for backslash-close-tag artifacts.
>
> **The path:** author a briefing (or edit a generator) → push to `main` → `deploy.yml`
> re-runs `generate-index.js` + `generate-visualizations.js` → GitHub Pages serves the
> refreshed `index.html` / `visualizations.html` plus the untouched briefing/transcript
> HTML directly from the repo tree.

## 3. Full inventory

| Path | Role | Wired? (evidence) | Notes |
|---|---|---|---|
| `404.html` | LIVE-CONTENT | Served by GitHub Pages automatically as the 404 page (Pages convention); no explicit workflow reference needed — Pages picks up any `404.html` at the deployed root. | Static, hand-written. |
| `CLAUDE.md` | TOOLING (agent config) | Read by Claude Code sessions per repo convention; not referenced by any workflow/script. | Authoritative architecture doc — this MODULE_MAP cross-checks it below. |
| `backup/` | DEV-ARTIFACT | `.gitignore:2` lists `backup/`; `git ls-files backup/` → 0 tracked files. Contains only `.claude/launch.json` + `.claude/settings.local.json`. | Local Claude Code launch config, not site content. |
| `briefings/` | LIVE-CONTENT | Deployed as-is (`deploy.yml` uploads `path: '.'`); consumed by `generate-index.js`/`generate-visualizations.js`/`health-check.js`/`recent-coverage.js` (all read `briefings/**`). 497 files across ~90 date folders. | The actual daily content. |
| `content-scout.html` | LIVE-CONTENT (generated by scout, not by build scripts) | Referenced by `.github/workflows/scout-notify.yml` (`paths: content-scout.html` trigger, parses the file for Telegram digest) and by `scout/README.md`. Overwritten weekly by `scout/scripts/scan_channels.py`, not by `generate-index.js`/`generate-visualizations.js`. | Not linked from `index.html` nav (verify before assuming discoverable) — reachable only via direct URL / Telegram digest link. |
| `corpus.html` | LIVE-CONTENT (generated) | `scripts/generate-corpus.js` writes it (`OUTPUT_FILE = path.join(ROOT, 'corpus.html')`), reading from `CORPUS_ROOT = path.resolve(__dirname, '..', '..', 'corpus')` i.e. a **sibling** `../corpus` checkout. Confirmed present on this machine: `C:\Users\Tony\Documents\corpus` exists with `00-INDEX.md`, `wiki/sources`, etc. Not run by any workflow — CLAUDE.md's "not present in this repo" caveat is about the sibling dependency being outside this repo's git history, not about the tool being broken. | The committed `corpus.html` is a snapshot; regenerating it requires local access to the sibling repo, which is unavailable in CI (no workflow runs `generate-corpus.js`). |
| `daily-briefings/` | DEV-ARTIFACT / apparent legacy | `.gitignore:5` (`.claude/`) hides its only content (`daily-briefings/.claude/settings.local.json`); `git ls-files daily-briefings/` → 0 tracked files. No `.js`/`.yml`/`.html` reference to the directory name anywhere in the repo. | Superseded by `briefings/YYYY-MM-DD/` per CLAUDE.md's content pipeline diagram — this directory is empty of tracked content and holds only a stray local Claude settings file. Candidate for archive (see §4). |
| `data/` | DATA | `data/ticker.json` read client-side by `index.html` (fallback fetch) and written by `scripts/fetch-ticker.js`, consumed by `update-ticker.yml`. | See ticker row below for the full flow. |
| `favicon.svg` | LIVE-CONTENT | `index.html:15` → `<link rel="icon" type="image/svg+xml" href="favicon.svg">`. | |
| `feed.xml` | GENERATED-ARTIFACT | Written by `generate-index.js` (`FEED_FILE = path.join(ROOT, 'feed.xml')`, `fs.writeFileSync(FEED_FILE, ...)` at line 1115); linked from `index.html` (`<link rel="alternate" ... href="feed.xml">` and a footer `RSS` link). | Rebuilt every deploy. |
| `health-reports/` | DEV-ARTIFACT (partially force-tracked) | `.gitignore:6` lists `health-reports/`, but CLAUDE.md states historical reports are force-tracked (`git add -f`) — confirmed by `health-check.yml` line `git add -f "health-reports/${DAY}.json"`. 38 files present including `.json` reports and `-summary.md` write-ups. | Output of `scripts/health-check.js`, run daily by `health-check.yml`. |
| `index.html` | GENERATED-ARTIFACT + LIVE-CONTENT (the served homepage) | Written by `scripts/generate-index.js` (`fs.writeFileSync(OUTPUT_FILE, ...)`); rebuilt by `deploy.yml` on every push to main. | Never hand-edit per CLAUDE.md. |
| `mockups/` | DEV-ARTIFACT | `.gitignore:3` lists `mockups/`; `git ls-files mockups/` → 0 tracked files. 7 static HTML design mockups (`mobile-a/b/c.html`, `option-a-terminal.html`, etc.) with no inbound references from any `.js`/`.html`/`.yml` in the repo (grep for `mockups/` and each filename returned no hits outside the directory itself). | Pure design-exploration scratch, safe to leave untouched or archive. |
| `og-image.png` | LIVE-CONTENT | `index.html` + every briefing HTML's `og:image`/`twitter:image` meta tags point to `og-image.png` (e.g. `index.html:10` `<meta property="og:image" content=".../og-image.png">`). Confirmed via repo-wide grep — zero hits for `og-image.svg` anywhere in any `.html`. | |
| `og-image.svg` | SHADOW/DEAD | Grep for `og-image.svg` across all `*.html` returned **zero matches**. Only `og-image.png` is referenced by any meta tag. | Source/vector version of the PNG, unused by any markup. Keep as the PNG's source asset, but it is not "wired" in the served-page sense. |
| `readiness/` | TOOLING (agent handoff docs) | This file's own directory. Pre-existing content found: `CURRENT_STATE.md`, `EVIDENCE/*.out.txt`, `archive/*.CODEX-VARIANT.html`. Not gitignored, not referenced by any workflow. | Not part of the build/deploy graph; purely documentation/audit trail for AI-agent handoffs. |
| `recipes/` | LIVE-CONTENT | `recipes/index.html` present; deployed via the whole-tree `deploy.yml` upload. No inbound link found from `index.html` nav in the greps run (not confirmed reachable via UI navigation — only via direct URL). | Standalone page per CLAUDE.md's "Other site sections". |
| `scout/` | TOOLING | `scout/README.md`, `scout/channels_seed.md`, `scout/digest_template.html`, `scout/scripts/scan_channels.py`, `scout/seen_log.json`. `scout-notify.yml` triggers on `content-scout.html` changes (which `scan_channels.py` produces) and parses that file — confirms the scout pipeline's output is wired to a workflow, though the scan script itself runs outside GitHub Actions (per CLAUDE.md, "weekly content-discovery routine"). | CLAUDE.md flags: channel-list changes must also be applied to the Cowork skill's separate copy of `scan_channels.py` (outside this repo) — a manual sync point, not grep-verifiable from here. |
| `scripts/` | CRITICAL-PATH / TOOLING (mixed, see breakdown below) | | |
| `sitemap.xml` | GENERATED-ARTIFACT | Written by `generate-index.js` (`SITEMAP_FILE`, `fs.writeFileSync(SITEMAP_FILE, ...)` at line 1118). | Rebuilt every deploy. |
| `skills-briefings-files/` | TOOLING | Each `briefing-*/SKILL.md` + `template.html` is the authoring source of truth per CLAUDE.md; `template.render.html` + `content-guide.md` files additionally reference `scripts/render-briefing.js` (6 files) and `scripts/recent-coverage.js` (11 files) by name — confirmed via grep. | Not consumed by CI/deploy; consumed by Claude Code sessions authoring new briefings. |
| `skills-briefings-files/**/drafts/` | DEV-ARTIFACT | `.gitignore:4` (`skills-briefings-files/**/drafts/`); confirmed via `git check-ignore -v` on a sample file — matched. Contains populated `content-*.json` draft files across all 7 briefing-type subfolders (dated up to 2026-07-01). | Correctly gitignored per CLAUDE.md's stated reason (avoid public-Pages exposure of unpublished drafts) — verified non-empty and genuinely excluded from git tracking. |
| `sitemap.xml`, `feed.xml` | (see above rows) | | |
| `transcripts/` | LIVE-CONTENT | `transcripts/manifest.json` + per-slug `index.html`/`echo.html`/`spark_cannon.html`; read by `generate-index.js` and validated by `health-check.js` (checks flagged `has_echo`/`has_spark` files exist). ~26 transcript slugs. | |
| `visualizations.html` | GENERATED-ARTIFACT | Written by `scripts/generate-visualizations.js`; rebuilt by `deploy.yml`. | |
| `wyckoff.html` | LIVE-CONTENT | Standalone page per CLAUDE.md; deployed via whole-tree upload. Not independently grep-verified as linked from index nav in this pass. | |
| `.claude/` (repo root) | DEV-ARTIFACT | `.gitignore:5` (`.claude/`); confirmed via `git check-ignore -v` — matched, 0 tracked files. Contains `serve.js` (a local preview server per the `feedback_preview_server` memory), `launch.json`, `context-export.md`, `settings.local.json`, `worktrees/`. | Local dev tooling only. |

### `scripts/` breakdown

| File | Role | Wired? (evidence) | Notes |
|---|---|---|---|
| `scripts/generate-index.js` | CRITICAL-PATH | Yes — `deploy.yml` line `run: node scripts/generate-index.js`; `ci.yml` "Generators run" step; imports `./lib/text`, `./lib/dates`, `./lib/briefings`. | The single most important file in the repo — see §2. |
| `scripts/generate-visualizations.js` | CRITICAL-PATH | Yes — `deploy.yml` line `run: node scripts/generate-visualizations.js`; `ci.yml` same step; imports `./lib/text`, `./lib/dates`. | |
| `scripts/health-check.js` | TOOLING | Yes — `health-check.yml` step `run: node scripts/health-check.js`; imports `./lib/text`, `./lib/briefings`. Not called by `deploy.yml` or `ci.yml`. | Mutates briefing files in place (table/image auto-fixes) per CLAUDE.md; separate daily cron workflow. |
| `scripts/fetch-ticker.js` | TOOLING | Yes — `update-ticker.yml` step `run: node scripts/fetch-ticker.js`. Uses only `fs`, `path`, `https` (no shared-lib imports). | Writes `data/ticker.json`, then the workflow publishes it to the orphan `ticker-data` branch via git plumbing — main gets zero ticker commits (confirmed in `update-ticker.yml` body). |
| `scripts/generate-corpus.js` | TOOLING | Not wired to any workflow (grep of all `.yml` for `generate-corpus` → 0 hits). Depends on sibling `../corpus` repo, confirmed present locally (`C:\Users\Tony\Documents\corpus`). | CLI-only, run manually. Output `corpus.html` is committed as a snapshot. |
| `scripts/recent-coverage.js` | TOOLING | Not called by any workflow. Referenced by name in 11 `skills-briefings-files/**` docs (`SKILL.md`/`content-guide.md`) as a pre-write dedup step for briefing authoring. Imports `./lib/text`, `./lib/briefings`. | Genuinely used — just at authoring time (Claude session), not CI. |
| `scripts/render-briefing.js` | TOOLING (shipped authoring-time renderer, "Stage C") | Not called by any workflow **by design** — it runs at *authoring* time, and the rendered HTML is what gets committed. Referenced by name in 6 `template.render.html`/`content-guide.md` files across all 7 briefing types. Imports `./lib/render`. | CLI wrapper: `node scripts/render-briefing.js <type> <content.json> <out.html>`. **Load-bearing and in production** for all 7 types (`5fd675e`, 2026-06-27); the token-rebuild is shipped, not opt-in. |
| `scripts/lib/text.js` | CRITICAL-PATH | See module map §5. | |
| `scripts/lib/dates.js` | CRITICAL-PATH | See module map §5. | |
| `scripts/lib/briefings.js` | CRITICAL-PATH | See module map §5. | |
| `scripts/lib/render.js` | CRITICAL-PATH for the render-briefing pipeline (not for the live generators) | See module map §5. | |
| `scripts/lib/lib.test.js` | CRITICAL-PATH (test) | Yes — `ci.yml` step `run: node --test scripts/lib/lib.test.js`. Tests `text.js`, `dates.js`, `briefings.js`. | |
| `scripts/lib/render.test.js` | CRITICAL-PATH test (**not CI-wired — the key gap**) | 24 tests, **verified passing this session** (`node --test scripts/lib/render.test.js`), imports `./render`. But grep of `ci.yml`/`deploy.yml`/`health-check.yml` for `render.test`/`render-briefing` → **0 hits**. Only `lib.test.js` runs in CI. | This is the load-bearing gap: the shipped renderer's safety net does not gate merges. Adding a `node --test scripts/lib/render.test.js` step to `ci.yml` is the top quick-win. See `TRUTH_TABLE.md` / `GOAL.md` #2. |

## 4. SHADOW / DEAD / ARCHIVE CANDIDATES

**No files are being moved or deleted by this document — recommendations only.**

- **`og-image.svg`** — zero references in any `.html` file (repo-wide grep). The PNG
  (`og-image.png`) is what every `og:image`/`twitter:image` meta tag actually points to.
  *Recommendation:* leave as-is; it's a plausible source asset for the PNG, not truly
  dead, just not directly served/linked. Low priority.

- **`daily-briefings/`** — contains zero tracked files; its only content is a gitignored
  `.claude/settings.local.json`. No script, workflow, or HTML references the directory
  name. CLAUDE.md's architecture section describes content living in
  `briefings/YYYY-MM-DD/`, not `daily-briefings/`, confirming this is legacy/superseded
  naming from before the current folder convention. *Recommendation:* candidate to
  archive (or simply delete the stray `.claude/` subfolder) — but leave it for the repo
  owner to action, since it costs nothing while gitignored and untracked.

- **`backup/`, `mockups/`** — both fully gitignored, 0 tracked files, 0 inbound
  references from any script/workflow/HTML. `mockups/` holds 7 design-exploration HTML
  files (mobile variants, terminal/journal/command layout options) that predate the
  current design. *Recommendation:* archive candidates, but since they're gitignored
  already they carry zero deploy risk — purely local disk hygiene, not a repo-hygiene
  issue.

- **`scripts/lib/render.test.js`** — NOT shadow/dead. It's a critical-path test (24 tests,
  verified passing this session) over the **shipped, load-bearing** renderer, that simply
  **isn't wired into CI** the way `lib.test.js` is. *Recommendation:* add a
  `node --test scripts/lib/render.test.js` step to `ci.yml` — this is the single highest-value
  quick-win in the repo, not a "later" item. (Listed here only because it surfaced during the
  dead-code sweep; it is a coverage gap, not a cleanup candidate.)

- **`readiness/`** (pre-existing content: `CURRENT_STATE.md`, `EVIDENCE/*.out.txt`,
  `archive/*.CODEX-VARIANT.html`) — not referenced by any workflow/script, and not
  gitignored. This appears to be prior AI-agent-handoff scratch work already living in
  the repo (this document is being added to the same directory).
  *Recommendation:* no action — this is exactly the kind of documentation directory
  this file belongs in; not a code-hygiene issue.

## 5. `scripts/lib` module map

| Module | What it does (one line) | Imported by (grep evidence) |
|---|---|---|
| `text.js` | Exports `escapeHtml` (HTML-escape a string) and `stripHtml` (strip tags + decode a named-entity list down to plain text, the shared extraction primitive). | `generate-index.js` (`const { escapeHtml, stripHtml } = require('./lib/text')`), `generate-visualizations.js` (same), `health-check.js` (`stripHtml` only), `recent-coverage.js` (`stripHtml` only), `render.js` (`escapeHtml, stripHtml`), `lib.test.js` (unit tests). |
| `dates.js` | Exports date formatters (`formatDate`, `formatShortDate`, `formatDayLabel`) and `todayAEST` (computes "today" in Australia/Sydney for the site's AEST convention). | `generate-index.js` (`todayAEST`), `generate-visualizations.js` (`formatShortDate, formatDayLabel`), `lib.test.js` (all four). Not imported by `health-check.js` or `recent-coverage.js`. |
| `briefings.js` | Exports `BRIEFING_META` (per-type display metadata), `ORDER` (canonical type ordering), `BRIEFING_FILENAMES` (fixed filenames per type), `TAG_PATTERNS` + `extractTags` (per-type tag-regex extraction, single source of truth per CLAUDE.md), and `readMeta`. Internally imports `stripHtml` from `text.js`. | `generate-index.js` (`BRIEFING_META, ORDER, extractTags, readMeta`), `health-check.js` (`BRIEFING_FILENAMES, TAG_PATTERNS, extractTags`), `recent-coverage.js` (`BRIEFING_META, BRIEFING_FILENAMES, extractTags, readMeta`), `lib.test.js` (`BRIEFING_META, ORDER, BRIEFING_FILENAMES, extractTags, readMeta`). Not imported by `generate-visualizations.js`. |
| `render.js` | Deterministic briefing renderer — pure module (no IO): takes a per-type content-contract JSON + a `template.render.html`, validates against `SCHEMAS`/`FRAGMENT_SCHEMAS` (per-section paragraph/char floors so an under-delivering model aborts the render instead of publishing a stunted page), and produces final briefing HTML. Internally imports `escapeHtml, stripHtml` from `text.js`. | `render-briefing.js` (the CLI wrapper: `renderBriefing, renderSectionBriefing, SCHEMAS, FRAGMENT_SCHEMAS`), `render.test.js` (`renderBriefing, renderSectionBriefing`). **Not imported by any file that CI or deploy actually runs** — see §3/§4 gap note. |

## Cross-check against CLAUDE.md

- CLAUDE.md's architecture diagram and "Other site sections" text were both confirmed
  accurate against grep evidence: the shared-lib import graph, the `ticker-data` orphan
  branch flow, the `drafts/` gitignore reasoning, and the health-check force-tracked
  reports all check out exactly as described.
- **The biggest CLAUDE.md gap:** it does not mention the `render.js` / `render-briefing.js` /
  `render.test.js` **authoring-time render pipeline at all** — even though that pipeline
  **shipped** (all 7 types, 2026-06-27) and is how briefings are now authored. CLAUDE.md
  predates the rollout. A fresh model should treat `CURRENT_STATE.md`/`EVOLUTION.md`/
  `TRUTH_TABLE.md` as authoritative over CLAUDE.md on this point, and updating CLAUDE.md to
  document the render pipeline is part of the Fable mandate (`GOAL.md` #6). It is correct
  that this pipeline is not in the CI/deploy path (it runs at authoring time); the defect is
  only that its test suite isn't CI-gated.
- CLAUDE.md's `generate-corpus.js` caveat ("requires a sibling `../corpus` checkout,
  not present in this repo") is accurate about the checkout being outside *this* git
  repo's history, but on this machine the sibling directory does in fact exist and is
  populated (`C:\Users\Tony\Documents\corpus`) — so the script is runnable locally,
  just never in CI (no sibling checkout is possible in a single-repo GitHub Actions
  runner without an extra checkout step, which does not exist in any workflow here).

## 6. Briefing type → skill folder → output filename (the non-obvious mapping)

The `skills-briefings-files/` folder names do **not** match the output filenames — a documented
cold-reader trip hazard. The authoritative mapping is the `TEMPLATES` table in
`scripts/render-briefing.js`:

| Type key | Skill folder | Output filename | Cadence |
|----------|--------------|-----------------|---------|
| `market-briefing` | `briefing-morning-edge/` | `market-briefing.html` | daily |
| `legal-brief` | `briefing-legal-precedent/` | `legal-brief.html` | daily |
| `ai-briefing` | `briefing-ai-cortex/` | `ai-briefing.html` | daily |
| `trading-concept` | `briefing-alpha/trading-concept/` | `trading-concept.html` | daily |
| `rabbit-hole` | `briefing-rabbit-hole/` | `rabbit-hole.html` | daily |
| `praxis-brief` | `briefing-praxis/` | `praxis-brief.html` | odd days-of-month |
| `biohacker-report` | `briefing-biohacker/` | `biohacker-report.html` | even days-of-month |
