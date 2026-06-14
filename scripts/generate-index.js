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

// ─── Card HTML generators ────────────────────────────────────────────────────

const RECIPE_DATE = '2026-04-03';

function briefingCard(date, key) {
  const m = BRIEFING_META[key];
  const filePath = path.join(BRIEFINGS_DIR, date, m.filename);
  const { headline, preview, tags, minutes } = extractBriefingMeta(filePath, key);
  const title = headline || m.preview;
  const tagsHTML = tags.slice(0,2).map(t => `<span>${escapeHtml(t)}</span>`).join('');
  const tagsAttr = tags.join(',').toLowerCase();
  const rtHTML = `<span class="t-rt">${minutes} min</span>`;
  return `
    <a href="briefings/${date}/${m.filename}" class="tline" data-cat="${m.cat}" data-tags="${escapeHtml(tagsAttr)}">
      <div class="t-bar"></div>
      <div class="t-ic">${m.icon}</div>
      <div class="t-name">${m.typeLabel}</div>
      <div class="t-ttl">${escapeHtml(title)}${rtHTML}${preview ? `<small>${escapeHtml(preview)}</small>` : ''}</div>
      <div class="t-tags">${tagsHTML}</div>
    </a>`;
}

function transcriptCard(t) {
  const dt = (t.domain||'').split(/\s*[\/&]\s*/).map(s=>s.trim()).filter(s=>s.length>1&&s.length<=22).slice(0,2);
  const tagsHTML = dt.map(d=>`<span>${escapeHtml(d)}</span>`).join('');
  return `
    <a href="transcripts/${t.slug}/index.html" class="tline" data-cat="tx">
      <div class="t-bar"></div>
      <div class="t-ic">&#x1F3A5;</div>
      <div class="t-name">Transcript</div>
      <div class="t-ttl">${escapeHtml(t.title)}${t.source ? `<small>${escapeHtml(t.source)}</small>` : ''}</div>
      <div class="t-tags">${tagsHTML}</div>
    </a>`;
}

const RECIPE_ROW = `
    <a href="recipes/ultimate-chewy-brownies/index.html" class="tline" data-cat="rec">
      <div class="t-bar"></div>
      <div class="t-ic">&#x1F36B;</div>
      <div class="t-name">Recipe</div>
      <div class="t-ttl">The Ultimate Chewy Brownie<small>Brown butter + oil, dual sugars, 2+2 egg ratio. Science-backed.</small></div>
      <div class="t-tags"><span>Baking</span><span>Brownies</span></div>
    </a>`;

function dateGroupHTML(date, briefings, transcripts, isToday) {
  const d = new Date(`${date}T12:00:00Z`);
  const dow = d.toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'}).toUpperCase();
  const total = briefings.length + transcripts.length + (date === RECIPE_DATE ? 1 : 0);
  return `
  <section class="tsec${isToday ? ' tsec-today' : ''}">
    <div class="tsec-hdr">
      <span><b>${date}</b> &middot; ${dow}${isToday ? ' <span class="today-tag">TODAY</span>' : ''}</span>
      <span>${total} ENTR${total === 1 ? 'Y' : 'IES'}</span>
    </div>
    ${briefings.map(k => briefingCard(date, k)).join('')}
    ${transcripts.map(t => transcriptCard(t)).join('')}
    ${date === RECIPE_DATE ? RECIPE_ROW : ''}
  </section>`;
}

function leadStoryHTML(today, briefingEntries) {
  const todayEntry = briefingEntries.find(e => e.date === today);
  if (!todayEntry || !todayEntry.briefings.length) return '';
  const leadKey = todayEntry.briefings[0];
  const m = BRIEFING_META[leadKey];
  const fp = path.join(BRIEFINGS_DIR, today, m.filename);
  const { headline, preview, tags, minutes } = extractBriefingMeta(fp, leadKey);
  if (!headline) return '';

  const alsoKeys = todayEntry.briefings.slice(1, 5);
  const alsoHTML = alsoKeys.map(key => {
    const am = BRIEFING_META[key];
    const af = path.join(BRIEFINGS_DIR, today, am.filename);
    const ae = extractBriefingMeta(af, key);
    const hook = ae.headline || am.preview;
    return `
        <a href="briefings/${today}/${am.filename}" class="asi" data-cat="${am.cat}">
          <span class="asi-ic">${am.icon}</span>
          <span class="asi-txt"><b>${am.typeLabel}</b>${escapeHtml(hook)}</span>
        </a>`;
  }).join('');

  const tagStr = tags.slice(0,3).join(' &middot; ');
  const metaBits = [];
  if (tagStr) metaBits.push(tagStr);
  metaBits.push(`${minutes} min read`);

  return `
  <section class="lead-story" data-cat="${m.cat}">
    <a href="briefings/${today}/${m.filename}" class="ls-left">
      <div class="ls-eyebrow">// TODAY&rsquo;S LEAD &mdash; ${m.typeLabel.toUpperCase()}</div>
      <h1 class="ls-hl">${escapeHtml(headline)}</h1>
      <p class="ls-body">${escapeHtml(preview)}</p>
      <div class="ls-meta">${metaBits.join(' &middot; ')}</div>
    </a>
    <aside class="ls-right">
      <div class="ls-ah">// ALSO TODAY</div>
      ${alsoHTML}
    </aside>
  </section>`;
}

// ─── Stats collector ─────────────────────────────────────────────────────────

function collectStats(briefingEntries, transcriptsByDate) {
  const kwCounts = {};
  const catCounts = { market:0, legal:0, ai:0, bio:0, rh:0, prx:0, trade:0, tx:0, rec:0 };
  briefingEntries.forEach(e => {
    e.briefings.forEach(key => {
      const m = BRIEFING_META[key];
      catCounts[m.cat]++;
      const fp = path.join(BRIEFINGS_DIR, e.date, m.filename);
      const { tags } = extractBriefingMeta(fp, key);
      tags.forEach(t => { kwCounts[t] = (kwCounts[t] || 0) + 1; });
    });
  });
  Object.values(transcriptsByDate).forEach(ts => { catCounts.tx += ts.length; });
  catCounts.rec = 1; // hardcoded recipe row
  return { kwCounts, catCounts };
}

// ─── Build full HTML ─────────────────────────────────────────────────────────

function buildHTML(briefingEntries, transcriptsByDate) {
  const allDates = [...new Set([...briefingEntries.map(e=>e.date), ...Object.keys(transcriptsByDate)])].sort().reverse();
  const { date: aestNow, iso: today } = todayAEST();
  const todayDisplay = aestNow.toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).toUpperCase();

  const briefingMap = {};
  briefingEntries.forEach(e => { briefingMap[e.date] = e.briefings; });

  // Stats for keywords bar + filter chips
  const { kwCounts, catCounts } = collectStats(briefingEntries, transcriptsByDate);
  const topKws = Object.entries(kwCounts).sort((a,b) => b[1]-a[1]).slice(0,24);
  const kwBarHTML = topKws.length ? `
<div class="kw-bar">
  <span class="kw-label">TRENDING</span>
  ${topKws.map(([kw,cnt]) => `<a class="kw-pill" href="#" data-kw="${escapeHtml(kw)}">${escapeHtml(kw)} <span>${cnt}</span></a>`).join('')}
</div>` : '';

  const totalEntries = Object.values(catCounts).reduce((a,b)=>a+b,0);
  const filterCats = [
    {key:'all',    label:'All',        count: totalEntries,       cat: null},
    {key:'market', label:'Market',     count: catCounts.market,   cat: 'market'},
    {key:'legal',  label:'Legal',      count: catCounts.legal,    cat: 'legal'},
    {key:'ai',     label:'AI',         count: catCounts.ai,       cat: 'ai'},
    {key:'bio',    label:'Biohacker',  count: catCounts.bio,      cat: 'bio'},
    {key:'rh',     label:'Rabbit Hole',count: catCounts.rh,       cat: 'rh'},
    {key:'prx',    label:'Praxis',     count: catCounts.prx,      cat: 'prx'},
    {key:'trade',  label:'Alpha',      count: catCounts.trade,    cat: 'trade'},
    {key:'tx',     label:'Transcripts',count: catCounts.tx,       cat: 'tx'},
    {key:'rec',    label:'Recipes',    count: catCounts.rec,      cat: 'rec'},
  ].filter(c => c.key === 'all' || c.count > 0);
  const filterBarHTML = `
<div class="filter-bar">
  ${filterCats.map((c,i) => `<button class="f-chip${i===0?' active':''}" data-filter="${c.key}"${c.cat?` data-cat="${c.cat}"`:''}>${c.label} <span>${c.count}</span></button>`).join('')}
  <button class="f-clear" id="f-clear" hidden aria-label="Clear all active filters">&times; clear <span id="f-clear-n"></span></button>
  <span class="f-count" id="f-count" role="status" aria-live="polite"></span>
</div>`;

  const heroHTML = leadStoryHTML(today, briefingEntries);

  // Count of searchable issues (briefings + transcripts), used in the search
  // placeholder. The recipe row is excluded — it is a one-off, not an "issue".
  const issueCount = briefingEntries.reduce((n,e) => n + e.briefings.length, 0)
                   + Object.values(transcriptsByDate).reduce((n,a) => n + a.length, 0);

  // ── Lazy feed display ──────────────────────────────────────────────────────
  // Every date-section is server-rendered (works with JS off). The first
  // LAZY_VISIBLE dates show immediately; the remainder are wrapped in a
  // .tsec-collapsed container revealed by the "Load earlier issues" button
  // (and auto-revealed by search/filter so they cover the whole archive).
  const LAZY_VISIBLE = 8;
  const visibleDates = allDates.slice(0, LAZY_VISIBLE);
  const hiddenDates  = allDates.slice(LAZY_VISIBLE);
  const sectionFor = date =>
    dateGroupHTML(date, briefingMap[date]||[], transcriptsByDate[date]||[], date===today);
  const visibleFeed = visibleDates.map(sectionFor).join('');
  const hiddenFeed  = hiddenDates.map(sectionFor).join('');
  const loadMoreHTML = hiddenDates.length ? `
  <div class="load-more-wrap" id="load-more-wrap">
    <button class="load-more" id="load-more" aria-expanded="false">Load earlier issues &darr; &middot; ${allDates.length} total</button>
  </div>` : '';
  const feedHTML = visibleFeed
    + (hiddenDates.length ? `<div class="tsec-collapsed" id="tsec-rest">${hiddenFeed}</div>` : '');

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GM Research — Intelligence Archive</title>
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="alternate" type="application/rss+xml" title="GM Research" href="feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--paper);color:var(--ink);font-family:'Inter',-apple-system,sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}

:root{
  --ink:#f2ede0;
  --paper:#080808;
  --paper-2:#111110;
  --rule:rgba(242,237,224,0.12);
  --muted:#8f887a;
  --accent:#f59e0b;
  --pos:#22c55e;
  --neg:#ef4444;
  --c-market:#22c55e;
  --c-legal:#60a5fa;
  --c-ai:#a78bfa;
  --c-bio:#2dd4bf;
  --c-rh:#eab308;
  --c-prx:#DC3545;
  --c-trade:#a3e635;
  --c-tx:#f97316;
  --c-rec:#92400e;
  --hl-font:'Fraunces',serif;
}
[data-theme="light"]{
  --ink:#17150f;
  --paper:#f6f1e7;
  --paper-2:#efe8d8;
  --rule:rgba(23,21,15,0.1);
  --muted:#6b6457;
  --accent:#d97706;
  --pos:#16a34a;
  --neg:#dc2626;
}
[data-cat="market"]{--cat:var(--c-market)}
[data-cat="legal"]{--cat:var(--c-legal)}
[data-cat="ai"]{--cat:var(--c-ai)}
[data-cat="bio"]{--cat:var(--c-bio)}
[data-cat="rh"]{--cat:var(--c-rh)}
[data-cat="prx"]{--cat:var(--c-prx)}
[data-cat="trade"]{--cat:var(--c-trade)}
[data-cat="tx"]{--cat:var(--c-tx)}
[data-cat="rec"]{--cat:var(--c-rec)}

/* Topbar */
.topbar{position:sticky;top:0;z-index:100;background:color-mix(in oklab,var(--paper) 92%,transparent);backdrop-filter:blur(10px) saturate(1.4);-webkit-backdrop-filter:blur(10px) saturate(1.4);border-bottom:1px solid var(--rule)}
.topbar-inner{display:flex;align-items:center;gap:20px;height:56px;padding:0 40px}
/* Logo stacked */
.logo{display:inline-flex;align-items:center;gap:10px;color:var(--ink);flex-shrink:0}
.logo-stk{display:inline-flex;flex-direction:column;line-height:0.95;border-left:2px solid var(--accent);padding-left:7px}
.logo-stk .top{font-family:'Fraunces','JetBrains Mono',serif;font-weight:500;font-size:18px;letter-spacing:-0.03em}
.logo-stk .bot{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:0.15em;color:var(--muted);margin-top:2px;text-transform:uppercase}
.logo-wm{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted);text-transform:lowercase;letter-spacing:0.02em}
/* Nav */
.topbar-nav{display:flex;gap:22px;margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted)}
.topbar-nav a{transition:color .15s}
.topbar-nav a:hover{color:var(--ink)}
.topbar-nav .active{color:var(--ink);font-weight:500;border-bottom:1px solid var(--accent);padding-bottom:2px}
/* Meta / ONLINE indicator */
.topbar-meta{display:flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);flex-shrink:0;white-space:nowrap}
.live-dot{width:6px;height:6px;border-radius:50%;background:var(--pos);box-shadow:0 0 0 3px color-mix(in oklab,var(--pos) 25%,transparent);animation:pulse 2s infinite;display:inline-block}
@keyframes pulse{0%,100%{opacity:.9}50%{opacity:.4}}
/* Theme toggle */
.theme-btn{border:1px solid var(--rule);background:transparent;color:var(--muted);padding:5px 10px;border-radius:999px;font-family:'JetBrains Mono',monospace;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .15s}
.theme-btn:hover{color:var(--ink);border-color:var(--muted)}
.icon-light{display:none}
.icon-dark{display:inline}
[data-theme="light"] .icon-light{display:inline}
[data-theme="light"] .icon-dark{display:none}
/* Mobile hamburger */
.mob-hamburger{display:none;width:36px;height:36px;border-radius:7px;border:1px solid var(--rule);background:var(--paper-2);cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:4px;flex-shrink:0;padding:0}
.mob-hamburger span{display:block;width:16px;height:1.5px;background:var(--muted);border-radius:1px}

/* Ticker */
.ticker{border-bottom:1px solid var(--rule);overflow:hidden;white-space:nowrap}
.ticker-track{display:inline-flex;gap:32px;padding:10px 28px;white-space:nowrap}
.ticker-track.animated{animation:tkroll 60s linear infinite}
.ticker-track.animated:hover{animation-play-state:paused}
@keyframes tkroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.tk{display:inline-flex;gap:7px;align-items:baseline;font-family:'JetBrains Mono',monospace;font-size:12px}
.tk b{font-weight:600;color:var(--ink)}
.tkv{color:var(--muted);display:inline-block;min-width:46px;text-align:right}
.tkd{color:var(--muted);display:inline-block;min-width:54px;text-align:right}
.tkd.up{color:var(--pos)}
.tkd.dn{color:var(--neg)}

/* Section header */
.section-hdr{padding:28px 40px 22px;border-bottom:1px solid var(--rule)}
.section-eyebrow{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:0.14em;display:block;margin-bottom:8px}
.section-title{font-family:'Fraunces',serif;font-size:clamp(28px,4vw,52px);font-weight:700;letter-spacing:-0.02em;color:var(--ink);line-height:1}
.section-title em{font-style:italic;color:var(--accent)}

/* Keywords / Trending bar */
.kw-bar{padding:10px 40px;border-bottom:1px solid var(--rule);display:flex;align-items:center;gap:10px;overflow-x:auto;scrollbar-width:none}
.kw-bar::-webkit-scrollbar{display:none}
.kw-label{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.14em;color:var(--muted);flex-shrink:0;opacity:.7}
.kw-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;border:1px solid var(--rule);font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted);cursor:pointer;white-space:nowrap;text-decoration:none;transition:all .15s;background:transparent;flex-shrink:0}
.kw-pill:hover,.kw-pill.active{color:var(--ink);border-color:var(--muted);background:color-mix(in oklab,var(--ink) 8%,transparent)}
.kw-pill span{opacity:.55;font-size:9px}

/* Filter chips */
.filter-bar{padding:10px 40px;border-bottom:1px solid var(--rule);display:flex;align-items:center;gap:7px;overflow-x:auto;scrollbar-width:none}
.filter-bar::-webkit-scrollbar{display:none}
.f-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:999px;border:1px solid color-mix(in oklab,var(--cat,var(--rule)) 35%,var(--rule));font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--cat,var(--muted));cursor:pointer;background:transparent;white-space:nowrap;transition:all .15s;flex-shrink:0}
.f-chip:hover{border-color:var(--cat,var(--muted));background:color-mix(in oklab,var(--cat,var(--ink)) 10%,transparent)}
.f-chip.active{background:color-mix(in oklab,var(--cat,var(--ink)) 22%,var(--paper-2));border-color:var(--cat,var(--ink));color:var(--cat,var(--ink));font-weight:600}
.f-chip span{opacity:.55;font-size:9px}
.f-hide{display:none!important}

/* Lead Story Hero */
.lead-story{display:grid;grid-template-columns:1.7fr 1fr;gap:32px;padding:32px 40px;border-bottom:1px solid var(--rule);border-left:4px solid var(--cat,var(--accent));background:linear-gradient(90deg,color-mix(in oklab,var(--cat,var(--accent)) 6%,var(--paper)),var(--paper))}
@media(max-width:800px){.lead-story{grid-template-columns:1fr}}
.ls-left{display:flex;flex-direction:column;gap:10px}
.ls-eyebrow{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--cat,var(--accent));text-transform:uppercase;letter-spacing:0.14em}
.ls-hl{font-family:var(--hl-font);font-weight:400;font-size:clamp(28px,3.5vw,50px);line-height:1.05;letter-spacing:-0.02em;color:var(--ink)}
.ls-body{font-family:'Inter',sans-serif;font-size:15px;line-height:1.5;color:var(--muted);max-width:62ch}
.ls-body b{color:var(--ink)}
.ls-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em}
.ls-right{border-left:1px dashed var(--rule);padding-left:24px;display:flex;flex-direction:column;gap:8px}
.ls-ah{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.14em;margin-bottom:6px}
.asi{display:flex;gap:10px;padding:8px 0;border-top:1px dotted var(--rule);align-items:flex-start;transition:opacity .15s}
.asi:first-of-type{border-top:0}
.asi:hover{opacity:.8}
.asi-ic{font-size:15px;flex-shrink:0;margin-top:1px}
.asi-txt{font-size:12px;line-height:1.4;color:var(--muted)}
.asi-txt b{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--cat,var(--accent));display:block;margin-bottom:2px}

/* Feed */
.feed{padding:0}
.tsec{border-top:1px solid color-mix(in oklab,var(--ink) 18%,transparent);border-bottom:1px solid var(--rule)}
.tsec:first-child{border-top:none}
.tsec-hdr{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.12em;padding:14px 40px 10px;border-bottom:1px solid var(--rule);background:color-mix(in oklab,var(--ink) 5%,transparent);display:flex;justify-content:space-between;align-items:center}
.tsec-hdr b{color:var(--ink);font-size:13px;letter-spacing:0;text-transform:none;font-weight:600}
.today-tag{font-size:9px;background:var(--accent);color:#000;padding:2px 8px;border-radius:2px;letter-spacing:0.1em;text-transform:uppercase;margin-left:8px;font-weight:700;vertical-align:middle}
/* Today's section stands out (recency = importance) — flat amber accent, no shadow */
.tsec-today{border-left:3px solid var(--accent);background:color-mix(in oklab,var(--accent) 4%,transparent)}
.tsec-today .tsec-hdr{background:color-mix(in oklab,var(--accent) 9%,transparent)}
.tline{display:grid;grid-template-columns:4px 36px 140px 1fr 120px;gap:14px;padding:10px 40px;border-bottom:1px dashed var(--rule);cursor:pointer;align-items:center;text-decoration:none;color:inherit;transition:background .15s}
.tline:hover{background:color-mix(in oklab,var(--cat,var(--accent)) 8%,transparent)}
.t-bar{align-self:stretch;background:var(--cat,var(--accent));border-radius:2px}
.t-ic{width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;background:color-mix(in oklab,var(--cat,var(--accent)) 15%,var(--paper));border:1px solid color-mix(in oklab,var(--cat,var(--accent)) 30%,var(--rule));border-radius:6px;flex-shrink:0}
.t-name{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;color:var(--cat,var(--accent));text-transform:uppercase;letter-spacing:0.12em;white-space:nowrap}
.t-ttl{font-family:'Inter',sans-serif;font-size:14px;font-weight:500;color:var(--ink);min-width:0;overflow:hidden}
.t-ttl small{font-weight:400;color:var(--muted);display:block;margin-top:2px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.t-tags{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted);text-align:right;display:flex;flex-direction:column;gap:2px;align-items:flex-end}
.t-tags span{white-space:nowrap}

/* Footer */
.footer{padding:32px 40px;border-top:1px solid var(--rule)}
.footer-inner{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted);display:flex;align-items:center;gap:12px}
.footer-inner a{transition:color .15s}.footer-inner a:hover{color:var(--ink)}
.footer-dot{width:3px;height:3px;border-radius:50%;background:var(--muted);display:inline-block}

/* Scrollbar */
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:var(--paper)}
::-webkit-scrollbar-thumb{background:var(--rule);border-radius:3px}

/* Mobile menu */
.mob-menu-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:150;opacity:0;pointer-events:none;transition:opacity .25s}
.mob-menu{display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;width:280px;background:var(--paper-2);border-right:1px solid var(--rule);z-index:200;transform:translateX(-100%);transition:transform .25s cubic-bezier(.4,0,.2,1);box-shadow:10px 0 40px rgba(0,0,0,.4)}
@media(min-width:769px){.mob-hamburger,.mob-menu-overlay,.mob-menu{display:none!important}}
.mob-menu-header{display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:52px;border-bottom:1px solid var(--rule);flex-shrink:0}
.mob-menu-logo{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:8px}
.mob-logo-mark{width:24px;height:24px;border-radius:5px;background:linear-gradient(135deg,var(--accent),#d97706);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#000;flex-shrink:0}
.mob-close{width:32px;height:32px;border-radius:6px;border:1px solid var(--rule);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--muted);line-height:1;padding:0}
.mob-menu-nav{flex:1;padding:16px 0;overflow-y:auto}
.mob-sec-lbl{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:var(--muted);padding:16px 20px 8px;opacity:.6}
.mob-item{display:flex;align-items:center;gap:14px;padding:14px 20px;color:var(--muted);cursor:pointer;border-left:3px solid transparent;background:none;width:100%;text-align:left;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.5px;transition:all .15s;text-decoration:none}
.mob-item:hover{background:color-mix(in oklab,var(--ink) 5%,transparent);color:var(--ink)}
.mob-item.active{color:var(--ink);background:color-mix(in oklab,var(--accent) 8%,transparent);border-left-color:var(--accent)}
.mob-ic{width:20px;text-align:center;font-size:14px;flex-shrink:0;opacity:.8}
.mob-divider{height:1px;background:var(--rule);margin:8px 20px}
.mob-menu-footer{padding:16px 20px;border-top:1px solid var(--rule);flex-shrink:0;font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);line-height:1.6}
.mob-live{display:flex;align-items:center;gap:6px;font-size:9px;color:var(--pos);text-transform:uppercase;letter-spacing:1px;margin-top:8px}
.mob-live-dot{width:5px;height:5px;background:var(--pos);border-radius:50%;animation:pulse 2.5s ease-in-out infinite}

/* Mobile breakpoints */
@media(max-width:768px){
  body{overflow-x:hidden}
  .mob-hamburger{display:flex}
  .topbar-inner{padding:0 12px;gap:10px}
  .topbar-nav,.logo-wm{display:none}
  .topbar-search{max-width:none;flex:1 1 auto;min-width:0;margin:0}
  .topbar-meta span.topbar-date-str{display:none}
  .topbar-meta{gap:6px}
  .topbar-meta span:not(.topbar-date-str){display:none}
  .live-dot{display:none}
  .ticker{display:none}
  .section-hdr{padding:20px 16px 16px}
  .kw-bar{padding:8px 16px;gap:8px}
  .filter-bar{padding:8px 16px;gap:6px}
  .lead-story{padding:20px 16px;grid-template-columns:1fr}
  .ls-right{border-left:0;border-top:1px dashed var(--rule);padding:12px 0 0;margin-top:4px}
  .tsec-hdr{padding:12px 16px 8px}
  .tline{grid-template-columns:4px 36px 1fr;padding:12px 16px;gap:12px;align-items:start}
  .t-name,.t-tags,.t-rt{display:none}
  .t-ic{margin-top:2px}
  .t-ttl{font-size:14px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .t-ttl small{margin-top:4px;font-size:11px}
  .footer{padding:20px 16px}
}
@media(min-width:769px) and (max-width:900px){
  .tline{grid-template-columns:4px 36px 100px 1fr 80px}
  .t-name{width:100px}
}

/* ── Topbar search ── */
.topbar-search{display:flex;align-items:center;gap:7px;flex:1 1 320px;max-width:380px;margin:0 8px;padding:0 12px;height:34px;border:1px solid var(--rule);border-radius:999px;background:color-mix(in oklab,var(--ink) 4%,transparent);transition:border-color .15s,background .15s}
.topbar-search:focus-within{border-color:var(--accent);background:color-mix(in oklab,var(--ink) 7%,transparent)}
.ts-ic{font-size:12px;opacity:.55;flex-shrink:0;line-height:1}
.topbar-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--ink);font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.01em}
.topbar-search input::placeholder{color:var(--muted);opacity:.8}
.topbar-search input::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none}

/* ── Reading-time chip (desktop) ── */
.t-rt{display:inline-block;margin-left:8px;padding:1px 6px;border-radius:999px;border:1px solid var(--rule);font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:500;color:var(--muted);vertical-align:middle;letter-spacing:.04em;white-space:nowrap}

/* ── Filter result-count + clear ── */
.f-clear{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;border:1px solid color-mix(in oklab,var(--neg) 45%,var(--rule));font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--neg);cursor:pointer;background:transparent;white-space:nowrap;transition:all .15s;flex-shrink:0}
.f-clear:hover{background:color-mix(in oklab,var(--neg) 14%,transparent)}
.f-clear[hidden]{display:none}
.f-clear span{opacity:.65;font-size:9px}
.f-count{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted);white-space:nowrap;flex-shrink:0;margin-left:2px}
.f-count:empty{display:none}

/* ── Lazy feed / load-more ── */
.tsec-collapsed{display:none}
.load-more-wrap{padding:22px 40px 30px;display:flex;justify-content:center;border-top:1px solid var(--rule)}
.load-more-wrap[hidden]{display:none}
.load-more{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.04em;color:var(--ink);background:color-mix(in oklab,var(--ink) 5%,var(--paper-2));border:1px solid var(--rule);border-radius:999px;padding:9px 20px;cursor:pointer;transition:all .15s}
.load-more:hover{border-color:var(--accent);color:var(--accent);background:color-mix(in oklab,var(--accent) 8%,transparent)}
.load-more[hidden]{display:none}
.no-results{padding:48px 40px;text-align:center;color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:13px}
.no-results[hidden]{display:none}

/* ── Focus-visible a11y outlines ── */
a:focus-visible,.f-chip:focus-visible,.kw-pill:focus-visible,.f-clear:focus-visible,.load-more:focus-visible,.theme-btn:focus-visible,.topbar-search input:focus-visible,.mob-hamburger:focus-visible,.mob-item:focus-visible,.mob-close:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.topbar-search:focus-within{outline:none}

@media(max-width:768px){
  .load-more-wrap{padding:18px 16px 24px}
  .no-results{padding:36px 16px}
  .t-rt{display:none}
}
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
    <a href="corpus.html" class="mob-item"><span class="mob-ic">&#x1F4DA;</span>Corpus</a>
    <div class="mob-divider"></div>
    <div class="mob-sec-lbl">Categories</div>
    <a href="index.html" class="mob-item" style="color:#22c55e"><span class="mob-ic">&#x1F4C8;</span>Morning Edge</a>
    <a href="index.html" class="mob-item" style="color:#60a5fa"><span class="mob-ic">&#x2696;&#xFE0F;</span>The Brief</a>
    <a href="index.html" class="mob-item" style="color:#a78bfa"><span class="mob-ic">&#x1F916;</span>AI Update</a>
    <a href="index.html" class="mob-item" style="color:#2dd4bf"><span class="mob-ic">&#x1F9EC;</span>Biohacker</a>
    <a href="index.html" class="mob-item" style="color:#eab308"><span class="mob-ic">&#x1F573;&#xFE0F;</span>Rabbit Hole</a>
    <a href="index.html" class="mob-item" style="color:#DC3545"><span class="mob-ic">&#x1F4A1;</span>Praxis</a>
    <a href="index.html" class="mob-item" style="color:#f97316"><span class="mob-ic">&#x1F3A5;</span>Transcripts</a>
    <a href="recipes/ultimate-chewy-brownies/index.html" class="mob-item" style="color:#92400e"><span class="mob-ic">&#x1F36B;</span>Recipes</a>
  </div>
  <div class="mob-menu-footer">
    ngmicapital/GM-Research<br>Updated daily &middot; Powered by Claude
    <div class="mob-live"><div class="mob-live-dot"></div>System Live</div>
  </div>
</div>

<!-- Topbar -->
<header class="topbar">
  <div class="topbar-inner">
    <button class="mob-hamburger" onclick="openMenu()" aria-label="Open menu"><span></span><span></span><span></span></button>
    <a href="index.html" class="logo">
      <span class="logo-stk">
        <span class="top">GM</span>
        <span class="bot">RSRCH</span>
      </span>
    </a>
    <form class="topbar-search" role="search" onsubmit="return false">
      <span class="ts-ic" aria-hidden="true">&#x1F50D;</span>
      <input type="search" id="q" name="q" autocomplete="off" spellcheck="false" aria-label="Search briefings" placeholder="search ${issueCount} issues&hellip;">
    </form>
    <nav class="topbar-nav">
      <a href="index.html" class="active">~/archive</a>
      <a href="visualizations.html">~/visualisations</a>
      <a href="wyckoff.html">~/wyckoff</a>
      <a href="corpus.html">~/corpus</a>
    </nav>
    <div class="topbar-meta">
      <span class="live-dot"></span>
      <span>ONLINE</span>
      <span>&middot;</span>
      <span class="topbar-date-str">${todayDisplay}</span>
      <button class="theme-btn" onclick="toggleTheme()"><span class="icon-dark">&#x1F319;</span><span class="icon-light">&#x2600;&#xFE0F;</span></button>
    </div>
  </div>
</header>

<!-- Ticker -->
<div class="ticker" id="ticker">
  <div class="ticker-track" id="tk-track">
    <span class="tk" data-tk="btc"><b>BTC</b> <span class="tkv">&#x2014;</span> <span class="tkd">&#x2014;</span></span>
    <span class="tk" data-tk="eth"><b>ETH</b> <span class="tkv">&#x2014;</span> <span class="tkd">&#x2014;</span></span>
    <span class="tk" data-tk="sol"><b>SOL</b> <span class="tkv">&#x2014;</span> <span class="tkd">&#x2014;</span></span>
    <span class="tk"><b>SPX</b> <span class="tkv" id="tk-spx">&#x2014;</span> <span class="tkd" id="tk-spx-d">&#x2014;</span></span>
    <span class="tk"><b>WTI</b> <span class="tkv" id="tk-wti">&#x2014;</span> <span class="tkd" id="tk-wti-d">&#x2014;</span></span>
    <span class="tk"><b>Gold</b> <span class="tkv" id="tk-gold">&#x2014;</span> <span class="tkd" id="tk-gold-d">&#x2014;</span></span>
    <span class="tk"><b>VIX</b> <span class="tkv" id="tk-vix">&#x2014;</span> <span class="tkd" id="tk-vix-d">&#x2014;</span></span>
    <span class="tk"><b>DXY</b> <span class="tkv" id="tk-dxy">&#x2014;</span> <span class="tkd" id="tk-dxy-d">&#x2014;</span></span>
  </div>
</div>

<!-- Section header -->
<div class="section-hdr">
  <span class="section-eyebrow">DAILY INTELLIGENCE</span>
  <h2 class="section-title"><em>GM</em> Research</h2>
</div>

<!-- Lead story -->
${heroHTML}

<!-- Keywords + Filter -->
${kwBarHTML}
${filterBarHTML}

<!-- Feed -->
<main class="feed" id="feed">
${feedHTML || '<p style="padding:40px;color:var(--muted);font-family:JetBrains Mono,monospace">No briefings yet.</p>'}
${loadMoreHTML}
<p class="no-results" id="no-results" hidden>No issues match your search.</p>
</main>

<!-- Footer -->
<footer class="footer">
  <div class="footer-inner">
    <a href="https://github.com/ngmicapital/GM-Research" target="_blank">ngmicapital/GM-Research</a>
    <span class="footer-dot"></span>
    <span>Updated daily</span>
    <span class="footer-dot"></span>
    <a href="feed.xml">RSS</a>
    <span class="footer-dot"></span>
    <span>Powered by Claude</span>
  </div>
</footer>

<script>
// Theme persistence — if unset, initialise from the OS prefers-color-scheme.
(function(){
  var s=localStorage.getItem('gm-theme');
  if(s){document.documentElement.setAttribute('data-theme',s);return;}
  var prefersLight=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches;
  document.documentElement.setAttribute('data-theme',prefersLight?'light':'dark');
})();
function toggleTheme(){var h=document.documentElement,n=h.getAttribute('data-theme')==='light'?'dark':'light';h.setAttribute('data-theme',n);localStorage.setItem('gm-theme',n)}
// Headline font: ?font=terminal overrides --hl-font to JetBrains Mono for comparison
(function(){if(new URLSearchParams(window.location.search).get('font')==='terminal')document.documentElement.style.setProperty('--hl-font',"'JetBrains Mono',monospace");})();
// Mobile menu
function openMenu(){var m=document.getElementById('mob-menu'),o=document.getElementById('mob-overlay');m.style.transform='translateX(0)';o.style.opacity='1';o.style.pointerEvents='auto'}
function closeMenu(){var m=document.getElementById('mob-menu'),o=document.getElementById('mob-overlay');m.style.transform='';o.style.opacity='';o.style.pointerEvents=''}
// Ticker
(function(){
  var t=document.getElementById('tk-track');
  if(t){t.innerHTML+=t.innerHTML;t.classList.add('animated');}
})();
// Live prices via CoinGecko (crypto) + data/ticker.json (equities)
(async function(){
  function fmtN(n){if(n>=10000)return Math.round(n/1000).toLocaleString()+'k';if(n>=1000)return n.toLocaleString('en',{maximumFractionDigits:0});return n.toFixed(2);}
  function fmtP(p){return(p>=0?'+':'')+p.toFixed(2)+'%';}
  function setTk(sel,val,pct){
    document.querySelectorAll(sel+' .tkv').forEach(function(el){el.textContent=val;});
    document.querySelectorAll(sel+' .tkd').forEach(function(el){el.textContent=fmtP(pct);el.className='tkd '+(pct>=0?'up':'dn');});
  }
  function setById(valId,dId,val,pct){
    var v=document.getElementById(valId),d=document.getElementById(dId);
    if(v)v.textContent=val;
    if(d){d.textContent=fmtP(pct);d.className='tkd '+(pct>=0?'up':'dn');}
  }
  // Crypto: live via CoinGecko
  try{
    var cr=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&precision=2');
    var cd=await cr.json();
    if(cd.bitcoin){setTk('[data-tk="btc"]',fmtN(cd.bitcoin.usd),cd.bitcoin.usd_24h_change);}
    if(cd.ethereum){setTk('[data-tk="eth"]',fmtN(cd.ethereum.usd),cd.ethereum.usd_24h_change);}
    if(cd.solana){setTk('[data-tk="sol"]',fmtN(cd.solana.usd),cd.solana.usd_24h_change);}
  }catch(e){}
  // Equities / macro: same-origin data/ticker.json (baked hourly by .github/workflows/update-ticker.yml)
  try{
    var yr=await fetch('data/ticker.json',{cache:'no-store'});
    var yd=await yr.json();
    var qs=yd.quotes||{};
    var ym={'spx':['tk-spx','tk-spx-d'],'wti':['tk-wti','tk-wti-d'],'gold':['tk-gold','tk-gold-d'],'vix':['tk-vix','tk-vix-d'],'dxy':['tk-dxy','tk-dxy-d']};
    Object.keys(ym).forEach(function(k){
      var q=qs[k]; if(!q) return;
      setById(ym[k][0],ym[k][1],fmtN(q.price),q.pct||0);
    });
  }catch(e){}
})();
// Search + multi-select category filters + keyword pills + URL state + lazy reveal
(function(){
  var rows=[].slice.call(document.querySelectorAll('.tline'));
  var secs=[].slice.call(document.querySelectorAll('.tsec'));
  var chips=[].slice.call(document.querySelectorAll('.f-chip[data-cat]'));     // category chips (not "All")
  var allChip=document.querySelector('.f-chip[data-filter="all"]');
  var pills=[].slice.call(document.querySelectorAll('.kw-pill'));
  var input=document.getElementById('q');
  var count=document.getElementById('f-count');
  var clearBtn=document.getElementById('f-clear');
  var clearN=document.getElementById('f-clear-n');
  var noRes=document.getElementById('no-results');
  var rest=document.getElementById('tsec-rest');
  var moreWrap=document.getElementById('load-more-wrap');
  var moreBtn=document.getElementById('load-more');

  var activeCats={};          // set of active category keys
  var userExpanded=false;     // true once the user clicked "Load earlier issues"

  function catsActive(){return Object.keys(activeCats).length>0;}

  function setExpanded(on){
    if(!rest)return;
    rest.style.display=on?'block':'';
    if(moreWrap)moreWrap.hidden=on;
  }

  // Reveal/collapse the lazy tail based on whether any filter/search is active.
  function syncLazy(active){
    if(!rest)return;
    if(active||userExpanded)setExpanded(true);
    else setExpanded(false);
  }

  function apply(){
    var q=(input&&input.value||'').trim().toLowerCase();
    var filtering=q.length>0||catsActive();
    // When filtering/searching, the whole archive must be reachable.
    syncLazy(filtering);

    var visible=0;
    for(var i=0;i<rows.length;i++){
      var row=rows[i];
      var catOk=!catsActive()||activeCats[row.dataset.cat];
      var qOk=!q||(row.textContent||'').toLowerCase().indexOf(q)!==-1;
      var show=catOk&&qOk;
      row.classList.toggle('f-hide',!show);
      if(show)visible++;
    }
    for(var s=0;s<secs.length;s++){
      var sec=secs[s];
      sec.classList.toggle('f-hide',sec.querySelectorAll('.tline:not(.f-hide)').length===0);
    }

    // Category chip active state + "All" reflects no active categories.
    chips.forEach(function(c){c.classList.toggle('active',!!activeCats[c.dataset.cat]);});
    if(allChip)allChip.classList.toggle('active',!catsActive());

    // Keyword pill active state mirrors an exact query match.
    pills.forEach(function(p){p.classList.toggle('active',q&&(p.dataset.kw||'').toLowerCase()===q);});

    // Result count (only meaningful while a filter/search is active).
    if(count)count.textContent=filtering?(visible+' result'+(visible===1?'':'s')):'';
    if(noRes)noRes.hidden=!(filtering&&visible===0);

    // Clear control + active-filter count (categories).
    var n=Object.keys(activeCats).length;
    if(clearBtn)clearBtn.hidden=n===0;
    if(clearN)clearN.textContent=n?('('+n+')'):'';

    writeHash(q);
  }

  function writeHash(q){
    var parts=[];
    var cats=Object.keys(activeCats);
    if(cats.length)parts.push('cat='+cats.join(','));
    if(q)parts.push('q='+encodeURIComponent(q));
    var hash=parts.length?('#'+parts.join('&')):'';
    var url=location.pathname+location.search+hash;
    try{history.replaceState(null,'',url);}catch(e){}
  }

  function readHash(){
    var h=(location.hash||'').replace(/^#/,'');
    if(!h)return;
    h.split('&').forEach(function(kv){
      var eq=kv.indexOf('=');
      var k=eq<0?kv:kv.slice(0,eq);
      var v=eq<0?'':kv.slice(eq+1);
      if(k==='cat'){
        decodeURIComponent(v).split(',').forEach(function(c){
          c=c.trim();
          if(c&&document.querySelector('.f-chip[data-cat="'+c+'"]'))activeCats[c]=true;
        });
      } else if(k==='q'&&input){
        try{input.value=decodeURIComponent(v);}catch(e){input.value=v;}
      }
    });
  }

  // Category chip toggles (set semantics; OR across categories).
  chips.forEach(function(c){
    c.addEventListener('click',function(){
      var cat=c.dataset.cat;
      if(activeCats[cat])delete activeCats[cat];else activeCats[cat]=true;
      apply();
    });
  });
  // "All" clears the category set (search box is left untouched).
  if(allChip)allChip.addEventListener('click',function(){activeCats={};apply();});

  // Keyword pill → set the search box value and apply.
  pills.forEach(function(p){
    p.addEventListener('click',function(e){
      e.preventDefault();
      if(input)input.value=p.dataset.kw||'';
      apply();
    });
  });

  // Clear control resets the active categories.
  if(clearBtn)clearBtn.addEventListener('click',function(){activeCats={};apply();});

  // Debounced search input (~120ms).
  if(input){
    var t;
    input.addEventListener('input',function(){clearTimeout(t);t=setTimeout(apply,120);});
  }
  // Keyboard: "/" focuses search; Esc clears it when focused.
  document.addEventListener('keydown',function(e){
    var tag=(e.target&&e.target.tagName||'').toLowerCase();
    var typing=tag==='input'||tag==='textarea'||(e.target&&e.target.isContentEditable);
    if(e.key==='/'&&!typing&&input){e.preventDefault();input.focus();}
    else if(e.key==='Escape'&&input&&document.activeElement===input){input.value='';apply();input.blur();}
  });

  // Load earlier issues — reveal the lazy tail (stays revealed thereafter).
  if(moreBtn)moreBtn.addEventListener('click',function(){
    userExpanded=true;setExpanded(true);moreBtn.setAttribute('aria-expanded','true');
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
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
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

fs.writeFileSync(SITEMAP_FILE, buildSitemapXml(briefingEntries, transcriptsByDate));
console.log(`sitemap.xml written — ${2 + bCount + tCount} url(s)`);

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
