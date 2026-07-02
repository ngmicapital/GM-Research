#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT            = path.join(__dirname, '..');
const BRIEFINGS_DIR   = path.join(ROOT, 'briefings');
const TRANSCRIPTS_DIR = path.join(ROOT, 'transcripts');
const MANIFEST_FILE   = path.join(TRANSCRIPTS_DIR, 'manifest.json');
const OUTPUT_FILE     = path.join(ROOT, 'index.html');
const FEED_FILE       = path.join(ROOT, 'feed.xml');
const SITEMAP_FILE    = path.join(ROOT, 'sitemap.xml');

// --- Shared library -------------------------------------------------------

const { escapeHtml, stripHtml } = require('./lib/text');
const { todayAEST } = require('./lib/dates');
const { BRIEFING_META, ORDER, extractTags, readMeta } = require('./lib/briefings');

const SITE_URL = 'https://ngmicapital.github.io/GM-Research/';

// Estimate reading time (whole minutes) for a briefing's full HTML body.
// Drops <script>/<style> blocks, strips the remaining tags, counts whitespace-
// delimited words, and returns max(1, round(words/200)) — 200 wpm reading speed.
function readingTimeMinutes(html) {
  if (!html) return 1;
  const text = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// RFC-822 date string anchored at noon UTC, for RSS <pubDate>.
// e.g. "Sat, 13 Jun 2026 12:00:00 GMT"
function rfc822(ds) {
  const d = new Date(`${ds}T12:00:00Z`);
  if (isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

// Escape text for inclusion in XML (RSS) — superset of HTML escaping that also
// handles the apostrophe, since XML attribute/text rules are stricter.
function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Extract a headline, preview summary + tags from a briefing HTML file
function extractBriefingMeta(filePath, key) {
  let headline = '';
  let preview = '';
  let tags = [];
  let minutes = 1;
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    minutes = readingTimeMinutes(html);

    // Metadata contract: if the briefing emits an explicit gm-meta JSON block,
    // trust it and skip the regex strategies below. Legacy briefings (no block)
    // fall through unchanged, so this never alters existing output.
    const meta = readMeta(html);
    if (meta) {
      return { headline: meta.headline, preview: meta.preview, tags: meta.tags, minutes };
    }

    // Strategy 1: TL;DR block (market, ai, biohacker)
    // Handles: <div class="tldr-text">, <p class="tldr-text">, and plain <p> inside .tldr
    const tldrTextMatch = html.match(/class="tldr-text"[^>]*>([\s\S]*?)<\/(?:p|div)>/);
    const tldrPMatch = !tldrTextMatch && html.match(/class="tldr"[\s\S]*?<p>([\s\S]*?)<\/p>/);
    const tldrMatch = tldrTextMatch || tldrPMatch;
    if (tldrMatch) {
      let text = stripHtml(tldrMatch[1]);
      // Find sentence boundary (". " followed by uppercase, or "; " as separator)
      let sentEnd = text.search(/\.\s+[A-Z]/);
      if (sentEnd < 15) sentEnd = text.search(/;\s+/);  // fallback: semicolon split
      if (sentEnd > 15) {
        let h = text.slice(0, sentEnd + 1);
        if (h.length > 90) h = h.slice(0, h.lastIndexOf(' ', 87) || 87) + '...';
        headline = h;
        let rest = text.slice(sentEnd + 2).trim();
        // Second sentence for preview
        let sent2 = rest.search(/\.\s+[A-Z]/);
        if (sent2 < 10) sent2 = rest.search(/;\s+/);
        if (sent2 > 10) rest = rest.slice(0, sent2 + 1);
        if (rest.length > 180) rest = rest.slice(0, 177) + '...';
        preview = rest;
      } else {
        headline = text.length > 90 ? text.slice(0, text.lastIndexOf(' ', 87) || 87) + '...' : text;
      }
    }

    // Strategy 1b: TL;DR with bullet list (<ul><li> inside .tldr)
    // Used by older market-briefing templates that put the thesis in <li> rather than <p>.
    // First <li> becomes the headline, second <li> becomes the preview.
    if (!headline) {
      const tldrBlockMatch = html.match(/class="tldr"[\s\S]*?<ul>([\s\S]*?)<\/ul>/);
      if (tldrBlockMatch) {
        const liRe = /<li[^>]*>([\s\S]*?)<\/li>/g;
        const items = [];
        let lm;
        while ((lm = liRe.exec(tldrBlockMatch[1])) && items.length < 3) {
          const t = stripHtml(lm[1]);
          if (t.length > 10) items.push(t);
        }
        if (items.length >= 1) {
          let h = items[0];
          // Trim at em-dash subhead separator if it appears mid-sentence
          const dashIdx = h.indexOf(' — ');
          if (dashIdx > 25 && dashIdx < 90) h = h.slice(0, dashIdx);
          // Trim at first sentence boundary if long
          if (h.length > 90) {
            const sentEnd = h.search(/\.\s+[A-Z]/);
            if (sentEnd > 25 && sentEnd < 90) h = h.slice(0, sentEnd + 1);
            else h = h.slice(0, h.lastIndexOf(' ', 87) || 87) + '...';
          }
          headline = h;
        }
        if (items.length >= 2) {
          let p = items[1];
          // Trim at em-dash subhead separator
          const dashIdx2 = p.indexOf(' — ');
          if (dashIdx2 > 25 && dashIdx2 < 120) p = p.slice(0, dashIdx2);
          if (p.length > 180) p = p.slice(0, p.lastIndexOf(' ', 177) || 177) + '...';
          preview = p;
        }
      }
    }

    // Strategy 2: Legal brief — use first story title as headline, second as preview
    if (!headline && key === 'legal-brief') {
      const storyTitles = [];
      const re = /story-title"[^>]*>([^<]+)/g;
      let m;
      while ((m = re.exec(html)) && storyTitles.length < 3) {
        let t = stripHtml(m[1]);
        // Trim at em-dash (subheadline separator) — allow up to 90 chars before the dash
        const dashIdx = t.indexOf(' — ');
        if (dashIdx > 10 && dashIdx < 90) t = t.slice(0, dashIdx);
        // Trim at colon prefix
        const colonIdx = t.indexOf(': ');
        if (colonIdx > 10 && colonIdx < 50) t = t.slice(0, colonIdx);
        // Hard cap
        if (t.length > 90) t = t.slice(0, t.lastIndexOf(' ', 87) || 87) + '...';
        storyTitles.push(t);
      }
      if (storyTitles.length >= 1) headline = storyTitles[0];
      if (storyTitles.length >= 2) {
        let p = storyTitles.slice(1).join(' · ');
        if (p.length > 180) p = p.slice(0, 177) + '...';
        preview = p;
      }
    }

    // Strategy 3a: Praxis / card-title based extraction
    // Reads the first card-title as headline and subsequent card-titles as preview.
    // Avoids the section-title fallback which only yields generic section names.
    // Also runs when headline was set by Strategy 1 (tldr-text) but preview is still empty,
    // e.g. when the tldr-text uses semicolons rather than ". Capital" sentence boundaries.
    if ((!headline || !preview) && key === 'praxis-brief') {
      const cardTitles = [];
      const re = /card-title"[^>]*>([\s\S]*?)<\/div>/g;
      let m;
      while ((m = re.exec(html)) && cardTitles.length < 4) {
        const t = stripHtml(m[1]);
        if (t.length > 5 && !t.includes('{')) cardTitles.push(t);
      }
      if (cardTitles.length >= 1) {
        let h = cardTitles[0];
        if (h.length > 90) h = h.slice(0, h.lastIndexOf(' ', 87) || 87) + '...';
        headline = h;
      }
      if (cardTitles.length >= 2) {
        let p = cardTitles.slice(1, 3).map(t => t.length > 55 ? t.slice(0, t.lastIndexOf(' ', 52) || 52) + '...' : t).join(' · ');
        if (p.length > 180) p = p.slice(0, 177) + '...';
        preview = p;
      }
    }

    // Strategy 3b: fallback — first section-title as headline
    // ⚠ Known issue: produces generic output for briefings without tldr-text or card-title elements.
    if (!headline) {
      const sectionTitles = [];
      const re = /section-title">\s*(?:[^\s<]*\s)?([^<]+)/g;
      let m;
      while ((m = re.exec(html)) && sectionTitles.length < 3) {
        const t = stripHtml(m[1]);
        if (t.length > 3 && !t.includes('{')) sectionTitles.push(t);
      }
      if (sectionTitles.length >= 1) headline = sectionTitles[0];
      if (sectionTitles.length >= 2) preview = sectionTitles.slice(1).join(' · ');
    }

    // ── Extraction quality check ──────────────────────────────────────────────
    // Warn when the headline looks like it was lifted from a section header
    // rather than actual content (a sign that extraction failed).
    const GENERIC_SECTION_NAMES = [
      // Generic / cross-briefing
      'key ideas', 'ideas & insights', 'ideas and insights',
      'strategy & practice', 'strategy and practice',
      'tools & resources', 'tools and resources',
      'on the horizon', 'watchlist', 'overview', 'summary',
      'top stories', 'highlights', 'the rundown',
      // Morning Edge (market-briefing) section names
      'global macro snapshot', 'equities & sector rotation', 'equities and sector rotation',
      'bitcoin & crypto markets', 'bitcoin and crypto markets',
      'regulatory & legal radar', 'regulatory and legal radar',
      'ai & semiconductor watch', 'ai and semiconductor watch',
      'prediction market intelligence', 'geopolitical calendar', "today's watchlist",
      // AI briefing section names
      'model releases', 'research papers', 'ai x crypto', 'ai and crypto',
      // Legal brief section names
      'court decisions', 'regulatory actions', 'enforcement actions', 'legislative tracker',
      // Biohacker section names
      'this week in longevity', 'training protocols', 'protocol of the week',
    ];
    if (headline && GENERIC_SECTION_NAMES.some(s => headline.toLowerCase().startsWith(s))) {
      console.warn(`⚠  [validator] ${key} @ ${filePath.split(/[\\/]/).slice(-2).join('/')}: headline looks like a section header ("${headline}"). Add a tldr-text element or card-title for better extraction.`);
    }

    // Extract tags (shared canonical patterns + rabbit-hole <strong> fallback)
    tags = extractTags(html, key);
  } catch(e) { /* file read error — use defaults */ }
  return { headline, preview, tags, minutes };
}

// ─── v2 design — category system ─────────────────────────────────────────────
// Same 9 underlying buckets as BRIEFING_META's `cat` field (+ transcripts/
// recipes), renamed/recolored per design/extracted/.../README.md's category
// table. Keys renamed (market→edge, legal→prec, ai→cortex, trade→alpha);
// bio/rh/prx/tx/rec keep their names. This is a pure relabeling — no new
// buckets, so every existing tag/filter/count concept carries over exactly.
const CAT_MAP = { market:'edge', legal:'prec', ai:'cortex', bio:'bio', rh:'rh', prx:'prx', trade:'alpha', tx:'tx', rec:'rec' };
const CAT_META = {
  edge:   { name: 'Morning Edge', icon: '\u{1F4C8}' },
  prec:   { name: 'Precedent',    icon: '⚖️' },
  cortex: { name: 'Cortex',       icon: '\u{1F916}' },
  bio:    { name: 'Biohacker',    icon: '\u{1F9EC}' },
  alpha:  { name: 'Alpha',        icon: '\u{1F3AF}' },
  rh:     { name: 'Rabbit Hole',  icon: '\u{1F573}️' },
  prx:    { name: 'Praxis',       icon: '\u{1F4A1}' },
  tx:     { name: 'Transcripts',  icon: '\u{1F3A5}' },
  rec:    { name: 'Recipes',      icon: '\u{1F36B}' },
};
const CAT_ORDER = ['edge', 'prec', 'cortex', 'bio', 'alpha', 'rh', 'prx', 'tx', 'rec'];

const RECIPE_DATE = '2026-04-03';
const RECIPE_ENTRY = {
  url: 'recipes/ultimate-chewy-brownies/index.html',
  cat: 'rec',
  title: 'The Ultimate Chewy Brownie',
  sum: 'Brown butter + oil, dual sugars, 2+2 egg ratio. Science-backed.',
  tags: ['Baking', 'Brownies'],
  minutes: 4,
};

function dayOfWeekUpper(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toUpperCase();
}

// Build the unified, per-day entry list every v2 section (front page + archive
// rows) renders from — one shape for briefings, transcripts, and the recipe.
// Order within a day matches the previous template exactly (briefings in ORDER,
// then transcripts, then the recipe row), so "today's lead" is still always a
// briefing whenever one exists for today, same as before.
function buildDays(briefingEntries, transcriptsByDate, today) {
  const briefingMap = {};
  briefingEntries.forEach(e => { briefingMap[e.date] = e.briefings; });

  const dateSet = new Set([...briefingEntries.map(e => e.date), ...Object.keys(transcriptsByDate)]);
  dateSet.add(RECIPE_DATE); // ensure the recipe's date is always represented, even with no briefings that day
  const allDates = [...dateSet].sort().reverse();

  const kwCounts = {};
  const catCounts = Object.fromEntries(CAT_ORDER.map(k => [k, 0]));

  const days = allDates.map(date => {
    const entries = [];

    (briefingMap[date] || []).forEach(key => {
      const m = BRIEFING_META[key];
      const fp = path.join(BRIEFINGS_DIR, date, m.filename);
      const { headline, preview, tags, minutes } = extractBriefingMeta(fp, key);
      const cat = CAT_MAP[m.cat];
      catCounts[cat]++;
      tags.forEach(t => { kwCounts[t] = (kwCounts[t] || 0) + 1; });
      entries.push({
        url: `briefings/${date}/${m.filename}`, cat,
        title: headline || m.preview, sum: preview, tags, minutes,
      });
    });

    (transcriptsByDate[date] || []).forEach(t => {
      catCounts.tx++;
      const dt = (t.domain || '').split(/\s*[/&]\s*/).map(s => s.trim()).filter(s => s.length > 1 && s.length <= 22).slice(0, 2);
      let minutes = 1;
      try { minutes = readingTimeMinutes(fs.readFileSync(path.join(TRANSCRIPTS_DIR, t.slug, 'index.html'), 'utf8')); } catch (e) { /* default */ }
      entries.push({
        url: `transcripts/${t.slug}/index.html`, cat: 'tx',
        title: t.title || t.slug, sum: t.source || '', tags: dt.length ? dt : ['Transcript'], minutes,
      });
    });

    if (date === RECIPE_DATE) { catCounts.rec++; entries.push(RECIPE_ENTRY); }

    return { date, dow: dayOfWeekUpper(date), today: date === today, entries };
  }).filter(d => d.entries.length > 0);

  return { days, kwCounts, catCounts };
}

// ─── v2 markup builders ───────────────────────────────────────────────────────

function frontPageHTML(day) {
  if (!day || !day.entries.length) return '';
  const [lead, ...rest] = day.entries;
  const rail = rest.slice(0, 2);
  const briefs = rest.slice(2, 5);
  const leadCat = CAT_META[lead.cat];

  const leadTagsHTML = lead.tags.map((t, i) => `${i > 0 ? '<span class="sep">·</span>' : ''}<span>${escapeHtml(t)}</span>`).join('');

  const railHTML = rail.map(e => `
        <a class="rail-item" data-cat="${e.cat}" href="${escapeHtml(e.url)}">
          <span class="slug">${escapeHtml(CAT_META[e.cat].name)} <span class="min">— ${e.minutes} min</span></span>
          <h3>${escapeHtml(e.title)}</h3>
          <p>${escapeHtml(e.sum)}</p>
        </a>`).join('');

  const briefsHTML = briefs.map(e => `
        <a class="brief" data-cat="${e.cat}" href="${escapeHtml(e.url)}">
          <span class="slug"><span aria-hidden="true">${CAT_META[e.cat].icon}</span> ${escapeHtml(CAT_META[e.cat].name)} <span class="min">— ${e.minutes} min</span></span>
          <h4>${escapeHtml(e.title)}</h4>
        </a>`).join('');

  return `
<section class="fp wrap" id="fp">
  <div class="fp-eyebrow">
    <span><b>// front page</b> — ${day.dow}, ${day.date}</span>
    <span>${day.entries.length} briefing${day.entries.length === 1 ? '' : 's'} today</span>
  </div>
  <div class="fp-grid">
    <a class="lead" data-cat="${lead.cat}" href="${escapeHtml(lead.url)}">
      <span class="lead-kicker">Today’s lead — ${escapeHtml(leadCat.name)}</span>
      <h1>${escapeHtml(lead.title)}</h1>
      <p class="lead-dek">${escapeHtml(lead.sum)}</p>
      <span class="lead-meta">${leadTagsHTML}${lead.tags.length ? '<span class="sep">·</span>' : ''}<span>${lead.minutes} min read</span><span class="sep">·</span><span class="go">read →</span></span>
    </a>
    <div class="rail">${railHTML}</div>
  </div>
  ${briefs.length ? `<div class="briefs">${briefsHTML}</div>` : ''}
</section>`;
}

function rowHTML(e) {
  const cat = CAT_META[e.cat];
  const tagsAttr = e.tags.join(',').toLowerCase();
  return `
      <a class="row" data-cat="${e.cat}" data-tags="${escapeHtml(tagsAttr)}" href="${escapeHtml(e.url)}">
        <span class="tile" aria-hidden="true">${cat.icon}</span>
        <span class="row-series">${escapeHtml(cat.name)}</span>
        <span class="row-main">
          <div class="row-title">${escapeHtml(e.title)}</div>
          <div class="row-sum">${escapeHtml(e.sum)}</div>
        </span>
        <span class="row-right"><b>${e.minutes} min</b> · ${escapeHtml(e.tags[0] || '')}</span>
      </a>`;
}

function dayBlockHTML(day) {
  return `
    <section class="day" data-month="${escapeHtml(day.date.slice(0, 7))}" data-date="${escapeHtml(day.date)}">
      <div class="day-hd">
        <span><b>${escapeHtml(day.date)}</b> · ${escapeHtml(day.dow)}${day.today ? '<span class="today-chip">TODAY</span>' : ''}</span>
        <span class="cnt">${day.entries.length} ${day.entries.length === 1 ? 'entry' : 'entries'}</span>
      </div>
      ${day.entries.map(rowHTML).join('')}
    </section>`;
}

// ─── Build full HTML ─────────────────────────────────────────────────────────

function buildHTML(briefingEntries, transcriptsByDate) {
  const { date: aestNow, iso: today } = todayAEST();
  const { days, kwCounts, catCounts } = buildDays(briefingEntries, transcriptsByDate, today);

  // en-GB for the folio's day-first "2 JULY 2026" (design spec §40); en-US on the
  // compact status line for its "THU, JUL 2" month-abbrev form (spec §31).
  const statusDate = aestNow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();
  const folioDate = aestNow.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase();

  const totalIssues = days.reduce((n, d) => n + d.entries.length, 0);
  // Folio issue number = cumulative published-issue count, matching the design
  // spec's "№ 521" (the same total the search box shows), not the day count.
  const issueNo = totalIssues;
  const topKws = Object.entries(kwCounts).sort((a, b) => b[1] - a[1]).slice(0, 24);

  const catPillsHTML = CAT_ORDER.filter(k => catCounts[k] > 0).map(k => `
        <button class="ftab" data-cat="${k}"><span class="dot"></span><span>${escapeHtml(CAT_META[k].name)}</span> <span class="n">${catCounts[k]}</span></button>`).join('');

  const months = [...new Set(days.map(d => d.date.slice(0, 7)))]; // already newest-first (days is)
  const monthLabels = { '01':'jan','02':'feb','03':'mar','04':'apr','05':'may','06':'jun','07':'jul','08':'aug','09':'sep','10':'oct','11':'nov','12':'dec' };
  const monthBtnsHTML = months.map(ym => `<button class="mjump" data-month="${ym}">${monthLabels[ym.slice(5)] || ym}</button>`).join('');

  const trendingHTML = topKws.length ? `
<div class="trending" id="trending" hidden>
  <div class="wrap trending-in">
    ${topKws.map(([tag, n]) => `<a href="#" data-kw="${escapeHtml(tag)}"><b>${escapeHtml(tag)}</b><span class="n">${n}</span></a>`).join('')}
  </div>
</div>` : '';

  const todayDay = days[0] && days[0].today ? days[0] : null;
  const fpHTML = frontPageHTML(todayDay);
  const archiveDays = todayDay ? days.slice(1) : days;

  const LAZY_VISIBLE = 8;
  const visibleDays = archiveDays.slice(0, LAZY_VISIBLE);
  const hiddenDays = archiveDays.slice(LAZY_VISIBLE);
  const visibleHTML = visibleDays.map(dayBlockHTML).join('');
  const hiddenHTML = hiddenDays.map(dayBlockHTML).join('');
  // Today's day-block is always present in the DOM (so search/filter can reach it,
  // per the design's "today's entries fold back into the archive" behavior) but
  // stays hidden unless a filter is active.
  const todayBlockHTML = todayDay ? dayBlockHTML(todayDay) : '';

  const olderHTML = hiddenDays.length ? `
      <button class="older" id="older-btn" aria-expanded="false">← load earlier issues · ${hiddenDays[0].date} and earlier · ${totalIssues} total</button>` : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GM Research — Intelligence Archive</title>
<meta property="og:title" content="GM Research — Intelligence Archive">
<meta property="og:description" content="Daily AI-generated intelligence briefings on markets, law, AI, biohacking, trading and more.">
<meta property="og:type" content="website">
<meta property="og:image" content="https://ngmicapital.github.io/GM-Research/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://ngmicapital.github.io/GM-Research/og-image.png">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="alternate" type="application/rss+xml" title="GM Research" href="feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Source+Serif+4:ital,wght@0,400..700;1,400..700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* ===== v2 tokens + chrome (design/extracted/.../gm-v2/styles-base.css) ===== */
:root, [data-theme="dark"] {
  --paper: #0d0c0a; --paper-2: #151310; --ink: #f0ead9; --muted: #98907e;
  --rule: rgba(240,234,217,.13); --rule-strong: rgba(240,234,217,.55);
  --accent: oklch(0.78 0.15 65); --pos: oklch(0.75 0.15 145); --neg: oklch(0.68 0.19 25);
  --c-edge: oklch(0.78 0.16 145); --c-prec: oklch(0.82 0.15 75); --c-cortex: oklch(0.75 0.16 285);
  --c-bio: oklch(0.78 0.13 195); --c-alpha: oklch(0.75 0.17 350); --c-rh: oklch(0.72 0.14 35);
  --c-prx: oklch(0.82 0.14 95); --c-tx: oklch(0.75 0.12 255); --c-rec: oklch(0.78 0.15 0);
}
[data-theme="light"] {
  --paper: #f6f1e7; --paper-2: #eee7d7; --ink: #17150f; --muted: #6b6457;
  --rule: rgba(23,21,15,.14); --rule-strong: rgba(23,21,15,.6);
  --accent: oklch(0.58 0.15 45); --pos: oklch(0.52 0.13 145); --neg: oklch(0.55 0.19 25);
  --c-edge: oklch(0.52 0.14 145); --c-prec: oklch(0.58 0.14 75); --c-cortex: oklch(0.52 0.16 285);
  --c-bio: oklch(0.54 0.12 195); --c-alpha: oklch(0.56 0.17 350); --c-rh: oklch(0.54 0.13 35);
  --c-prx: oklch(0.56 0.13 95); --c-tx: oklch(0.52 0.11 255); --c-rec: oklch(0.56 0.15 0);
}
[data-cat="edge"]{--cat:var(--c-edge)} [data-cat="prec"]{--cat:var(--c-prec)} [data-cat="cortex"]{--cat:var(--c-cortex)}
[data-cat="bio"]{--cat:var(--c-bio)} [data-cat="alpha"]{--cat:var(--c-alpha)} [data-cat="rh"]{--cat:var(--c-rh)}
[data-cat="prx"]{--cat:var(--c-prx)} [data-cat="tx"]{--cat:var(--c-tx)} [data-cat="rec"]{--cat:var(--c-rec)}

*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--paper);color:var(--ink);font-family:"Inter",ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:inherit;text-decoration:none}
.mono{font-family:"IBM Plex Mono",monospace}
.wrap{max-width:1280px;margin:0 auto;padding:0 36px}
@media(max-width:720px){.wrap{padding:0 18px}}

/* Command bar */
.cmdbar{position:sticky;top:0;z-index:60;background:color-mix(in oklab,var(--paper) 88%,transparent);backdrop-filter:blur(12px) saturate(1.3);-webkit-backdrop-filter:blur(12px) saturate(1.3);border-bottom:1px solid var(--rule)}
.cmdbar-in{display:flex;align-items:center;gap:20px;height:50px}
.mob-hamburger{display:none;width:32px;height:32px;border-radius:7px;border:1px solid var(--rule);background:var(--paper-2);cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:4px;flex-shrink:0;padding:0}
.mob-hamburger span{display:block;width:15px;height:1.5px;background:var(--muted);border-radius:1px}
.stk{display:inline-flex;flex-direction:column;line-height:.95;border-left:2px solid var(--accent);padding-left:7px;flex-shrink:0}
.stk .top{font-family:"Fraunces",serif;font-weight:500;font-size:16px;letter-spacing:-.02em}
.stk .bot{font-family:"IBM Plex Mono",monospace;font-size:8px;letter-spacing:.18em;color:var(--muted);margin-top:2px}
.search{display:flex;align-items:center;gap:8px;border:1px solid var(--rule);border-radius:999px;padding:5px 12px;min-width:210px;color:var(--muted);font-family:"IBM Plex Mono",monospace;font-size:11px;background:color-mix(in oklab,var(--paper-2) 60%,transparent);transition:border-color .15s}
.search:focus-within{border-color:var(--rule-strong);color:var(--ink)}
.search input{border:0;background:transparent;outline:none;color:var(--ink);font:inherit;width:100%}
.search input::placeholder{color:var(--muted)}
.cmdnav{display:flex;gap:16px;margin-left:auto;font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--muted)}
.cmdnav a:hover{color:var(--ink)}
.cmdnav a.active{color:var(--ink);border-bottom:1px solid var(--accent);padding-bottom:2px}
.status{display:inline-flex;align-items:center;gap:8px;font-family:"IBM Plex Mono",monospace;font-size:10.5px;color:var(--muted);white-space:nowrap}
.live-dot{width:6px;height:6px;border-radius:50%;background:var(--pos);box-shadow:0 0 0 3px color-mix(in oklab,var(--pos) 22%,transparent);animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:.95}50%{opacity:.35}}
.theme-btn{border:1px solid var(--rule);background:transparent;color:var(--ink);width:30px;height:30px;border-radius:999px;cursor:pointer;font-size:13px;line-height:1;display:inline-flex;align-items:center;justify-content:center}
.theme-btn:hover{border-color:var(--rule-strong)}
/* Below 980px the desktop nav is hidden, so the hamburger must appear at the SAME
   breakpoint — otherwise 769–980px has no navigation at all. Ticker hides at 768px. */
@media(max-width:980px){.cmdnav{display:none}.search{min-width:0;flex:1}.mob-hamburger{display:flex}}
@media(max-width:768px){.ticker{display:none}}

/* Ticker */
.ticker{border-bottom:1px solid var(--rule);font-family:"IBM Plex Mono",monospace;font-size:11.5px;overflow:hidden;white-space:nowrap;background:color-mix(in oklab,var(--paper-2) 55%,var(--paper))}
.ticker-track{display:inline-flex;gap:34px;padding:8px 28px;animation:tickslide 70s linear infinite}
.ticker:hover .ticker-track{animation-play-state:paused}
@keyframes tickslide{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.tk{display:inline-flex;gap:8px;align-items:baseline}
.tk b{font-weight:600}
.tk .val{color:var(--muted)}
.tk .up{color:var(--pos)}
.tk .dn{color:var(--neg)}
@media(prefers-reduced-motion:reduce){.ticker-track{animation:none}.live-dot{animation:none}}

/* Nameplate */
.nameplate{padding:34px 0 0}
.np-row{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
.np-mark{font-family:"Fraunces",serif;font-weight:550;font-size:clamp(40px,5.4vw,62px);line-height:.9;letter-spacing:-.028em;font-variation-settings:"opsz" 144}
.np-mark em{font-style:italic;color:var(--accent);font-variation-settings:"opsz" 144,"SOFT" 60;padding-right:2px}
.np-folio{text-align:right;font-family:"IBM Plex Mono",monospace;font-size:10.5px;line-height:1.9;color:var(--muted);letter-spacing:.1em;text-transform:uppercase}
.np-folio b{color:var(--ink);font-weight:600}
.np-folio .no{color:var(--accent);font-weight:600}
.np-rule{margin-top:18px;border-top:2.5px solid var(--rule-strong);border-bottom:1px solid var(--rule-strong);height:4px}
@media(max-width:720px){.np-folio{display:none}}

/* ===== v2 front page / controls / archive (styles-content.css) ===== */
.fp{padding:26px 0 34px}
.fp-eyebrow{display:flex;justify-content:space-between;align-items:baseline;font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:20px}
.fp-eyebrow b{color:var(--accent);font-weight:600}
.fp-grid{display:grid;grid-template-columns:1.6fr 1fr;gap:0}
@media(max-width:900px){.fp-grid{grid-template-columns:1fr}}
.lead{display:block;padding-right:40px}
.lead-kicker{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--cat,var(--accent));display:flex;align-items:center;gap:10px}
.lead-kicker::after{content:"";flex:1;border-top:1px solid color-mix(in oklab,var(--cat,var(--accent)) 35%,transparent)}
.lead h1{font-family:"Fraunces",serif;font-weight:420;font-size:clamp(30px,3.6vw,50px);line-height:1.02;letter-spacing:-.022em;font-variation-settings:"opsz" 144;margin:14px 0 16px;text-wrap:balance}
.lead:hover h1{text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:6px;text-decoration-color:color-mix(in oklab,var(--cat,var(--accent)) 55%,transparent)}
.lead-dek{font-family:"Source Serif 4",serif;font-size:17.5px;line-height:1.5;color:var(--muted);max-width:54ch;margin:0 0 18px;text-wrap:pretty}
.lead-meta{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.lead-meta .sep{opacity:.5}
.lead-meta .go{color:var(--cat,var(--accent));font-weight:600}
.rail{border-left:1px solid var(--rule);padding-left:32px;display:flex;flex-direction:column}
@media(max-width:900px){.rail{border-left:0;padding-left:0;margin-top:26px;border-top:1px solid var(--rule)}}
.rail-item{display:block;padding:16px 0 18px}
.rail-item+.rail-item{border-top:1px solid var(--rule)}
.rail-item:first-child{padding-top:2px}
.slug{font-family:"IBM Plex Mono",monospace;font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--cat,var(--accent));display:inline-flex;align-items:center;gap:7px}
.slug .min{color:var(--muted);font-weight:400;letter-spacing:.08em}
.rail-item h3{font-family:"Fraunces",serif;font-weight:480;font-size:21px;line-height:1.14;letter-spacing:-.012em;margin:8px 0 7px;text-wrap:balance}
.rail-item:hover h3{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:4px;text-decoration-color:color-mix(in oklab,var(--cat,var(--accent)) 55%,transparent)}
.rail-item p{font-family:"Source Serif 4",serif;font-size:13.5px;line-height:1.45;color:var(--muted);margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.briefs{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--rule);margin-top:10px}
@media(max-width:900px){.briefs{grid-template-columns:1fr}}
.brief{display:block;padding:16px 24px 4px 0}
.brief+.brief{border-left:1px solid var(--rule);padding-left:24px}
@media(max-width:900px){.brief+.brief{border-left:0;padding-left:0;border-top:1px solid var(--rule)}}
.brief h4{font-family:"Inter",sans-serif;font-weight:550;font-size:14px;line-height:1.35;letter-spacing:-.005em;margin:7px 0 0;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.brief:hover h4{color:var(--cat,var(--accent))}

.controls{position:sticky;top:50px;z-index:50;background:color-mix(in oklab,var(--paper) 90%,transparent);backdrop-filter:blur(12px) saturate(1.3);-webkit-backdrop-filter:blur(12px) saturate(1.3);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.controls-in{display:flex;align-items:center;gap:6px;height:44px;overflow-x:auto;scrollbar-width:none}
.controls-in::-webkit-scrollbar{display:none}
.ftab{border:0;background:transparent;cursor:pointer;flex-shrink:0;font-family:"IBM Plex Mono",monospace;font-size:10.5px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:6px 9px;border-radius:4px;display:inline-flex;align-items:center;gap:7px;line-height:1}
.ftab .dot{width:6px;height:6px;border-radius:50%;background:var(--cat,var(--ink));opacity:.85}
.ftab .n{opacity:.55;font-size:9.5px}
.ftab:hover{color:var(--ink);background:color-mix(in oklab,var(--ink) 6%,transparent)}
.ftab.on{color:var(--ink);background:color-mix(in oklab,var(--cat,var(--ink)) 16%,transparent)}
.controls-right{margin-left:auto;display:inline-flex;align-items:center;gap:4px;flex-shrink:0}
.mjump{border:0;background:transparent;cursor:pointer;font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.12em;color:var(--muted);padding:6px 8px;text-transform:uppercase}
.mjump:hover{color:var(--accent)}

.trending{border-bottom:1px solid var(--rule);background:color-mix(in oklab,var(--paper-2) 45%,var(--paper))}
.trending[hidden]{display:none}
.trending-in{display:flex;gap:4px 14px;flex-wrap:wrap;padding:10px 0;font-family:"IBM Plex Mono",monospace;font-size:10.5px;color:var(--muted)}
.trending-in a{letter-spacing:.04em}
.trending-in a b{color:var(--ink);font-weight:500}
.trending-in a .n{color:var(--accent);margin-left:4px}
.trending-in a:hover b{color:var(--accent)}

.archive{padding:6px 0 30px}
.day{position:relative}
.day.f-hide{display:none}
.day-hd{position:sticky;top:94px;z-index:40;display:flex;justify-content:space-between;align-items:baseline;gap:14px;font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:14px 0 9px;background:color-mix(in oklab,var(--paper) 94%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--rule-strong)}
.day-hd b{color:var(--ink);font-weight:600;font-size:12px;letter-spacing:.08em}
.day-hd .today-chip{background:var(--accent);color:var(--paper);padding:2px 6px;border-radius:3px;font-size:9px;font-weight:600;margin-left:8px}
.day-hd .cnt{white-space:nowrap}

.row{display:grid;grid-template-columns:34px 168px 1fr 130px;gap:20px;align-items:center;padding:13px 0;border-bottom:1px dashed var(--rule);cursor:pointer;position:relative}
.row.f-hide{display:none}
.row::before{content:"";position:absolute;left:-14px;top:10px;bottom:10px;width:3px;border-radius:2px;background:var(--cat,var(--accent));opacity:0;transition:opacity .15s}
.row:hover::before{opacity:1}
.row:hover{background:linear-gradient(90deg,color-mix(in oklab,var(--cat,var(--accent)) 7%,transparent),transparent 70%)}
.tile{width:34px;height:34px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;font-size:16px;background:color-mix(in oklab,var(--cat,var(--accent)) 16%,var(--paper));border:1px solid color-mix(in oklab,var(--cat,var(--accent)) 32%,transparent)}
.row-series{font-family:"IBM Plex Mono",monospace;font-size:10.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--cat,var(--accent));white-space:nowrap}
.row-main{min-width:0}
.row-title{font-size:14.5px;font-weight:550;letter-spacing:-.005em;line-height:1.35}
.row:hover .row-title{color:color-mix(in oklab,var(--cat,var(--ink)) 70%,var(--ink))}
.row-sum{font-size:12.5px;line-height:1.45;color:var(--muted);margin-top:3px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.row-right{font-family:"IBM Plex Mono",monospace;font-size:10px;color:var(--muted);text-align:right;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row-right b{font-weight:500;color:color-mix(in oklab,var(--muted) 60%,var(--ink))}
@media(max-width:860px){
  /* Tile spans the left column; series label + title/summary stack in the right
     column. Explicit placement is REQUIRED — a bare "34px 1fr" grid auto-flows the
     3rd child (row-main) back into the 34px column, wrapping the title one word per
     line. */
  .row{grid-template-columns:34px 1fr;gap:3px 12px;align-items:start}
  .tile{grid-row:1 / span 2}
  .row-series{grid-column:2}
  .row-main{grid-column:2;min-width:0}
  .row-right{display:none}
  .day-hd{top:50px}
  .controls{position:static}
}

.older{display:block;width:100%;text-align:center;padding:22px 0;font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);border:1px dashed var(--rule);border-radius:8px;margin-top:26px;background:transparent;cursor:pointer}
.older:hover{color:var(--accent);border-color:color-mix(in oklab,var(--accent) 40%,transparent)}
.older[hidden]{display:none}
.footer{border-top:1px solid var(--rule);margin-top:20px;padding:26px 0 60px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.08em;color:var(--muted);text-transform:uppercase}
.footer a:hover{color:var(--accent)}

.notice{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);padding:12px 0 0}
.notice button{border:0;background:none;color:var(--muted);font:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.notice button:hover{color:var(--ink)}
.no-results{padding:48px 0;text-align:center;color:var(--muted);font-family:"IBM Plex Mono",monospace;font-size:13px}
.no-results[hidden]{display:none}

::selection{background:color-mix(in oklab,var(--accent) 30%,transparent)}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:var(--paper)}
::-webkit-scrollbar-thumb{background:var(--rule);border-radius:3px}

/* Mobile drawer nav (unchanged subsystem — the v2 design hides .cmdnav below
   980px but doesn't specify a mobile replacement, so the existing working
   drawer is kept, restyled to the new tokens) */
.mob-menu-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:150;opacity:0;pointer-events:none;transition:opacity .25s}
.mob-menu{display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;width:280px;background:var(--paper-2);border-right:1px solid var(--rule);z-index:200;transform:translateX(-100%);transition:transform .25s cubic-bezier(.4,0,.2,1)}
@media(min-width:981px){.mob-hamburger,.mob-menu-overlay,.mob-menu{display:none!important}}
.mob-menu-header{display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:52px;border-bottom:1px solid var(--rule);flex-shrink:0}
.mob-menu-logo{font-family:"IBM Plex Mono",monospace;font-size:13px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:8px}
.mob-logo-mark{width:24px;height:24px;border-radius:5px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:var(--paper);flex-shrink:0}
.mob-close{width:32px;height:32px;border-radius:6px;border:1px solid var(--rule);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--muted);line-height:1;padding:0}
.mob-menu-nav{flex:1;padding:16px 0;overflow-y:auto}
.mob-sec-lbl{font-family:"IBM Plex Mono",monospace;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:var(--muted);padding:16px 20px 8px;opacity:.6}
.mob-item{display:flex;align-items:center;gap:14px;padding:14px 20px;color:var(--muted);cursor:pointer;border-left:3px solid transparent;background:none;width:100%;text-align:left;font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.5px;transition:all .15s;text-decoration:none}
.mob-item:hover{background:color-mix(in oklab,var(--ink) 5%,transparent);color:var(--ink)}
.mob-item.active{color:var(--ink);background:color-mix(in oklab,var(--accent) 8%,transparent);border-left-color:var(--accent)}
.mob-ic{width:20px;text-align:center;font-size:14px;flex-shrink:0;opacity:.8}
.mob-divider{height:1px;background:var(--rule);margin:8px 20px}
.mob-menu-footer{padding:16px 20px;border-top:1px solid var(--rule);flex-shrink:0;font-family:"IBM Plex Mono",monospace;font-size:9px;color:var(--muted);line-height:1.6}
.mob-live{display:flex;align-items:center;gap:6px;font-size:9px;color:var(--pos);text-transform:uppercase;letter-spacing:1px;margin-top:8px}
.mob-live-dot{width:5px;height:5px;background:var(--pos);border-radius:50%;animation:pulse 2.5s ease-in-out infinite}

/* Focus-visible a11y outlines (kept from the prior design) */
a:focus-visible,.ftab:focus-visible,.mjump:focus-visible,.older:focus-visible,.theme-btn:focus-visible,.search input:focus-visible,.mob-hamburger:focus-visible,.mob-item:focus-visible,.mob-close:focus-visible,.notice button:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.search:focus-within{outline:none}
</style>
</head>
<body>
<!-- Mobile menu overlay + drawer -->
<div class="mob-menu-overlay" id="mob-overlay" onclick="closeMenu()"></div>
<div class="mob-menu" id="mob-menu">
  <div class="mob-menu-header">
    <div class="mob-menu-logo"><div class="mob-logo-mark">GM</div>GM Research</div>
    <button class="mob-close" onclick="closeMenu()">&times;</button>
  </div>
  <div class="mob-menu-nav">
    <div class="mob-sec-lbl">Navigation</div>
    <a href="index.html" class="mob-item active"><span class="mob-ic">&#x1F3E0;</span>Home</a>
    <a href="visualizations.html" class="mob-item"><span class="mob-ic">&#x1F4CA;</span>Visualizations</a>
    <a href="wyckoff.html" class="mob-item"><span class="mob-ic">&#x1F4C9;</span>Wyckoff</a>
    <a href="corpus.html" class="mob-item"><span class="mob-ic">&#x1F4DA;</span>Corpus</a>
    <a href="content-scout.html" class="mob-item"><span class="mob-ic">&#x1F50E;</span>Scout</a>
    <div class="mob-divider"></div>
    <div class="mob-sec-lbl">Categories</div>
    ${CAT_ORDER.filter(k => catCounts[k] > 0).map(k => `<a href="index.html#cat=${k}" class="mob-item" style="color:var(--c-${k})"><span class="mob-ic">${CAT_META[k].icon}</span>${escapeHtml(CAT_META[k].name)}</a>`).join('\n    ')}
  </div>
  <div class="mob-menu-footer">
    ngmicapital/GM-Research<br>Updated daily &middot; Powered by Claude
    <div class="mob-live"><div class="mob-live-dot"></div>System Live</div>
  </div>
</div>

<!-- Command bar -->
<header class="cmdbar">
  <div class="wrap cmdbar-in">
    <button class="mob-hamburger" onclick="openMenu()" aria-label="Open menu"><span></span><span></span><span></span></button>
    <a class="stk" href="#top" aria-label="GM Research home">
      <span class="top">GM</span>
      <span class="bot">RSRCH</span>
    </a>
    <label class="search">
      <span aria-hidden="true">⌕</span>
      <input type="search" id="q" name="q" autocomplete="off" spellcheck="false" aria-label="Search briefings" placeholder="search ${totalIssues} issues…">
    </label>
    <nav class="cmdnav">
      <a class="active" href="index.html">~/archive</a>
      <a href="visualizations.html">~/visualisations</a>
      <a href="wyckoff.html">~/wyckoff</a>
      <a href="corpus.html">~/corpus</a>
      <a href="content-scout.html">~/scout</a>
    </nav>
    <span class="status">
      <span class="live-dot"></span>
      <span>ONLINE · ${statusDate}</span>
    </span>
    <button class="theme-btn" id="theme-btn" onclick="toggleTheme()" title="Toggle theme"></button>
  </div>
</header>

<!-- Ticker -->
<div class="ticker" id="ticker">
  <div class="ticker-track" id="tk-track">
    <span class="tk" data-tk="btc"><b>BTC</b> <span class="val">—</span> <span class="chg">—</span></span>
    <span class="tk" data-tk="eth"><b>ETH</b> <span class="val">—</span> <span class="chg">—</span></span>
    <span class="tk" data-tk="sol"><b>SOL</b> <span class="val">—</span> <span class="chg">—</span></span>
    <span class="tk" data-tk="spx"><b>SPX</b> <span class="val">—</span> <span class="chg">—</span></span>
    <span class="tk" data-tk="wti"><b>WTI</b> <span class="val">—</span> <span class="chg">—</span></span>
    <span class="tk" data-tk="gold"><b>Gold</b> <span class="val">—</span> <span class="chg">—</span></span>
    <span class="tk" data-tk="vix"><b>VIX</b> <span class="val">—</span> <span class="chg">—</span></span>
    <span class="tk" data-tk="dxy"><b>DXY</b> <span class="val">—</span> <span class="chg">—</span></span>
  </div>
</div>

<!-- Nameplate -->
<section class="nameplate wrap" id="top">
  <div class="np-row">
    <div class="np-mark"><em>GM</em>Research</div>
    <div class="np-folio">
      <div><span class="no">№ ${issueNo}</span> — <b>${folioDate}</b></div>
      <div>Daily intelligence · Updated daily · Powered by Claude</div>
    </div>
  </div>
  <div class="np-rule"></div>
</section>

<!-- Front page (today, shown once; hidden while filtering) -->
<div id="fp-wrap">${fpHTML}</div>

<!-- Controls -->
<div class="controls">
  <div class="wrap controls-in">
    <button class="ftab on" data-cat="all"><span>All</span> <span class="n">${totalIssues}</span></button>
    ${catPillsHTML}
    <span class="controls-right">
      <button class="mjump" id="trend-toggle">trending ▾</button>
      ${monthBtnsHTML}
    </span>
  </div>
</div>

${trendingHTML}

<!-- Archive -->
<main class="archive wrap" id="archive">
  <div class="notice" id="notice" hidden></div>
  ${todayDay ? `<div id="today-block" hidden>${todayBlockHTML}</div>` : ''}
  <div id="visible-days">${visibleHTML}</div>
  <div id="hidden-days"${hiddenDays.length ? ' hidden' : ''}>${hiddenHTML}</div>
  ${olderHTML}
  <p class="no-results" id="no-results" hidden>No issues match your search.</p>
</main>

<!-- Footer -->
<footer class="footer wrap">
  <span>ngmicapital/GM-Research</span>
  <span>Updated daily · Powered by Claude · <a href="feed.xml">RSS</a></span>
</footer>

<script>
// Theme persistence — if unset, initialise from the OS prefers-color-scheme.
(function(){
  var btn=document.getElementById('theme-btn');
  function paint(t){btn.textContent=t==='dark'?'\\u25D0':'\\u2600';}
  var s=localStorage.getItem('gm-theme');
  if(s){document.documentElement.setAttribute('data-theme',s);paint(s);}
  else{
    var prefersLight=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches;
    var t=prefersLight?'light':'dark';
    document.documentElement.setAttribute('data-theme',t);paint(t);
  }
})();
function toggleTheme(){
  var h=document.documentElement,n=h.getAttribute('data-theme')==='light'?'dark':'light';
  h.setAttribute('data-theme',n);localStorage.setItem('gm-theme',n);
  document.getElementById('theme-btn').textContent=n==='dark'?'\\u25D0':'\\u2600';
}
// Mobile menu
function openMenu(){var m=document.getElementById('mob-menu'),o=document.getElementById('mob-overlay');m.style.transform='translateX(0)';o.style.opacity='1';o.style.pointerEvents='auto'}
function closeMenu(){var m=document.getElementById('mob-menu'),o=document.getElementById('mob-overlay');m.style.transform='';o.style.opacity='';o.style.pointerEvents=''}
// Ticker: duplicate track for a seamless loop
(function(){var t=document.getElementById('tk-track');if(t)t.innerHTML+=t.innerHTML;})();
// Live prices via CoinGecko (crypto) + ticker-data branch (equities/macro)
(async function(){
  function fmtN(n){if(n>=10000)return Math.round(n/1000).toLocaleString()+'k';if(n>=1000)return n.toLocaleString('en',{maximumFractionDigits:0});return n.toFixed(2);}
  function fmtP(p){return(p>=0?'+':'')+p.toFixed(2)+'%';}
  function setTk(sel,val,pct){
    document.querySelectorAll(sel+' .val').forEach(function(el){el.textContent=val;});
    document.querySelectorAll(sel+' .chg').forEach(function(el){el.textContent=fmtP(pct);el.className='chg '+(pct>=0?'up':'dn');});
  }
  try{
    var cr=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&precision=2');
    var cd=await cr.json();
    if(cd.bitcoin)setTk('[data-tk="btc"]',fmtN(cd.bitcoin.usd),cd.bitcoin.usd_24h_change);
    if(cd.ethereum)setTk('[data-tk="eth"]',fmtN(cd.ethereum.usd),cd.ethereum.usd_24h_change);
    if(cd.solana)setTk('[data-tk="sol"]',fmtN(cd.solana.usd),cd.solana.usd_24h_change);
  }catch(e){}
  try{
    var TURL='https://raw.githubusercontent.com/ngmicapital/GM-Research/ticker-data/data/ticker.json';
    var yr;
    try{yr=await fetch(TURL,{cache:'no-store'});if(!yr.ok)throw 0;}
    catch(e){yr=await fetch('data/ticker.json',{cache:'no-store'});}
    var yd=await yr.json();
    var qs=yd.quotes||{};
    ['spx','wti','gold','vix','dxy'].forEach(function(k){var q=qs[k];if(!q)return;setTk('[data-tk="'+k+'"]',fmtN(q.price),q.pct||0);});
  }catch(e){}
})();
// Search + single-select category filter + trending toggle + month-jump + lazy reveal
(function(){
  var todayBlock=document.getElementById('today-block');
  var hiddenDays=document.getElementById('hidden-days');
  var olderBtn=document.getElementById('older-btn');
  var fpWrap=document.getElementById('fp-wrap');
  var input=document.getElementById('q');
  var pills=[].slice.call(document.querySelectorAll('.ftab[data-cat]'));
  var validCats={};pills.forEach(function(p){validCats[p.dataset.cat]=true;});  // whitelist for hash parsing
  var allPill=document.querySelector('.ftab[data-cat="all"]');
  var kwLinks=[].slice.call(document.querySelectorAll('.trending-in a'));
  var trendToggle=document.getElementById('trend-toggle');
  var trending=document.getElementById('trending');
  var notice=document.getElementById('notice');
  var noRes=document.getElementById('no-results');
  var archive=document.getElementById('archive');

  var activeCat='all';
  var userExpanded=false;

  function allDayEls(){
    var els=[].slice.call(archive.querySelectorAll('.day'));
    return els;
  }

  function apply(){
    var q=(input&&input.value||'').trim().toLowerCase();
    var filtering=activeCat!=='all'||q.length>0;

    if(fpWrap)fpWrap.style.display=filtering?'none':'';
    if(todayBlock)todayBlock.hidden=!filtering;
    if(hiddenDays)hiddenDays.hidden=!(filtering||userExpanded);
    if(olderBtn)olderBtn.hidden=filtering;

    var hits=0;
    allDayEls().forEach(function(day){
      var rows=[].slice.call(day.querySelectorAll('.row'));
      var dayHits=0;
      rows.forEach(function(row){
        var catOk=activeCat==='all'||row.dataset.cat===activeCat;
        var hay=(row.textContent||'')+' '+(row.dataset.tags||'');
        var qOk=!q||hay.toLowerCase().indexOf(q)!==-1;
        var show=catOk&&qOk;
        row.classList.toggle('f-hide',!show);
        if(show)dayHits++;
      });
      day.classList.toggle('f-hide',dayHits===0);
      hits+=dayHits;
    });

    pills.forEach(function(p){p.classList.toggle('on',p.dataset.cat===activeCat);});

    if(notice){
      if(filtering){
        var bits=[hits+' match'+(hits===1?'':'es')+' in loaded issues'];
        if(activeCat!=='all'){var pl=document.querySelector('.ftab[data-cat="'+activeCat+'"] span:nth-child(2)');if(pl)bits.push(pl.textContent);}
        if(q)bits.push('\\u201C'+input.value+'\\u201D');
        // Build via textContent + a real element — NEVER innerHTML: input.value is
        // attacker-controllable through the #q= URL hash (readHash), so interpolating
        // it into innerHTML is a DOM-XSS on the ngmicapital.github.io origin.
        notice.textContent=bits.join(' \\u00B7 ')+' ';
        var cb=document.createElement('button');
        cb.id='notice-clear';cb.textContent='clear';
        cb.addEventListener('click',function(){activeCat='all';if(input)input.value='';apply();});
        notice.appendChild(cb);
        notice.hidden=false;
      } else {
        notice.hidden=true;
      }
    }
    if(noRes)noRes.hidden=!(filtering&&hits===0);

    writeHash(q);
  }

  function writeHash(q){
    var parts=[];
    if(activeCat!=='all')parts.push('cat='+activeCat);
    if(q)parts.push('q='+encodeURIComponent(q));
    var hash=parts.length?('#'+parts.join('&')):'';
    try{history.replaceState(null,'',location.pathname+location.search+hash);}catch(e){}
  }
  function readHash(){
    var h=(location.hash||'').replace(/^#/,'');
    if(!h)return;
    h.split('&').forEach(function(kv){
      var eq=kv.indexOf('=');
      var k=eq<0?kv:kv.slice(0,eq);
      var v=eq<0?'':kv.slice(eq+1);
      if(k==='cat'&&validCats[v])activeCat=v;  // whitelist, never build a selector from raw hash text (avoids SyntaxError abort)
      else if(k==='q'&&input){try{input.value=decodeURIComponent(v);}catch(e){input.value=v;}}
    });
  }

  pills.forEach(function(p){
    p.addEventListener('click',function(){
      var cat=p.dataset.cat;
      activeCat=(activeCat===cat)?'all':cat;
      apply();
    });
  });
  if(allPill)allPill.addEventListener('click',function(){activeCat='all';apply();});

  kwLinks.forEach(function(a){
    a.addEventListener('click',function(e){
      e.preventDefault();
      if(input)input.value=a.dataset.kw||'';
      apply();
    });
  });

  if(trendToggle&&trending)trendToggle.addEventListener('click',function(){
    var open=!trending.hidden;
    trending.hidden=open;
    trendToggle.textContent='trending '+(open?'\\u25BE':'\\u25B4');
  });

  document.querySelectorAll('.mjump[data-month]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var month=btn.dataset.month;
      userExpanded=true;if(hiddenDays)hiddenDays.hidden=false;if(olderBtn)olderBtn.hidden=true;
      // Scope to the real archive columns — NOT #today-block, which is display:none
      // when not filtering and appears first in DOM order (its .day carries the current
      // month, so an unscoped query would scroll to a hidden element).
      var el=document.querySelector('#visible-days .day[data-month="'+month+'"], #hidden-days .day[data-month="'+month+'"]');
      if(!el)return;
      var top=el.getBoundingClientRect().top+window.scrollY-96;
      window.scrollTo({top:top,behavior:'smooth'});
    });
  });

  if(olderBtn)olderBtn.addEventListener('click',function(){
    userExpanded=true;if(hiddenDays)hiddenDays.hidden=false;olderBtn.hidden=true;
  });

  if(input){
    var t;
    input.addEventListener('input',function(){clearTimeout(t);t=setTimeout(apply,120);});
  }
  document.addEventListener('keydown',function(e){
    var tag=(e.target&&e.target.tagName||'').toLowerCase();
    var typing=tag==='input'||tag==='textarea'||(e.target&&e.target.isContentEditable);
    if(e.key==='/'&&!typing&&input){e.preventDefault();input.focus();}
    else if(e.key==='Escape'&&input&&document.activeElement===input){input.value='';apply();input.blur();}
  });

  readHash();
  apply();
})();
</script>
</body>
</html>`;
}

// ─── RSS 2.0 feed ─────────────────────────────────────────────────────────────
// Newest-first, most recent ~50 items across briefings + transcripts. Absolute
// links into the GitHub Pages site; pubDate anchored at noon UTC per the day.
function buildFeedXml(briefingEntries, transcriptsByDate) {
  const items = [];

  briefingEntries.forEach(e => {
    e.briefings.forEach(key => {
      const m = BRIEFING_META[key];
      const fp = path.join(BRIEFINGS_DIR, e.date, m.filename);
      const { headline, preview } = extractBriefingMeta(fp, key);
      const link = `${SITE_URL}briefings/${e.date}/${m.filename}`;
      items.push({
        date: e.date,
        title: `${m.typeLabel}: ${headline || m.preview}`,
        link,
        category: m.typeLabel,
        description: preview || m.preview,
      });
    });
  });

  Object.entries(transcriptsByDate).forEach(([date, ts]) => {
    ts.forEach(t => {
      const link = `${SITE_URL}transcripts/${t.slug}/index.html`;
      items.push({
        date,
        title: `Transcript: ${t.title}`,
        link,
        category: 'Transcript',
        description: t.source || t.title || '',
      });
    });
  });

  // Newest-first; cap at 50.
  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const top = items.slice(0, 50);

  // Deterministic: stamp the feed with the newest item's date so feed.xml only
  // changes when content changes — not on every rebuild (avoids spurious diffs).
  const lastBuild = top.length ? rfc822(top[0].date) : rfc822('1970-01-01');
  const itemsXml = top.map(it => `    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${escapeXml(it.link)}</link>
      <guid isPermaLink="true">${escapeXml(it.link)}</guid>
      <pubDate>${rfc822(it.date)}</pubDate>
      <category>${escapeXml(it.category)}</category>
      <description>${escapeXml(it.description)}</description>
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>GM Research</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>Daily intelligence briefings on markets, law, AI, biohacking, trading and more.</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${escapeXml(SITE_URL)}feed.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>
`;
}

// --- sitemap.xml --------------------------------------------------------------
// Deterministic — lastmod comes from content dates, never the wall clock.
function buildSitemapXml(briefingEntries, transcriptsByDate) {
  const urls = [];
  const newest = briefingEntries.length ? briefingEntries[0].date : '2026-01-01';
  urls.push({ loc: SITE_URL, lastmod: newest, priority: '1.0' });
  urls.push({ loc: `${SITE_URL}visualizations.html`, lastmod: newest, priority: '0.7' });
  // Standalone pages — updated out-of-band, so lastmod uses the newest content date.
  for (const page of ['wyckoff.html', 'corpus.html', 'content-scout.html', 'recipes/ultimate-chewy-brownies/index.html']) {
    urls.push({ loc: `${SITE_URL}${page}`, lastmod: newest, priority: '0.5' });
  }
  briefingEntries.forEach(e => {
    e.briefings.forEach(key => {
      urls.push({ loc: `${SITE_URL}briefings/${e.date}/${BRIEFING_META[key].filename}`, lastmod: e.date, priority: '0.8' });
    });
  });
  Object.entries(transcriptsByDate).forEach(([date, ts]) => {
    ts.forEach(t => urls.push({ loc: `${SITE_URL}transcripts/${t.slug}/index.html`, lastmod: date, priority: '0.6' }));
  });
  const body = urls.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  return { xml, count: urls.length };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let briefingEntries = [];
if (fs.existsSync(BRIEFINGS_DIR)) {
  briefingEntries = fs.readdirSync(BRIEFINGS_DIR)
    .filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort().reverse()
    .map(date => {
      const files = fs.readdirSync(path.join(BRIEFINGS_DIR, date)).filter(f => f.endsWith('.html'));
      return { date, briefings: ORDER.filter(k => files.includes(BRIEFING_META[k].filename)) };
    });
}

let transcriptsByDate = {};
if (fs.existsSync(MANIFEST_FILE)) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  manifest.forEach(t => {
    const d = t.date || '2026-01-01';
    if (!transcriptsByDate[d]) transcriptsByDate[d] = [];
    transcriptsByDate[d].push(t);
  });
}

fs.writeFileSync(OUTPUT_FILE, buildHTML(briefingEntries, transcriptsByDate));
const bCount = briefingEntries.reduce((n,e) => n + e.briefings.length, 0);
const tCount = Object.values(transcriptsByDate).reduce((n,a) => n + a.length, 0);
console.log(`index.html written — ${briefingEntries.length} date(s), ${bCount} briefing(s), ${tCount} transcript(s)`);

fs.writeFileSync(FEED_FILE, buildFeedXml(briefingEntries, transcriptsByDate));
console.log(`feed.xml written — ${Math.min(50, bCount + tCount)} item(s)`);

const sitemap = buildSitemapXml(briefingEntries, transcriptsByDate);
fs.writeFileSync(SITEMAP_FILE, sitemap.xml);
console.log(`sitemap.xml written — ${sitemap.count} url(s)`);

// ─── Post-build UI validator ──────────────────────────────────────────────────
// Checks every card extraction for common issues and warns loudly.
const SUSPICIOUS = ['Released ', 'Architecture:', 'See also', '§', 'http', 'undefined', 'null'];
let issues = 0;
briefingEntries.slice(0, 3).forEach(e => {  // only check latest 3 dates
  e.briefings.forEach(key => {
    const m = BRIEFING_META[key];
    const filePath = path.join(BRIEFINGS_DIR, e.date, m.filename);
    const { headline, preview, tags } = extractBriefingMeta(filePath, key);
    const warn = (msg) => { console.warn(`  ⚠️  [${e.date}/${key}] ${msg}`); issues++; };
    if (!headline)                                    warn('EMPTY headline — falling back to default');
    if (headline.length < 15)                         warn(`SHORT headline (${headline.length} chars): "${headline}"`);
    if (!preview)                                     warn('EMPTY preview — card will show no description text');
    if (preview.length > 190)                         warn(`LONG preview (${preview.length} chars) — may overflow card`);
    if (/&[a-zA-Z]+;/.test(headline))                warn(`RAW HTML ENTITY in headline: "${headline}"`);
    if (/&[a-zA-Z]+;/.test(preview))                 warn(`RAW HTML ENTITY in preview: "${preview}"`);
    tags.forEach(t => { if (/&[a-zA-Z]+;/.test(t)) warn(`RAW HTML ENTITY in tag: "${t}"`); });
    SUSPICIOUS.forEach(s => { if (headline.includes(s)) warn(`SUSPICIOUS headline contains "${s}": "${headline}"`); });
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const tok = [...new Set(raw.match(/\{\{[A-Za-z0-9_]+\}\}/g) || [])];
      if (tok.length) warn(`LEAKED template token(s): ${tok.join(', ')} — fill or strip before publishing`);
      if (/<!--\s*TEMPLATE for/i.test(raw)) warn('LEAKED template instruction comment — strip the "<!-- TEMPLATE for ... -->" line from the published HTML');
    } catch (e) { /* file read errors surface via extractBriefingMeta */ }
  });
});
if (issues === 0) {
  console.log('✓  UI validator: all card extractions look clean');
} else {
  console.warn(`\n  ${issues} extraction issue(s) found above — check briefing HTML structure (warnings only, continuing)\n`);
  // Warnings are non-fatal: always exit 0 so the deploy pipeline is never blocked.
  // process.exit(1) is reserved for hard errors (e.g. unreadable briefings directory).
}

// --- Output-integrity check (FATAL) ------------------------------------------
// Unlike the extraction warnings above (content quality, non-fatal), these catch
// BROKEN generated markup — a generator/template bug that must never publish.
{
  const out = fs.readFileSync(OUTPUT_FILE, 'utf8');
  const integrity = [];
  const bs = out.match(/<\\[a-zA-Z/]/g);
  if (bs) integrity.push(`backslash-close tag artifact x${bs.length} (e.g. "${bs[0]}") — check template literals`);
  for (const tag of ['b', 'small']) {
    const open  = (out.match(new RegExp(`<${tag}>`, 'g'))  || []).length;
    const close = (out.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (open !== close) integrity.push(`unbalanced <${tag}> tags: ${open} open vs ${close} close`);
  }
  if (integrity.length) {
    console.error('\n  ✗  OUTPUT INTEGRITY FAILED:');
    integrity.forEach(m => console.error(`     - ${m}`));
    console.error('  Refusing to continue — generated index.html contains broken markup.\n');
    process.exit(1);
  }
  console.log('✓  Output integrity: inline markup balanced, no tag artifacts');
}

// `--strict` (used by briefing-authoring pre-publish checks) also makes the
// extraction warnings above fatal. CI runs WITHOUT --strict, so pre-existing
// content warnings never block unrelated code changes.
// Blocking content defects (FATAL, always): leaked template tokens/comments or raw
// HTML entities in card text publish visibly-broken output, so they block regardless
// of --strict (the soft warnings above stay non-fatal). Checks the latest 3 dates.
{
  const blocking = [];
  briefingEntries.slice(0, 3).forEach(e => e.briefings.forEach(key => {
    const fp = path.join(BRIEFINGS_DIR, e.date, BRIEFING_META[key].filename);
    let raw; try { raw = fs.readFileSync(fp, 'utf8'); } catch (err) { return; }
    const meta = extractBriefingMeta(fp, key);
    const tok = [...new Set(raw.match(/\{\{[A-Za-z0-9_]+\}\}/g) || [])];
    if (tok.length) blocking.push(`${e.date}/${key}: leaked template token(s) ${tok.join(', ')}`);
    if (/<!--\s*TEMPLATE for/i.test(raw)) blocking.push(`${e.date}/${key}: leaked "<!-- TEMPLATE for ... -->" comment`);
    if (/&[a-zA-Z]+;/.test(meta.headline)) blocking.push(`${e.date}/${key}: raw HTML entity in headline "${meta.headline}"`);
    if (/&[a-zA-Z]+;/.test(meta.preview)) blocking.push(`${e.date}/${key}: raw HTML entity in preview`);
    meta.tags.forEach(t => { if (/&[a-zA-Z]+;/.test(t)) blocking.push(`${e.date}/${key}: raw HTML entity in tag "${t}"`); });
  }));
  if (blocking.length) {
    console.error('\n  X  BLOCKING content defect(s) - these publish visibly-broken output:');
    blocking.forEach(b => console.error('     - ' + b));
    console.error('  Refusing to continue. Fix the briefing(s) above.\n');
    process.exit(1);
  }
}

if (issues > 0 && process.argv.includes('--strict')) {
  console.error(`\n  ✗  --strict: ${issues} extraction issue(s) above are fatal. Fix the briefing HTML.\n`);
  process.exit(1);
}
