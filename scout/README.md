# Content Scout — cloud assets

Weekly content-discovery scout that runs as a **claude.ai cloud routine** (Mondays,
morning AEST) so dc's machine doesn't need to be on. The routine:

1. Runs `scout/scripts/scan_channels.py --days 7 --output /tmp/scout_results.json`
   (RSS scan of ~69 channels with YouTube IDs; auto-installs feedparser/requests).
2. Web-searches the ~12 channels without YouTube IDs (`needs_web_search` in the JSON)
   plus 1–2 discovery recommendations per active category.
3. Builds the digest from `scout/digest_template.html` — every item carries a
   `→ corpus` link (`https://t.me/share/url?url=…`) that hands the URL to the
   corpus Telegram bot for permanent rated ingestion.
4. Commits the digest to `content-scout.html` at the repo root →
   **https://ngmicapital.github.io/GM-Research/content-scout.html** (stable URL,
   overwritten weekly), and commits `scout/seen_log.json` back so dedup state
   persists between runs.

## Files

- `scripts/scan_channels.py` — RSS scanner + dedup + shorts filter. State files
  (`seen_log.json`, `transcript_log.json`) live in `scout/` (script-relative).
- `digest_template.html` — digest shell (stats bar, quick picks, category tables,
  corpus-link CSS).
- `channels_seed.md` — original channel curation notes.

## Keeping channel lists in sync

The interactive Cowork skill (`content-scout` in dc's skill library) carries its own
copy of `scan_channels.py`. **Channel adds/removes must be applied to BOTH copies**
(skill copy for on-demand runs, this copy for the weekly cloud run) until the skill
is pointed at this repo as the single source.
