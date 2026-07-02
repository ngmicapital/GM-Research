# EVOLUTION — how GM Research got here

Reconstructed from git (`git log`, 1,414 commits, 2026-03-27 → 2026-07-02). Every claim ties to a
commit SHA. This is the "how we got here" companion to `CURRENT_STATE.md`.

## The arc in one line

Hand-authored multi-type site (born in a day) → daily content accretion → a platformization burst
that added a shared lib + structured meta-contract + CI gates → a deterministic **renderer** that cut
the token cost of generation while keeping output identical. The renderer is the current mature
frontier.

## Eras

### Era 1 — Birth (2026-03-27, single day)
The whole site was stood up and iterated hard in one day. `4a4448b` "Initial GitHub Pages setup",
then the first briefings: legal (`8639d17`), morning (`3676573`), biohacker (`b38d3a9`), bio-os
(`b2456ae`), ai (`ed8f813`), market (`26f1fc4`). Same-day corrections show the model settling the
type taxonomy live: **bio-os added then removed as private** (`fd887ea`), **morning-briefing renamed/
deduped into market-briefing** (`1b52e69`, `83d6dde`), legal moved onto a "Charter template"
(`f8f7e9e`). The **Transcripts** section landed the same day — tab (`6d1a565`), manifest (`afcd88d`),
and the first transcripts with the Echo / Spark & Cannon artifacts (`8cef550`, `98df5d4`, `b0e0433`).
*Superseded here:* bio-os (private), morning-briefing (→ market-briefing).

### Era 2 — Accretion (late Mar → early Jun)
The bulk of the 1,414 commits: daily briefings across the seven types pile up, the taxonomy
stabilizes, and automated **daily health-check** chore commits begin. Little architecture change —
this is the content-engine running.

### Era 3 — Platformization (2026-06-13 → 06-14)
A deliberate engineering burst turned a pile of HTML into a maintainable platform:
- `8377365` **extract shared lib** (`scripts/lib/` — text/dates/briefings), unify tag patterns, fix
  visualization entity decoding — this ended the per-script logic drift that had let `generate-index`
  and `health-check` disagree on tags.
- `cb37f99` **index redesign** — search, multi-filter, URL state, lazy feed, reading time, RSS, a11y.
- `f387904` + `19c28fa` **gm-meta meta-contract** — templates emit an explicit `gm-meta` JSON block;
  generators read it and fall back to regex. (This is the seed of the later renderer.)
- `d3d6c9a` sitemap + branded 404 + "/" search shortcut; `bf9e4ae` deterministic feed date.
- `05b9601` + `6032d1a` **recent-coverage.js** wired into authoring skills (dedup support so briefings
  don't repeat recent topics).
- `bc8e6ee` wire the REAL authoring skills, collapse redundant SKILL.md into pointers.
- `0a8992e` Telegram failure-alert workflow; `eff81fb` branded og-image + OG/Twitter meta.
- `117526f` **hard-gate blocking content defects**; `ecab879` strip a leaked template comment + guard.
- `daaa523` CLAUDE.md rewritten for the shared lib / CI / integrity check / ticker decoupling.
  Ticker also decoupled to the `ticker-data` orphan branch in this window (main gets zero ticker commits).

### Era 4 — Token rebuild / deterministic renderer (2026-06-26 → 06-28) — the current frontier
The payoff era. Briefing *generation* was the expensive part (the model re-emitting full styled HTML
each day). This era replaced that with author-the-content-JSON + deterministically-render:
- `523ec37` CI health-check workflow **replaces the failing cloud triage routine**.
- `177f2af` **deterministic briefing renderer** + rabbit-hole render template (pilot).
- `edc28c1` rabbit-hole wired to the content-contract + section-depth enforcement.
- `bc24bb6` section-fragment renderer + ai-briefing wired.
- `812e7ce` praxis, trading-concept, biohacker onto the pipeline.
- `5fd675e` **legal + market on — all 7 briefings now on the render pipeline.**
- `fd0ca9f` **"Cut token usage across briefing routines"** — the goal realized.
- `7538e1d` (06-28) fix: strip leading TEMPLATE authoring comment before token fill (renderer bug).

> **This corrects a stale project memory** that described the renderer as an "in-progress rabbit-hole
> pilot." Git is authoritative: it reached all 7 types on 2026-06-27 and is in active use (see the
> `drafts/content-*.json` inputs for 28 Jun–1 Jul).

### Era 5 — Automation polish (2026-06-30 →)
`24c0b49` scout digest → Telegram notification workflow; `d655e5e` fix HTML-entity decoding in scout
channel names. Daily ops continue. `d12eb0d` (2026-07-02) recovered an untracked briefing during this
Fable-readiness prep.

## Where it's heading
The architecture is mature: shared lib + meta-contract + deterministic renderer + layered CI gates.
The standing frontier is **verifying and hardening** the renderer pipeline and the concurrent-run
git handling. On top of that sits the **Fable mandate** (a full product upgrade — see `GOAL.md`).
