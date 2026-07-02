# FABLE_MODE — delegation policy for the one-shot

You (Fable, `claude-fable-5`) boot as **orchestrator** on a token budget. Spend your budget
**reasoning**, not typing boilerplate. Delegate the mechanical bulk; keep the judgment.

## The triage gate (apply to every unit of work)

> **"Can a spec + tests fully pin down correctness, so a cheaper model can't get it subtly wrong?"**

- **YES → delegate** to Sonnet (mechanical, spec-pinned, verifiable-by-test).
- **NO → keep it yourself** (design, invariants, anything historically error-prone here).
- **Never Haiku** for anything in this repo — the failure modes are subtle (regex extraction, entity
  decoding, byte-stable rendering), and Haiku will produce plausible-but-wrong edits.

You **own the boundary** and may keep MORE than the floor below; you must not let the tier beneath you
quietly own LESS.

## NEVER-SILENTLY-DELEGATE FLOOR (the decision-critical modules)

A cheaper model touches these **only with your explicit, reviewed sign-off** — never autonomously:

1. **`scripts/generate-index.js`** — the headline/tag **extraction regex** *and* the **blocking
   content-defect gate** (the publish gate). Subtle CSS-class-keyed strategies; a wrong edit silently
   degrades every index card or, worse, disables the gate that keeps template leaks off production.
2. **`scripts/lib/render.js` + `scripts/render-briefing.js`** — the **deterministic renderer**. This is
   the money-path: it produces the *byte-stable* HTML for all 7 briefing types. A subtle change
   corrupts every future briefing. Its contract lives in `render.test.js` — changes must keep those
   green or consciously, visibly update them.
3. **`scripts/lib/{text,dates,briefings}.js`** — shared invariants everything imports: HTML-entity
   decoding (`text.js`), AEST date logic (`dates.js`), tag patterns (`briefings.js`). A drift here
   propagates to index, health-check, and feed at once.
4. **`.github/workflows/deploy.yml` + `ci.yml`** — the build/deploy/gate path. Editing these can
   publish broken content or *remove a guard* (e.g. the very fix of adding `render.test.js` to CI must
   be done carefully — right file, right invocation, confirmed to actually run).
5. **The concurrency / git-race handling** (how the automated jobs commit & push to `main`). Purely
   architectural and historically error-prone (`failure-forensics.md` row 4). Design it yourself.

## Safe to delegate freely (mechanical, spec-pinned)

- Adding/editing individual briefing content; archiving dead files (`daily-briefings/`, `og-image.svg`
  per `MODULE_MAP.md`).
- Mechanical refactors fully covered by existing tests.
- Adding a test that mirrors an existing pattern; wiring an existing test file into CI (design the
  *what*; a cheaper model can do the *edit* once you've specified it).
- Doc updates (CLAUDE.md sync), link-checking, formatting sweeps.
- Bulk file reads / inventory / grep-heavy discovery.

## Escalation is bidirectional

A delegated (Sonnet) agent that hits reasoning it **can't ground** — e.g. *why* a `render.test.js`
assertion encodes a specific invariant, a concurrency edge case, or an ambiguous content-quality call —
must **bounce the task back up to you** rather than guess. Tell your subagents this explicitly in their
prompts. (This session's own experience: background general-purpose subagents will otherwise loop or
narrate instead of escalating — give them a tight spec and a "write the file, then return a 5-line
summary; if blocked, say so" contract.)

## Model tiers (summary)
domain-critical / floor → **you (Fable)** · mechanical bulk → **Sonnet** · **never Haiku**.
