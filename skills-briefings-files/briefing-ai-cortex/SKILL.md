---
name: briefing-ai-cortex
description: Pointer — the AI briefing's authoring skill is ai-briefing-SKILL.md in this folder.
---

# AI Cortex briefing — see `ai-briefing-SKILL.md`

The runtime authoring skill for this briefing type is **`ai-briefing-SKILL.md`** in
this folder — that is the file the `ai-briefing-daily` scheduled task reads and
executes. It holds the full instructions, the gm-meta index contract, and the
output structure. `template.html` is the canonical styling source.

(This `SKILL.md` is only a pointer. This type's authoring skill uses the
`<type>-SKILL.md` naming, not `SKILL.md` — don't add a second authoring doc here.)
