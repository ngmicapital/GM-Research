# GOAL — the mandate for Fable

> Written in the owner's (dc's) voice from the scope decision made 2026-07-02. dc: tighten the wording
> if it doesn't match your intent — this is the bar Fable will optimize against.

## The mandate

Take **GM Research** from a *working* daily-briefing engine to a genuinely **excellent product**.
This is a **full product upgrade**, not a tidy-up. Audit the whole thing end to end — the build/deploy
path, the content-generation pipeline, the quality of what actually gets published, the reading
experience, and the automation that keeps it alive — and then **make it better**. You have my
authority to change the architecture where it's warranted, as long as you don't break the public site
or leak anything private.

## What "10 out of 10 / done" looks like

Judge yourself against these, roughly in priority order:

1. **Reliability — the concurrency race is dead.** No more dropped, duplicated, or divergent same-day
   briefings. Every expected briefing for a day publishes exactly once, and nothing that was generated
   ends up uncommitted or stranded on a side branch. This is the #1 problem (see
   `EVIDENCE/failure-forensics.md` row 4) — solving it well is most of the score.
2. **Every safety net actually runs.** If a test or gate exists, it gates. Concretely: the 24
   `render.test.js` tests currently do **not** run in CI (only `lib.test.js` does) — that's a hole over
   the deterministic renderer, the most dangerous place to have one. No class of content defect
   (leaked template token/comment, raw HTML entity) can reach production.
3. **Content excellence.** Briefings are consistently high-signal and non-repetitive (the dedup tooling
   is used and works), claims are cited where they should be, and every type renders cleanly on mobile
   and desktop. A reader should trust it.
4. **Reading experience.** Index, search, filtering, navigation, and performance feel premium — fast,
   accessible, no layout shift, no dead links.
5. **Token efficiency held.** The deterministic renderer keeps generation cheap; don't regress that to
   buy quality — get both. If you can *measure and report* the actual token cost (there is no measured
   figure today — see `TRUTH_TABLE.md`), that itself is a win.
6. **Legible to a cold contributor.** Docs match reality (CLAUDE.md currently doesn't even mention the
   renderer). Someone new — or the next model — can understand and extend it without a guide.

## Non-goals / guardrails (do NOT do these)

- **Don't break existing briefing permalinks** (`briefings/YYYY-MM-DD/<type>.html`) or the transcript
  URLs — they're indexed and linked.
- **Keep the zero-runtime-dependency ethos.** Build tooling stays plain Node stdlib; no `npm install`
  in the deploy path unless there's a compelling, argued reason.
- **Never publish drafts or secrets.** `skills-briefings-files/**/drafts/` and the Telegram secrets
  stay out of the deployed tree (see `CURRENT_STATE.md §4`).
- **Preserve the renderer's byte-stable output contract** where `render.test.js` encodes it — changes
  there must keep tests green or consciously update them.
- **Timezone is AEST** and **deploy is direct-to-main → GitHub Pages.** Don't quietly change either.

## How you'll be supervised

dc reviews the result. You (Fable) own the boundary of what to do yourself vs delegate — see
`FABLE_MODE.md`. Start by **re-auditing our numbers** (Task 0 in `ONESHOT_PROMPT.md`): trust nothing
in this package you can't re-derive.
