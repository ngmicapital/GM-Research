# HANDOFF: briefings-site (current state)

## Goal
Revive the daily GM Research briefings as cheaply as possible on the Max plan's $100/month API credit, then
make them better (dc, 2026-11-13). Detail and history: `docs/HISTORY.md`.

## State (2026-11-13)
- **LIVE:** `.github/workflows/daily-briefs.yml` runs at 19:00 UTC (06:00 Sydney) →
  `scripts/daily-briefs.js` → `scripts/api-brief.js` (Haiku 5.5) → `scripts/publish-briefing.js` → deploy.
  - Commits a47004a, 2b8ee3f, 7c2fb23.
  - Manual runs 43374342712 and 43375456923 published all 6 of the 13 Nov types for about $0.37 total.
  - All 6 pages return 200 on ngmicapital.github.io, and the index lists them.
- Measured cost per brief on Haiku: $0.02–0.09. Earlier comparisons on the same market brief: Sonnet $0.65,
  Sonnet Batch $0.30–0.34, Sonnet at medium effort $0.19 (skipped searches, so it missed the news).
  Estimate for all 7 types: about $10–20/month.
- Robustness built in:
  - section floors in the prompt plus a repair pass
  - a validator fix-up loop that sends the renderer error back to the model (max 2 tries)
  - a one-time retry per type when the model returns no JSON
  - answers to stray client tool calls
  - a deterministic swap of the embed-blocked TradingView symbols (TVC:DXY→CAPITALCOM:DXY, TVC:US10Y→FRED:DGS10
    with 12M range)
- Keys:
  - `gm-briefs-github` (expires 13 Nov 2027) is the repo secret ANTHROPIC_API_KEY and is in
    `~/.config/gm-research/anthropic.env`.
  - The old `gm-briefings` key is unused and expires 13 Dec.
  - Console balance read $98.09 mid-session, matching the script-counted spend.
- Alerts:
  - `notify-failure.yml` is disabled at dc's request (the stale "briefings MISSING" pings).
  - GitHub emails the owner on a failed scheduled run.
- The old Claude Code scheduled briefing tasks stay disabled.

## Next
1. Verify the first unattended cron run (19:00 UTC 13 Nov = 06:00 Sydney 14 Nov): run conclusion and the
   7 Nov-14 pages live (14 Nov is even and a Saturday: biohacker, no rabbit-hole). Check the Console spend.
2. Ask dc whether to re-enable `notify-failure.yml` now that the briefs run (its missing-briefing check would
   now be meaningful).
3. Ask dc what "better" means (which briefs he reads, what is missing). Cheaper and fresher levers: free
   news feeds instead of searches, and one shared research pass for market, trading and AI.
4. Small credit jobs (survey in `docs/api-credit-candidates.md`, untracked): fleet review (its OAuth expiry
   has broken W43–W45), transcript miner, parity check, Content Scout, Wyckoff transcripts.
