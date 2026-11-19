
## Moved from HANDOFF on 2026-11-13
## State
- All 7 briefing scheduled tasks plus `daily-briefing-recovery` are **disabled**. Last real runs: 2026-07-06.
  There was a stray run on 2026-08-25. Wrappers in `~/.claude/scheduled-tasks/<id>/SKILL.md` pin the writer to
  `model: "opus"` (Opus 5.5). The "Sonnet retired 2026-09-24" note in them means Sonnet 4.6/5; Sonnet 5.5
  is in dc's 2026-09-29 lineup.
- Measured from 53 pipeline-era run transcripts (28 Jun – 6 Jul, plus 25 Aug). Medians are API-equivalent $
  per run, repriced to Opus 5.5 / Sonnet 5.5: legal 3.81/2.37, ai 3.29/2.02, praxis 2.79/1.72,
  trading-concept 2.62/1.58, market 1.47/0.90, biohacker 1.35/0.86, rabbit-hole 1.10/0.69.
  Weekly total ≈ $98 on Opus vs $61 on Sonnet, ≈ 16% vs 10% of dc's weekly Max limit.
  The % calibration: this week's tracked usage ≈ $565 against 90% shown (2026-10-22), so 1% ≈ $6.30. That
  excludes the laptop and claude.ai, so it is an upper bound and only rough (±50%).
- The July "31% token cut" was an output-bytes figure. Real $ fell only ~15% because tool calls rose to 27–45
  per run. Cost split: cache write 56%, cache read 25%, output 12%, fresh input 7%.
- Evidence that Sonnet can do the job: market, rabbit-hole and biohacker ran whole sessions on Sonnet 4.6.
  The other four used a Sonnet 5 writer after 06-27. The renderer depth floors block thin pages.
- Scripts that reproduce the numbers are in the session scratchpad (`measure_runs.py`, `analyze.py`,
  `calibrate.py`). Method: each run's metadata is in `%APPDATA%\Claude\claude-code-sessions\**\local_*.json`,
  and its `cliSessionId` names the transcript under `~/.claude/projects/<cwd>/`.
- Memory updated: `project_briefings_token_rebuild.md` now holds these measured figures.

## API-credit route (2026-11-13)
- dc's Max plan gives $100/month of API credit to "dc's Individual Org" (no rollover; next grant 3 Dec).
  It pays only for direct API, Batch, Agent SDK or `claude -p` calls made with an org API key, never for
  Claude Code or desktop scheduled tasks. Key `gm-briefings` (Default workspace, expires 13 Dec 2026) is in
  `~/.config/gm-research/anthropic.env`, outside the repo.
- `scripts/api-brief.js` writes one brief through the Messages API. Script-side CoinGecko, Fear & Greed and
  ticker data are free; it makes one API call with web_search capped at 12, then runs render-briefing.js. It
  never publishes.
- First test: market-briefing on Sonnet 5.5, 13 Nov. **$0.648** (tokens $0.528 + 12 searches $0.12),
  222 s, render ok with depth floors passed. 30k output tokens and 81k cache-write tokens dominate the cost.
  Spot checks: BTC $69,623 / −5.5% matched a separate CoinGecko read ($69,590 / −5.6%); the Nvidia CEO
  exit matches Nvidia's 12 Nov 8-K; hot October CPI and December hike risk are corroborated by press.
  The Console per-key cost had not appeared yet (second source for $0.648 pending).
- Implication: $0.65 vs the $0.90 agentic Sonnet median is only about 28% cheaper. All 7 types at that ratio
  ≈ $190/month, which does not fit $100. Batch (−50%) and trimming output would put it near the line.
- Batch test (commit d6fcd6c): market-briefing via `--batch` cost **$0.285** (56% less). SECTION_8 came back
  1134 < 1200 and the render gate rejected it. The new repair pass expanded it to 1565 for $0.013, so
  **$0.298 total**, render ok. Section floors are now read from `FRAGMENT_SCHEMAS` in render.js and put in the
  prompt. A fresh confirmation batch was running at checkpoint (output in
  `C:\Users\tony_\AppData\Local\Temp\claude\04bb4f62bfc1dadf\5956054a-57c3-48ab-b786-1af34b3b5446\scratchpad\brief2`).
  Result: **$0.342**, 322 s, render ok with NO repair needed (the floors-in-prompt fix worked), and it
  survived 10 DNS-blip retries. Batch mean of 2 runs = $0.32 vs the $0.90 agentic median (0.36×). Scaling the
  old Sonnet $61/week by 0.36 ≈ $22/week ≈ **$94/month for all 7 (estimate)**: just inside $100, with no
  headroom.
- dc asked (13 Nov) for cheaper AND better briefs. Cost anatomy of Batch #2 ($0.342): searches $0.12 (35%,
  never discounted), output $0.14 (41%), cache-write $0.06. Visible JSON is only ~10k of the 28k output
  tokens; the other ~18k is hidden thinking at Sonnet 5.5's default effort "high". Markup is only 30% of the
  JSON. Uncommitted: `--effort` flag added to api-brief.js. Experiments running at checkpoint: Haiku 5.5 with
  6 searches (scratchpad\haiku) and Sonnet at effort medium with 6 searches (scratchpad\medium). Results
  (flag committed): Sonnet at medium cost **$0.19** but ran 0 searches, so it missed the Nvidia CEO exit and
  CPI (cheap but empty). Haiku 5.5 cost **$0.063** with 4 searches, render ok, and caught the main stories
  (NVDA −4.3% matches Sonnet). Its quality is not yet judged by dc; one claim (NVDA forward P/E 12–14×) is
  unverified. Haiku pricing assumes prompts under 100k tokens (5× higher above that). Other levers not yet tried: free script-side data instead of
  searches (Polymarket gamma API, ETF flows, RSS), and one shared research pass across the market,
  trading and AI types.
- TradingView fix (4e61b15): `TVC:US10Y`, `TVC:DXY`, `TVC:TNX` and `CBOT:ZN1!` show "Permission denied" in
  free embeds (checked live in Chrome 13 Nov). The replacements `CAPITALCOM:DXY` and `FRED:DGS10` (needs
  dateRange=12M) render. Market guide updated, and api-brief.js swaps blocked symbols before render. The
  published July pages still carry the broken widgets (left alone). Only the market guide used them.
- **LIVE (13 Nov).** The daily Haiku pipeline is on GitHub Actions (commits a47004a, 2b8ee3f, 7c2fb23).
  - Run 43374342712 published 5/6 for $0.28.
  - Legal ended with no JSON; the runner now retries once. Run 43375456923 published legal ($0.086).
  - All 6 of the 13 Nov pages return 200 on ngmicapital.github.io, the index lists them, and the live market
    page carries CAPITALCOM:DXY + FRED:DGS10.
  - Key `gm-briefs-github` (expires 13 Nov 2027) is the repo secret ANTHROPIC_API_KEY and is also in the
    local env file. The old 30-day key `gm-briefings` is unused and expires 13 Dec.
  - Console balance read $98.09 mid-session, matching the script-counted spend.
  - Not yet verified: the first unattended 06:00 cron run (14 Nov, 19:00 UTC 13 Nov).
  - Remaining ideas: free news feeds, a shared research pass, the small jobs in
    docs/api-credit-candidates.md, and what "better" means to dc.
- (done) dc decided (13 Nov): Haiku writes; it runs on GitHub Actions. Former WIP:
  - api-brief.js: all 7 types, Haiku default, live market data only for market and trading types.
  - New `scripts/daily-briefs.js`: due types by Sydney date → api-brief → copy to briefings/<date>/ →
    publish-briefing.js; `--dry-run` and `--types` flags.
  - New `.github/workflows/daily-briefs.yml`: cron 19:00 UTC, secret ANTHROPIC_API_KEY, triggers deploy.yml
    via `gh workflow run`.
  - `.gitignore` gains `.api-brief-out/`.
  - Six-type Haiku test is running (scratchpad\types\*.log).
  Next:
  1. Fix any type that fails render.
  2. Commit.
  3. Create a longer-lived key (current expires 13 Dec) and set it as the repo secret via `gh secret set`
     from the file, never echoed. dc approved the Actions route.
  4. Run the workflow by dispatch once and verify live pages.
  5. Note: notify-failure.yml is disabled at dc's request; GitHub emails on failure.
- (superseded) Waiting on dc: Haiku ($0.06) vs Sonnet ($0.30 batch) as the writer. dc asked why Haiku is "better"; the
  answer: it is cheaper, not better.
- Gaps: Console per-key cost not yet seen (second source); key `gm-briefings` expires 13 Dec, so it needs a
  longer-lived key before wiring daily jobs; nothing is scheduled or published yet.
- Other candidates for the credit: `docs/api-credit-candidates.md` (researcher survey, untracked).

## Next
- **Waiting on dc.** The recommendation (not yet adopted) is to revive all 7 on Sonnet 5.5. On "yes": repin
  the 7 wrapper SKILL.md files from `opus` to Sonnet 5.5, re-enable the 7 tasks plus `daily-briefing-recovery`,
  and verify the first morning's reports are live on origin/main and the site. Flip legal back to Opus if
  quality slips.
- Possible follow-up, not authorized: cut the number of tool calls per run. Context re-reading is 81% of the
  cost, so this is a bigger saving than the model switch.
