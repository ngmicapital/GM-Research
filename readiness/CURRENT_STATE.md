# CURRENT_STATE — GM Research (briefings-site)

> **This is the ONLY "read me first."** Everything else in `readiness/` is referenced from here.
> Snapshot: commit `d12eb0d`, branch `main`, 2026-07-02 (AEST). If HEAD has moved far past
> this, re-run the acceptance test in `READINESS_MANIFEST.md` before trusting the numbers.

---

## 1. What this project is (one paragraph)

**GM Research** is a static [GitHub Pages](https://ngmicapital.github.io/GM-Research/) site that
publishes daily, AI-generated intelligence briefings across seven fixed types (market, legal, AI,
biohacker, rabbit-hole, praxis, trading-concept), plus video/podcast transcripts, visualizations,
a research corpus page, and a weekly content scout. There is **no package.json and no third-party
runtime dependency** — the entire toolchain is plain Node ≥20 stdlib scripts in `scripts/`, with
shared logic in `scripts/lib/` covered by a zero-dependency `node:test` suite. The published site is
hand-written/generated HTML committed straight to `main`; a push to `main` triggers a GitHub Actions
workflow that regenerates the index + visualizations and deploys Pages.

## 2. Current state (verified 2026-07-02 at commit `d12eb0d`)

- **Content:** 92 briefing dates, 497 tracked briefing HTML files, 23 transcripts.
- **Tests:** 38/38 pass — 14 in `scripts/lib/lib.test.js`, 24 in `scripts/lib/render.test.js`
  (`node --test scripts/lib/lib.test.js scripts/lib/render.test.js`). Evidence: `EVIDENCE/tests.out.txt`.
- **Build gate:** `node scripts/generate-index.js` is **clean** — `✓ UI validator: all card extractions
  look clean` + `✓ Output integrity` , no `⚠️`/blocking defects. Evidence: `EVIDENCE/generate-index.out.txt`.
- **Health check:** `node scripts/health-check.js` — 10 passed, 2 auto-fixed, 0 errors,
  2 needs-human (see §5). Evidence: `EVIDENCE/health-check.out.txt`, report `health-reports/2026-07-01.json`.
- **Local Node is v24**; CI pins Node 20. Both satisfy `≥20`. Minor drift, noted in `READINESS_MANIFEST.md`.

## 3. The plans

There are **two** planning layers — do not conflate them:

1. **The token-rebuild (DONE and in production — verified against git, not memory):** briefing
   *generation* was migrated to a deterministic renderer. The authoring model now writes a structured
   `content.json` (see the gitignored `skills-briefings-files/**/drafts/content-YYYY-MM-DD.json`), and
   `scripts/render-briefing.js` ("Stage C") turns it into final styled HTML via each type's
   `template.render.html`, using `scripts/lib/render.js` (tested by `render.test.js`, 24 tests).
   Commit `5fd675e` (2026-06-27) rolled **all 7 types** onto the pipeline; `fd0ca9f` cut token usage.
   Drafts exist for 28 Jun–1 Jul across types → **actively used**. ⚠️ NOTE: an earlier project memory
   called this an "in-progress rabbit-hole pilot" — that is **stale**; git is authoritative. The
   frontier now is *verification/hardening* of this pipeline, not initial rollout.

2. **THE FABLE MANDATE (this handoff):** a **full product upgrade** — audit the whole site end-to-end
   (build/deploy path, content-generation pipeline, content quality, UX, and the CI/automation
   workflows) and propose + implement improvements broadly. Full statement, owner's voice, and the
   "10/10 done" bar are in **`GOAL.md`**. The token-rebuild above is *inside* this mandate's scope,
   not a competing plan.

## 4. Where secrets / endpoints live (SENSITIVE — reference only, never copied into this package)

This is a public static site; the sensitive surface is small.

- **GitHub Actions secrets** (repo Settings → Secrets → Actions — NOT in the repo):
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — used by `.github/workflows/notify-failure.yml` and
  `scout-notify.yml` to send CI/scout alerts to Telegram. Both workflows no-op gracefully if unset.
- **Deploy auth:** GitHub Pages OIDC (`id-token: write` in `deploy.yml`) — no stored secret.
- **External endpoints** (read-only, no auth): `raw.githubusercontent.com/.../ticker-data/...`
  (ticker JSON, client-side), CoinGecko (crypto prices, client-side), Yahoo Finance
  (`scripts/fetch-ticker.js`, CI), `api.telegram.org` (CI alerts).
- **No wallets, private keys, PII, or user/DB dumps exist in this project.**
- **Gitignored, must stay unpublished:** `skills-briefings-files/**/drafts/` (unpublished briefings —
  the whole repo deploys to Pages, so drafts must never be tracked), plus dev artifacts
  `backup/`, `mockups/`, `.claude/`, `health-reports/`, `node_modules/`.

## 5. DO-NOT-TRUST / superseded blocklist

A cold `grep` can land on these — they are **stale or divergent; do not treat as canonical**:

| Item | Why it's here | Canonical instead |
|---|---|---|
| `codex/claude-routine-2026-06-25-praxis` branch | Holds a **substantially divergent** 25 Jun praxis brief (244 lines differ from the published one). A stale fork from a concurrent run. | `main`'s `briefings/2026-06-25/praxis-brief.html` is live. The variant is preserved at `readiness/archive/2026-06-25-praxis-brief.CODEX-VARIANT.html` — decide/discard, do not silently adopt. |
| `codex/briefings-run` branch | Near-duplicate 24 Jun market brief (3 lines differ) — a concurrent-git-race artifact, 1 ahead / 62 behind main. | `main`'s copy is canonical. Variant preserved at `readiness/archive/2026-06-24-market-briefing.CODEX-VARIANT.html`. |
| Stale `codex/*` worktrees under `~/.config/superpowers/worktrees/briefings-site/` and `~/Documents/briefings-site-codex-run` | Abandoned worktrees from 2026-06-25 automated runs (all far behind main). Clutter a cold `git branch -a` view. | `main` only. Safe to remove once their contents are confirmed on main; not deleted here (out-of-repo, needs care). |
| `index.html`, `visualizations.html`, `feed.xml`, `sitemap.xml` | **Generated artifacts.** Committed for repo accuracy but rebuilt on every deploy. | Never hand-edit — change the generator in `scripts/` and re-run. |
| Missing content (not stale, just absent) | `rabbit-hole.html` absent for **2026-06-28** and **2026-07-01** (expected-daily type). Real content gaps, never generated — not recoverable, flagged by health-check. | n/a — noted so Fable doesn't read the gap as a bug in the pipeline. |

## 6. Where to look next (the package)

- **`GOAL.md`** — the mandate + the 10/10 bar (read this second).
- **`TRUTH_TABLE.md`** — every quantitative claim, labelled by how much to trust it.
- **`MODULE_MAP.md`** — what's live vs shadow/dead; the critical build/deploy path.
- **`EVOLUTION.md`** — how the project got here (eras + pivots).
- **`EVIDENCE/`** — replayable outputs (tests, generators, health) + `failure-forensics.md`.
- **`FABLE_MODE.md`** — delegation policy + the "never silently delegate" floor.
- **`READINESS_MANIFEST.md`** — reproducibility receipt + acceptance-test results.
- **`ONESHOT_PROMPT.md`** — the prompt that boots Fable as orchestrator (starts with a blocking
  self-audit of these very numbers).
