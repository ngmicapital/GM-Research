# TRUTH_TABLE — claims register (trust only what re-derives)

Every quantitative / factual claim this package makes, labelled by how much to trust it. **Fable: do
not act on any figure below without re-deriving it** (that's Task 0). Labels:

- **RAW-REPLAYABLE** — backed by an artifact you can re-run *from where you boot* (command given).
- **PRIOR-PROBE** — a claim from git history / a commit message; plausible but not independently re-run.
- **INFERENCE** — a conclusion drawn from evidence, not a direct measurement.
- **STALE / TO-VERIFY** — known-shaky; treat as suspect until re-checked.

| Claim | Value | Label | How to re-derive (from repo root) |
|-------|-------|-------|-----------------------------------|
| Unit tests pass | 38/38 (14 lib + 24 render) | **RAW-REPLAYABLE** | `node --test scripts/lib/lib.test.js scripts/lib/render.test.js` → `EVIDENCE/tests.out.txt` |
| Index build gate is clean | no `⚠️`/blocking defects; `✓` validator + `✓` integrity | **RAW-REPLAYABLE** | `node scripts/generate-index.js` → `EVIDENCE/generate-index.out.txt` |
| Health check | 10 pass / 2 auto-fixed / 2 needs-human / 0 errors | **RAW-REPLAYABLE** | `node scripts/health-check.js` → `EVIDENCE/health-check.out.txt`, `health-reports/2026-07-01.json` |
| Content volume | 92 dates, 497 briefing HTML files, 23 transcripts | **RAW-REPLAYABLE** | `ls briefings \| wc -l`; `git ls-files briefings/ \| grep -c '\.html$'`; `ls transcripts \| wc -l` |
| Deterministic renderer covers all 7 types | 7/7 wired | **RAW-REPLAYABLE** | `scripts/render-briefing.js` has a `TEMPLATES` entry + `template.render.html` per type; drafts exist for 28 Jun–1 Jul |
| Renderer rollout reached all 7 types | 2026-06-27 | **PRIOR-PROBE** | commit `5fd675e` message; corroborated by the wiring above |
| Renderer "cut token usage" | **~31% smaller model output per briefing** (828KB JSON vs 1206KB HTML over 28 real draft→published pairs, 28 Jun–2 Jul, all 7 types; per-type range 21–45%) | **MEASURED 2026-07-02 (proxy)** | Re-derive: compare byte sizes of `skills-briefings-files/**/drafts/content-<date>.json` against `briefings/<date>/<type>.html`. This is an OUTPUT-BYTES proxy for output tokens (the model formerly emitted the full HTML); API-level token totals, and any prompt-side savings from `fd0ca9f`, remain uninstrumented. |
| `render.test.js` runs in CI | **NO** — only `lib.test.js` does | **RAW-REPLAYABLE** | `grep 'node --test' .github/workflows/ci.yml` → single line, `lib.test.js` only |
| Concurrency race is fixed | **NO — still recurring** | **INFERENCE** | untracked 2026-07-01 praxis (recovered `d12eb0d`) + divergent `codex/*` branch briefs (06-24, 06-25); `deploy.yml` has only a 30s debounce, not serialization |
| Missing briefings | `rabbit-hole.html` absent 2026-06-28 & 2026-07-01 | **RAW-REPLAYABLE** | `health-check.js` needs-human; `ls briefings/2026-06-28 briefings/2026-07-01` |
| Node version | local v24, CI pins 20 (both ≥20) | **RAW-REPLAYABLE** | `node --version`; `.github/workflows/*.yml` `node-version: '20'` |
| Prior memory "renderer is an in-progress pilot" | **STALE — false as of 2026-06-27** | **STALE** | superseded by `5fd675e`; git is authoritative (see `EVOLUTION.md` Era 4) |
| Health-check report dated `2026-07-01.json` while AEST was 2026-07-02 | possible off-by-one, or intentional "last complete day" | **TO-VERIFY** | run `health-check.js`, inspect its date logic in `scripts/lib/dates.js` (`todayAEST`) vs the report filename; a known-broken shell `TZ` on this machine makes this worth a direct check |

## The one decision-critical claim (the website analog of "P&L")

For a trading bot the invariant is net P&L; for this **website it is: "the deterministic renderer
produces correct, byte-stable published HTML, and it is actually guarded."** Right now that invariant
is **only half-true**: the renderer is wired for all 7 types and its 24 tests pass locally
(**VERIFIED** — re-ran this session), **but those tests do not run in CI** (**VERIFIED** from
`ci.yml`), so nothing stops a future change from silently breaking every briefing. Treat closing that
gap as the load-bearing fact of this handoff.
