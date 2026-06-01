---
name: biohacker-report
description: >
  Generate a Biohacker Intelligence Report — a research-grade briefing covering longevity
  science, training & hypertrophy, supplement evidence, nutrition, and curated wisdom from
  key newsletters. Runs every 2 days (even calendar days). Trigger whenever a scheduled task
  invokes this skill, or the user says "biohacker report", "health briefing", "biohacking
  update", "run biohacker", or any variation requesting a health/performance intelligence report.
---

# Biohacker Intelligence Report

You are generating the **Biohacker Intelligence Report** for Tony (Sydney) — a practitioner
briefing, not a wellness blog. Tony trains on a PPL split, tracks biomarkers, and has done
Vipassana. He wants the evidence, the mechanism, and the practical application — not hype.

**Quality bar:** Every claim in the research sections must cite a named study or named expert.
"Some studies suggest" is not acceptable. If evidence is weak, say so.

---

## STEP 0 — DEDUP (lean grep, not a full HTML read)

This brief runs every 2 days. Creatine, Zone 2, and sleep have been covered repeatedly without
new angles — do not include them unless there is a genuinely new study, finding, or mechanism.

Grep topic headlines from the last 3–4 biohacker issues to build an exclusion list:

```powershell
Select-String -Path "C:\Users\Tony\Documents\briefings-site\briefings\*\biohacker-report.html" `
  -Pattern '<h3>|class="wisdom-source-label"|class="item-title"' -SimpleMatch |
  Sort-Object Filename | Select-Object -Last 80 |
  ForEach-Object { $_.Line -replace '.*?>(.*?)<.*','$1' -replace '<[^>]+>','' }
```

Print the list as "DEDUP — covered recently (avoid repeating without new angle):".
A topic may repeat only with a **new study, new mechanism, or new practical protocol** — flag it
with `⚡ Update:` at the start of its headline.

---

## STEP 1 — RESEARCH

### Wisdom newsletters (Gmail MCP — search inbox)
Use `mcp__7d731c3c-4d52-43ec-b5cb-996e2af31041__search_threads` to find:
- James Clear 3-2-1 Thursday (subject: "3-2-1:" from james@jamesclear.com) — latest unread
- Brain Food / Shane Parrish (Farnam Street)
- Daily Stoic
- Tim Ferriss 5-Bullet Friday

If Gmail MCP is unavailable, note "Gmail unavailable — wisdom section sourced from web search"
and web-search for the latest edition of each.

### Research (web search — run in parallel)
- `longevity science study [month] [year]` — look for Attia, Huberman, Rhonda Patrick mentions
- `resistance training hypertrophy protocol research [month] [year]`
- `supplement evidence update [month] [year]` — avoid creatine/Zone2/sleep unless new mechanism
- `nutrition metabolism metabolic health research [month] [year]`
- `recovery HRV sleep quality biohacking [month] [year]` — new protocols, not generic advice
- `longevity biomarker blood test [month] [year]`

For any study referenced, WebFetch the abstract or summary URL to confirm it's real and extract
the actual finding (sample size, outcome measure, effect size). Never cite a study from memory.

---

## STEP 2 — BUILD THE HTML

Read `template.html` in this folder (path: `skills-briefings-files/briefing-biohacker/template.html`).
Replace the `{{tokens}}`, fill each `<!-- SECTION -->` body, then save as `briefings/YYYY-MM-DD/biohacker-report.html`.

**If `template.html` doesn't exist yet:** read only the `<head>` + `<style>` block from the most recent
`briefings/*/biohacker-report.html` (CSS only, not body content), then construct the body from scratch.
In that case, after saving, also create `template.html` by stripping day-specific content from your output
so future runs have it. Either way, do NOT read a prior full briefing body for content reference.

### Section order

- **§00 — Wisdom** — James Clear 3-2-1 ideas + quote cards + one question; Brain Food / Daily Stoic / Tim Ferriss if available
- **§01 — Longevity & Performance Science** — 2–3 research items with study citations
- **§02 — Training & Performance** — hypertrophy, recovery, movement; specific protocol or study
- **§03 — Supplements & Nutrition** — evidence-rated items (★★★ strong / ★★ moderate / ★ weak); name the mechanism
- **§04 — Notable Reads** — 3–4 curated links with one-sentence annotation each
- **§05 — Watchlist** — 3–5 things to watch or try in the next cycle

### Index extraction (REQUIRED — add to header)
The `template.html` has a hidden `<p class="tldr-text" style="display:none">` element inside
the header. This is what `generate-index.js` uses to generate the index card headline and preview.
Fill it with: 1 sentence stating the strongest insight + which sections/sources it comes from.
**Do not leave it empty or generic** ("covers longevity and training" is not acceptable).

### Issue numbering
Count existing files: `(ls briefings/*/biohacker-report.html).Count` → Issue #BIO-NNN.

---

## STEP 3 — SAVE

Save to: `C:\Users\Tony\Documents\briefings-site\briefings\YYYY-MM-DD\biohacker-report.html`

The wrapper handles `generate-index.js`, git commit, and push. Do not run those steps — just
save the HTML and confirm it exists.

---

## What to avoid

- Creatine / Zone 2 / generic sleep hygiene without a genuinely new angle
- Citing studies by name without fetching the actual abstract to confirm existence
- Sections with no practical takeaway ("further research is needed")
- Wisdom section populated with placeholder text if Gmail is unavailable — use web search instead
- Reading a prior full briefing HTML for styling — use `template.html`
- Evidence claims without a rating (★★★ / ★★ / ★)
