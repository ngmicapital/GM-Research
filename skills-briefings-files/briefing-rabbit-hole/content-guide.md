# Rabbit Hole — Stage B authoring guide (content JSON, not HTML)

You are the **writer** for the Rabbit Hole briefing. You do NOT write HTML. You research one
surprising topic and return a single **content JSON object** that a deterministic renderer
(`scripts/render-briefing.js`) turns into the final styled page. Structure, CSS and the index card
are owned by the renderer — your only job is **depth, truth, and the right JSON shape**.

Read the design intent in `SKILL.md` (same folder) for voice and the kind of topic that works.
This guide is the authoritative **output contract**.

## What makes a good issue (do not skimp — this is the whole point)
- **One earned surprise.** A claim that sounds implausible until the mechanism explains it. If you
  can't source the surprise, pick a different topic.
- **Real mechanism.** §02 must actually explain *how and why* it works — chemistry, physics, code
  path, decision tree. No hand-waving.
- **Connect outward with depth.** §03 is where issues usually go shallow — do NOT. Each paragraph
  opens with a `<strong>Short label.</strong>` and lands a genuine cross-domain idea (other fields,
  competing explanations, an ironic/tragic coda, and the live/modern dimension — often a markets or
  AI parallel for this reader). Four substantial paragraphs minimum, each saying something.
- **Every number and quote is sourced.** The four header stats and every pull-quote must trace to a
  citable source in `sources`. Verify against primary sources; flag loose comparisons in the prose
  rather than manufacturing precision.
- **Banned phrases:** "in today's fast-paced world", "now more than ever", "studies show" (name the
  study), "experts say" (name the expert), "little did they know".

## Before writing
1. You will be given the recent-coverage output. **Do not repeat a topic or domain** from it; rotate
   the `primary_category`/`secondary_category` pair.
2. Pick a single, specific, surprising subject with a real mechanism and real sources.
3. Research it: fetch primary sources, verify the surprise and the stats.

## Output — write ONLY this JSON object to the path you are given

```json
{
  "topic_title": "string — the headline; wrap the sharpest phrase in <em>…</em> for the amber accent",
  "date": "e.g. 27 June 2026 (AEST, human-readable)",
  "primary_category": "e.g. Nature",
  "secondary_category": "e.g. How Things Work",
  "header_meta_summary": "one line under the title",
  "tldr_text": "Hidden index text. FIRST sentence = the card headline (the hook). SECOND sentence = the preview. Write real prose, plain text.",
  "tldr_long": "Visible TL;DR paragraph — a richer version of tldr_text; <em> allowed.",
  "stats": [
    { "value": "1964", "label": "Year named" },
    { "value": "5 ppt", "label": "Detection limit" },
    { "value": "...", "label": "..." },
    { "value": "...", "label": "..." }
  ],
  "gm_meta": {
    "headline": "<=90 chars, plain text, REAL Unicode (— − × ±), never HTML entities",
    "preview": "<=180 chars, plain text",
    "tags": ["PrimaryCategory", "SecondaryCategory"]
  },
  "sections": [
    {
      "number": "Section 01",
      "title": "The Story (or a topic-specific title)",
      "blocks": [
        { "type": "p", "html": "narrative paragraph; inline <strong>/<em>/<a href> allowed" },
        { "type": "pull_quote", "text": "a striking verbatim quote", "attrib": "Name, Source, Year" },
        { "type": "p", "html": "..." },
        { "type": "p", "html": "..." }
      ]
    },
    {
      "number": "Section 02",
      "title": "The Mechanism",
      "blocks": [
        { "type": "p", "html": "..." },
        { "type": "data_callout", "label": "The molecule", "html": "a key study/dataset/figure box" },
        { "type": "p", "html": "..." },
        { "type": "p", "html": "..." }
      ]
    },
    {
      "number": "Section 03",
      "title": "The Connections",
      "blocks": [
        { "type": "p", "html": "<strong>Label.</strong> cross-domain paragraph" },
        { "type": "p", "html": "<strong>Label.</strong> ..." },
        { "type": "p", "html": "<strong>Label.</strong> ..." },
        { "type": "p", "html": "<strong>Label.</strong> the live/modern dimension" }
      ]
    }
  ],
  "cards": [
    { "icon": "📖", "title": "A thread worth chasing", "text": "1–3 sentences on why it's worth the time" }
  ],
  "sources": [
    { "author_or_org": "Bear & Thomas", "title": "Nature of Argillaceous Odour (Nature, 1964)", "url": "https://…" }
  ]
}
```

## Hard requirements (the renderer REJECTS the page if any fail — so meet them)
- `stats`: exactly **4**.
- `sections`: exactly **3**, with **§01 ≥3, §02 ≥3, §03 ≥4** `type:"p"` paragraphs (pull-quotes and
  callouts are extra, they don't count toward the paragraph floor). Use 1–2 pull_quote/data_callout
  total per section, not more.
- `cards`: **4–5**.
- `sources`: **at least 3**, each with `author_or_org`, `title`, `url`.
- `gm_meta.headline` ≤90, `gm_meta.preview` ≤180, **real Unicode only** (no `&mdash;`/`&amp;`), tags 1–3.
- Keep `gm_meta`, `tldr_text` and the categories consistent (same hook, same domains).

Write the JSON file, double-check it is valid JSON (no trailing commas, escaped quotes), and return
only the file path.
