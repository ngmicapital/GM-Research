# API-credit candidates: recurring work that could move off the Max plan

Researcher report, 2026-11-13, laptop (`C:\Users\tony_`). Read-only. The only file written is this one.
Credit: $100/month of Anthropic API credit. It expires each cycle with no rollover; next refresh 2026-12-03.
It pays only for direct API calls (Messages, Batch, Managed Agents, Agent SDK, or `claude -p` run with an API key).

## Prices used (verified 2026-11-13, platform.claude.com/docs/en/about-claude/pricing)
| Model | Input | 5m cache write | Cache hit | Output |
|---|---|---|---|---|
| Opus 5.5 | $4 | $5 | $0.20 (0.05x) | $20 |
| Sonnet 5.5 | $2 | $2.50 | $0.10 (0.05x) | $10 |
| Haiku 5.5 (prompts up to 100k) | $0.10 | $0.125 | $0.01 | $0.50 |
- Batch API: 50% off input and output. The page says caching multipliers stack with the Batch discount.
- The Haiku 5.5 price above 100k-token prompts is 5x ($0.50 in / $2.50 out). Agentic runs that grow past 100k lose the cheap tier.
- Web search: $10 per 1,000 searches (from the packet; not re-checked on the page).

## Search bound
- Claude Code desktop scheduled-task registry:
  `%APPDATA%\Claude\claude-code-sessions\7ecdcc60...\7f5a0070...\scheduled-tasks.json`.
- `~/.claude/scheduled-tasks/*/SKILL.md` (6 directories).
- Six Windows tasks via `Get-ScheduledTask`, plus the scripts each one calls.
- `Documents\claude\SYSTEM.md` and `mining-reports\` (`ACTIONS.md`, `2026-11.md`, `2026-W46-weekly*`, `fleet-review.log`).
- briefings-site: `.github/workflows/*.yml`, `scout/README.md`, `scripts/health-check.js`, `docs/HANDOFF.md`, git log.
- `~/Documents/corpus` (pending-queue, worker handoff, git log).
- The six named skills (headers only).
- Token usage: summed from session JSONLs for 3 scheduled runs, script at `%TEMP%\u.py`.
- Not searched: the desktop machine. Its scheduled-task registry holds the 7 briefing tasks, the corpus-worker and the gardener. Those are not on this laptop's disk.

## Ranked candidates (value / cost)

### 1. ClaudeFleetReviewWeekly: weekly self-learning review (best fit)
- **Now:** `~/.claude/scripts/fleet-review-weekly.ps1` runs every Monday from a Windows task.
  - Deterministic mining first (`fleet-pulse.py`, `token-ledger.py`).
  - Then one headless review: `claude -p --model opus --effort high --no-session-persistence --allowedTools "Read,Glob,Grep,Write"` (line 168).
  - Then a Telegram notice.
- **LLM-shaped:** yes. It reads about 60 KB of mined evidence plus the kernel, the ledger and last week's report, then writes a report of about 15 KB (W46: 14,779 bytes, `fleet-review.log`).
- **Why it fits best:** it is already a `claude -p` call, so moving it to the API key is just setting `ANTHROPIC_API_KEY` for that one call.
  - It also removes a real failure mode. The W45 review died with `OAuth session expired and could not be refreshed` (`mining-reports/2026-11.md`, Summary).
  - W43-W45 all logged FAILURE (`fleet-review.log`).
- **Cost: estimate.** No transcript exists because of `--no-session-persistence`. The 2026-11 transcript-miner run is a similar agentic Opus job and measured about $2.10 (see #3). The review took about 9 minutes (15:45:40 → 15:54:34).
  - Opus 5.5: $1.5-3 a run × 4.33 runs = **$6.50-13 a month**.
  - Sonnet 5.5: about half, **$3-6.50**.
- **Risk:** it writes reports and feeds `actions-runner.ps1`, which can apply S0/S1 repairs to `~/.claude`. That chain is unchanged; only the billing path moves. Keep Opus for quality, or trial Sonnet on one week and compare reports.

### 2. validate-parity-weekly: weekly observe-only parity check
- **Now:** a Claude Code desktop scheduled task.
  - Registry: `cron 0 9 * * 1`, `enabled:true`, `lastRunAt 2026-11-09T09:05Z`.
  - It runs `~/.agent-tools/validate-parity.ps1` and only reads the output to give a verdict.
- **LLM-shaped:** barely. The script is deterministic; the model only parses and summarises.
- **Measured** (session 9bb75198, Opus 5.5): 47,789 cache-write, 751,874 cache-read and 3,734 output tokens.
  - On Opus: $0.24 + $0.15 + $0.07 = **$0.46 a run, $2.00 a month** of plan usage today.
  - The 2026-11-03 run (11c8c2f8) was similar: 46.5k / 654k / 4.5k tokens.
  - On Haiku 5.5 via `claude -p --model haiku`: $0.006 + $0.0075 + $0.002 = **$0.016 a run, $0.07 a month**.
- **Better option:** drop the model entirely and have the ps1 grep its own checkpoints. Then the credit does not matter.
- **Risk:** it moves from a desktop scheduled task to a Windows task wrapper, which is a new mechanism. The prompt is around 50k tokens, so it stays under Haiku's 100k tier.

### 3. transcript-miner-monthly: monthly transcript mining
- **Now:** a Claude Code desktop scheduled task.
  - Registry: `cron 0 9 1 * *`, `enabled:true`, `lastRunAt 2026-11-03T18:59Z`.
  - It follows `~/.agent-tools/transcript-miner-prompt.md`: an Opus lead plus 3 Sonnet subagents, writing `mining-reports/YYYY-MM.md`.
- **LLM-shaped:** yes (classify and summarise dc's messages).
- **Measured** (session aa1bddd9 plus 3 subagents): 204,444 cache-write, 2,462,723 cache-read and 29,455 output tokens. There were 23 Opus and 9 Sonnet turns.
  - Priced all at Opus: $1.02 + $0.49 + $0.59 = **$2.10 a month** (upper bound).
  - All at Sonnet: $0.51 + $0.25 + $0.29 = **$1.05**.
- **Batch option:** the extraction step is deterministic PowerShell, and each file's read could be a Batch Sonnet request at about half price. That needs a rewrite, which is out of proportion for $1-2.
- **Risk:** low. Mostly this is a reliability move, because it then runs without the app open.
- **Record disagreement:** `SYSTEM.md:462` says the routine "never ran and stays disabled", but the registry shows it enabled, it ran 2026-11-03, and `2026-11.md` exists.

### 4. Daily GM Research briefings (desktop, now disabled): biggest value, biggest cost
- **Now:** 7 desktop scheduled tasks plus `daily-briefing-recovery`, all disabled since 2026-07-06 (`briefings-site/docs/HANDOFF.md`, State).
  - Expected set: market, legal, ai and trading-concept daily; rabbit-hole Mon-Fri; praxis and biohacker on alternating days (`notify-failure.yml`).
  - The revival decision is pending with dc.
- **LLM-shaped:** yes (research plus writing).
- **Measured** (HANDOFF, from 53 run transcripts; median API $ per run, Opus/Sonnet 5.5): legal 3.81/2.37, ai 3.29/2.02, praxis 2.79/1.72, trading-concept 2.62/1.58, market 1.47/0.90, biohacker 1.35/0.86, rabbit-hole 1.10/0.69.
  - All 7 on Sonnet: $61 a week × 4.33 = **$264 a month. That does not fit in $100.**
  - Subset that fits, on Sonnet:
    - market 30 × $0.90 = $27.00
    - rabbit-hole about 22 weekdays × $0.69 = $15.20
    - biohacker about 15 × $0.86 = $12.90
    - Total **about $55 a month**.
  - Caveat: I cannot tell whether HANDOFF's repricing used the 0.05x cache-hit rate. Cache reads were 25% of the cost, so the error is small.
- **Bigger lever** (HANDOFF, Next): context re-reading is 81% of the cost. A redesign would do the data pulls deterministically and then make ONE Messages API call per briefing. That could cut cost many-fold (**estimate**, not measured), which would make all 7 fit.
- **Risks:**
  - These run on the DESKTOP, which this search did not cover.
  - market-briefing and trading-concept are **read-only market summaries (flagged)**. They place nothing.
  - The renderer depth floors guard quality.
  - The credit expiring with no rollover argues for using it on this.

### 5. Weekly Content Scout (claude.ai cloud routine, dormant)
- **Now:** a claude.ai cloud routine (`scout/README.md`).
  - It runs an RSS scan, web-searches about 12 channels with no YouTube ID plus 1-2 discovery searches per category, builds `content-scout.html` and commits it.
  - Last digest commit: 2026-07-26 (`git log -- content-scout.html`). It has not run since.
- **LLM-shaped:** yes (web search plus picking and summarising).
- **Cost: estimate.** About 20 searches a run × $0.01 = $0.20, plus Sonnet at about 100k input and 15k output ($0.20 + $0.15). That is about $0.55 a week, **about $2.40 a month**.
  - The scanner (`scan_channels.py`) is deterministic and stays free.
- **Path:** a GitHub Actions workflow running a small script that calls the Messages API with the web_search tool. This is NOT `claude-code-action`, which the packet says the credit does not cover.
- **Risk:** low. It writes a public page, which is the same as before.

### 6. Wyckoff weekly transcript / transcript-intelligence backlog (manual today)
- **Now:** run by hand through the skills `wyckoff-transcript` and `transcript-intelligence`.
  - The workspace `Documents/wyckoff-transcripts-pine` holds 31 `*_final.md` (latest about 41 KB).
  - `Documents/youtube-transcripts` holds 698 files.
  - The Wyckoff output includes a Notion entry and `position_ledger.md`.
- **LLM-shaped:** yes (structured summarisation of a transcript).
- **Cost: estimate.**
  - One Sonnet call: about 45k input (transcript, rules, prior session) at $0.09, plus about 10k output at $0.10 = **about $0.20 a video**.
  - Run agentically through `claude -p`: about $1-2.
  - Weekly: **$1-9 a month**. Batch halves the single-call figure for any backlog.
- **Risks:**
  - The Wyckoff content is a **read-only crypto market analysis (flagged)**, and `position_ledger.md` records the analyst's stance, not orders.
  - The Notion write needs an MCP or API token in a headless run.
  - Quality gates (`tools/gate.py`, `check_quote_fidelity.py`) must still run.

## Budget check
Sum of the upper estimates for #1-#6: $13 + $0.07 + $2.10 + $55 + $2.40 + $9 = **about $82 a month**, under $100.
#4 dominates. Without it the credit is mostly unused, so #4 or a briefings redesign is the main use.

## Rejected
| Item | Why |
|---|---|
| ClaudeCodexRunawayWatch (20 min) | Deterministic. `codex-runaway-watch.py` reads local telemetry and Telegrams; no model call (grep of the ps1). |
| ClaudeFleetPulse (hourly) | Deterministic. `fleet-pulse.py` plus `harness_health.py`; no model call. |
| ClaudeUsagePulse (30 min) | Deterministic. One GET to the usage endpoint, and the header says "no model tokens spent" (`usage-pulse.ps1:2`). |
| ClaudeSystemBackup (14 days) | Deterministic file backup. |
| LPScoutDailyPositions (daily) | Deterministic Python. It screens and logs pools (money-adjacent, read-only, signs nothing) and sends a templated Telegram. Nothing for an LLM to do. |
| outcome-merge1-24h-read, outcome-pb1-test-day | **Money path** (live Outcome bot; pb1 arms a $500 test). Excluded. |
| fomo-daily-capture | Disabled 2026-09-07; browser-driven trading data capture; deterministic pipeline. |
| trading-bot-laptop-completion-resume | Disabled 2026-10-05; build work, not recurring LLM work. |
| corpus-worker / gardener (desktop) | Low volume: 12 items done, 2 pending in `pending-queue.md`, last worker run 2026-10-05. Pennies, and it needs local yt-dlp. Re-admit if the queue grows past about 10 items a month. |
| health-check.js `needs_ai` bucket | Empty: latest local report `health-reports/2026-07-02.json` has 0 items. `health-check.yml` (daily) is deterministic. |
| update-ticker / deploy / ci / notify-failure workflows | Deterministic Node or shell. |
| Trading-bot daily status digest (proposed in `2026-11.md` section 1) | Does not exist yet. On Haiku it would cost cents a month, but it reads a money-path repo, so it needs a scope decision first. |

## Cross-cutting caveats
- `claude -p` billing to `ANTHROPIC_API_KEY` instead of the subscription when the env var is set is (unverified, from memory). Confirm with one test call and the Console usage page before relying on it.
- Set a Console spend limit of $100 so an overrun cannot reach a card. That such a per-workspace limit exists is (unverified, from memory).
- The API key is a secret. Keep it in a gitignored env file read by the wrapper, never in the synced ps1.
- Desktop tasks (#4, corpus) were not inspected on their own machine. Their figures come from the briefings-site HANDOFF.
