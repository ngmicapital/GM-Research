# FAILURE FORENSICS — what broke, why, and whether it's guarded now

Reconstructed from `git log` (the `fix(...)` commits) + the current health-check output. Early bugs
are **lessons, not a verdict** on the project's capability — most are now guarded. Classes:
**LOGIC** (wrong design/idea) vs **IMPLEMENTATION** (right idea, coded-badly or not-wired-in).

| # | Failure | Fixing commit(s) | Class | Root cause | Status |
|---|---------|------------------|-------|------------|--------|
| 1 | **Leaked template tokens / `<!-- TEMPLATE -->` authoring comments render into published HTML** | `ecab879` (06-14), `117526f` (06-14), `7538e1d` (06-28) | IMPLEMENTATION (coded-badly, template handling) | Authoring comments / unfilled tokens survived into output; renderer didn't strip the leading TEMPLATE comment before token fill | **Guarded** — blocking content-defect gate in `generate-index.js` (fatal on `{{token}}` / TEMPLATE comment / raw entity) + renderer strip. Recurred twice across eras, so treat as fragile. |
| 2 | **Raw HTML entities survive into extracted headlines / viz / scout labels** (`&minus;`, `&mdash;`, etc. display as literal jibberish) | `8377365` (06-13, "fix viz entity decoding"), `d655e5e` (06-30, scout channel names) | IMPLEMENTATION (coded-badly, incomplete decoding) | `stripHtml` entity list was incomplete and duplicated per-script | **Guarded** — single named-entity list in `scripts/lib/text.js`; `generate-index.js` emits a `RAW HTML ENTITY in headline` warning (blocking in latest 3 dates). Still whack-a-mole when a new entity appears. |
| 3 | **Tag patterns diverged between `generate-index.js` and `health-check.js`** (same briefing got different tags) | `8377365` (06-13, "unify tag patterns") | LOGIC (duplicated logic drift) | Two independent copies of the tag regex/logic fell out of sync (notably biohacker-report, trading-concept) | **Fixed structurally** — `TAG_PATTERNS`/`extractTags` centralized in `scripts/lib/briefings.js`, imported by both. Covered by `lib.test.js` (lastIndex-leak test). |
| 4 | **Concurrent-git-race → duplicate / divergent / dropped same-day briefings** | mitigation `deploy.yml` "Debounce concurrent pushes: sleep 30"; recovery `d12eb0d` (07-02) | LOGIC (architectural) | Multiple concurrent automated briefing jobs share one git index/remote; pushes race → one job's file lands in another's commit, or is left uncommitted, or two variants diverge | **STILL RECURRING — top open reliability issue.** Evidence: untracked 2026-07-01 praxis (recovered), divergent `codex/*` branch briefs for 06-24/06-25. Debounce helps but does not serialize the index. See `CURRENT_STATE.md §5`. |
| 5 | **Non-deterministic RSS feed** (`lastBuildDate` = build time → every build differed) | `bf9e4ae` (06-13) | IMPLEMENTATION (used `now()`) | Feed stamped current time, not content time | **Fixed** — `lastBuildDate` = newest item date. |
| 6 | **Ticker marquee only updated one of two DOM copies** | `6a4882f` (06-14) | IMPLEMENTATION (coded-badly) | Update targeted a single node, not `querySelectorAll` both marquee copies | **Fixed.** |
| 7 | **Cloud triage routine failing / unreliable** | `523ec37` (06-27) | IMPLEMENTATION (not-wired / flaky external) | Health/triage ran as an external cloud routine that kept failing | **Fixed by relocation** — moved into a CI `health-check.yml` workflow. |
| 8 | **Missing daily briefings** (content gap, not code) | detected by `health-check.js` | operational (not a code bug) | Daily authoring job didn't produce the file | **Detected, not prevented** — health-check `missing-briefing` + Telegram alert. Currently open: `rabbit-hole.html` absent for 2026-06-28 and 2026-07-01. |

## Systemic lessons

Two recurring failure classes dominate:

1. **Template-token / entity leakage (rows 1–2)** — content-shaped bugs where authoring artifacts or
   un-decoded entities reach the published page. The project's answer has been *build-time gates*
   (blocking content-defect check, output-integrity check, RAW-ENTITY warning). These work but are
   reactive — each new leak shape needs a new guard. A cold auditor should assume the next novel leak
   is not yet gated.
2. **Concurrency (row 4)** — the genuinely *unsolved* one. Debounce reduces but does not eliminate the
   race because the automated jobs are not serialized on the git index. This is the highest-value
   reliability target in the repo and the one most likely to silently drop published content.

Everything else (rows 3, 5–7) was a one-time fix that stuck, mostly by **centralizing** duplicated
logic or **relocating** flaky work into CI. The trajectory is healthy: the repo now fails *loudly at
build* where it used to fail *silently in production*.
