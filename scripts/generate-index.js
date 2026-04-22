#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT            = path.join(__dirname, '..');
const BRIEFINGS_DIR   = path.join(ROOT, 'briefings');
const TRANSCRIPTS_DIR = path.join(ROOT, 'transcripts');
const MANIFEST_FILE   = path.join(TRANSCRIPTS_DIR, 'manifest.json');
const OUTPUT_FILE     = path.join(ROOT, 'index.html');

// ─── Briefing metadata ───────────────────────────────────────────────────────

const BRIEFING_META = {
  'market-briefing':   { title:'The Morning Edge', subtitle:'Market Intelligence',   icon:'&#x1F4C8;',         accent:'#22c55e', accentDim:'#22c55e18', typeLabel:'Morning Edge', filename:'market-briefing.html', preview:'BTC, equities, macro, crypto derivatives & prediction markets', slug:'MKT', cat:'market' },
  'legal-brief':       { title:'The Brief',        subtitle:'Legal Intelligence',    icon:'&#x2696;&#xFE0F;',  accent:'#60a5fa', accentDim:'#60a5fa18', typeLabel:'The Brief',    filename:'legal-brief.html', preview:'Crypto regulation, enforcement actions & legislative tracker', slug:'LAW', cat:'legal' },
  'ai-briefing':       { title:'AI Intelligence',   subtitle:'Models & Strategy',     icon:'&#x1F916;',         accent:'#a78bfa', accentDim:'#a78bfa18', typeLabel:'AI Update',    filename:'ai-briefing.html', preview:'Model releases, benchmarks, AI x Crypto & research papers', slug:'AI',  cat:'ai' },
  'biohacker-report':  { title:'Biohacker Report',  subtitle:'Health & Longevity',    icon:'&#x1F9EC;',         accent:'#2dd4bf', accentDim:'#2dd4bf18', typeLabel:'Biohacker',    filename:'biohacker-report.html', preview:'Longevity science, training protocols & daily wisdom', slug:'BIO', cat:'bio' },
  'rabbit-hole':       { title:'Rabbit Hole',        subtitle:'Deep Dive',             icon:'&#x1F573;&#xFE0F;', accent:'#eab308', accentDim:'#eab30818', typeLabel:'Rabbit Hole',  filename:'rabbit-hole.html', preview:'One topic, explored with depth and narrative momentum', slug:'RH',  cat:'rh' },
  'praxis-brief':      { title:'Praxis',              subtitle:'Ideas In Practice',      icon:'&#x1F4A1;',         accent:'#DC3545', accentDim:'#DC354518', typeLabel:'Praxis',        filename:'praxis-brief.html', preview:'Philosophy, strategy, tools & emerging ideas', slug:'PRX', cat:'prx' },
};
const ORDER = ['market-briefing', 'legal-brief', 'ai-briefing', 'biohacker-report', 'praxis-brief', 'rabbit-hole'];

function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function stripHtml(s) {
  return s
    .replace(/<[^>]*>/g, '')
    // Named entities
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lsquo;/g, '\u2018').replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '\u201C').replace(/&rdquo;/g, '\u201D')
    .replace(/&apos;/g, "'").replace(/&copy;/g, '©').replace(/&reg;/g, '®')
    // Numeric entities (hex and decimal)
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/\s+/g, ' ').trim();
}

// Extract a headline, preview summary + tags from a briefing HTML file
function extractBriefingMeta(filePath, key) {
  let headline = '';
  let preview = '';
  let tags = [];
  try {
    const html = fs.readFileSync(filePath, 'utf8');

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
      'key ideas', 'ideas & insights', 'ideas and insights',
      'strategy & practice', 'strategy and practice',
      'tools & resources', 'tools and resources',
      'on the horizon', 'watchlist', 'overview', 'summary',
      'top stories', 'highlights', 'the rundown',
    ];
    if (headline && GENERIC_SECTION_NAMES.some(s => headline.toLowerCase().startsWith(s))) {
      console.warn(`⚠  [validator] ${key} @ ${filePath.split(/[\\/]/).slice(-2).join('/')}: headline looks like a section header ("${headline}"). Add a tldr-text element or card-title for better extraction.`);
    }

    // Extract tags from key patterns
    const tagPatterns = {
      'market-briefing':  /\b(BTC|ETH|SOL|Gold|SPX|VIX|WTI|Brent|DXY|NVDA|TSLA)\b/g,
      'legal-brief':      /\b(SEC|CFTC|ESMA|FCA|MAS|ASIC|OCC|MiCA|GENIUS|CLARITY|FIT21|Ripple|Coinbase|Binance)\b/g,
      'ai-briefing':      /\b(Claude|GPT|Gemini|DeepSeek|Mistral|NVIDIA|Llama|Anthropic|OpenAI|Google)\b/g,
      'biohacker-report': /\b(Creatine|GLP-1|VO2max|Huberman|Zone 2|Sleep|HRV|Cortisol|Testosterone)\b/g,
      // Rabbit hole: header-category first (new format: "History · Biography"), then further-card-pill (old format)
      'rabbit-hole':      /class="header-category">([^<]+)<\/div>|<span class="further-card-pill">([^<]+)<\/span>/g,
      'praxis-brief':     /\b(Stoic|Stoicism|Farnam|Manson|Philosophy|Strategy|CBT|Second Brain|Obsidian)\b/g,
    };
    const tagRe = tagPatterns[key];
    if (tagRe) {
      const found = new Set();
      let m;
      while ((m = tagRe.exec(html))) {
        const val = (m[1] || m[2] || '').trim();
        if (!val) continue;
        // header-category may be "History · Biography" — split into individual tags
        if (val.includes('·')) {
          val.split('·').map(s => s.trim()).filter(Boolean).forEach(t => found.add(t));
        } else {
          found.add(val);
        }
      }
      tags = [...found].slice(0, 3);
    }
    // Rabbit-hole fallback: if strict pattern found nothing, extract capitalised words from <strong> blocks
    if (key === 'rabbit-hole' && tags.length === 0) {
      const fallbackRe = /<strong>([A-Z][A-Za-z\u00C0-\u024F]{2,}(?:\s[A-Z][A-Za-z\u00C0-\u024F]{2,})?)/g;
      const skipWords = new Set(['The','This','That','These','Those','When','What','Why','How','Who','Where','More','Less','Most','Just','Also','Only','Even','Very','Much','Many','Some','Other','Such','Each','Both','Then','They','With','From','Into','About','After','Before','During','Through','While','Which','Their','There']);
      const fb = new Set();
      let fm;
      fallbackRe.lastIndex = 0;
      while ((fm = fallbackRe.exec(html)) && fb.size < 10) {
        const word = fm[1].split(/[\s:,–—]/)[0];
        if (!skipWords.has(word) && word.length >= 3) fb.add(word);
      }
      tags = [...fb].slice(0, 3);
    }
  } catch(e) { /* file read error — use defaults */ }
  return { headline, preview, tags };
}

function formatDate(ds) {
  const d = new Date(`${ds}T12:00:00Z`);
  return d.toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
}

// ─── Card HTML generators ────────────────────────────────────────────────────

const RECIPE_DATE = '2026-04-03';

function briefingCard(date, key) {
  const m = BRIEFING_META[key];
  const filePath = path.join(BRIEFINGS_DIR, date, m.filename);
  const { headline, preview, tags } = extractBriefingMeta(filePath, key);
  const title = headline || m.preview;
  const tagsHTML = tags.slice(0,2).map(t => `<span>${escapeHtml(t)}</span>`).join('');
  const tagsAttr = tags.join(',').toLowerCase();
  return `
    <a href="briefings/${date}/${m.filename}" class="tline" data-cat="${m.cat}" data-tags="${escapeHtml(tagsAttr)}">
      <div class="t-bar"></div>
      <div class="t-ic">${m.icon}</div>
      <div class="t-name">${m.typeLabel}</div>
      <div class="t-ttl">${escapeHtml(title)}${preview ? `<small>${escapeHtml(preview)}</small>` : ''}</div>
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
  <section class="tsec">
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
  const { headline, preview, tags } = extractBriefingMeta(fp, leadKey);
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

  return `
  <section class="lead-story" data-cat="${m.cat}">
    <a href="briefings/${today}/${m.filename}" class="ls-left">
      <div class="ls-eyebrow">// TODAY&rsquo;S LEAD &mdash; ${m.typeLabel.toUpperCase()}</div>
      <h1 class="ls-hl">${escapeHtml(headline)}</h1>
      <p class="ls-body">${escapeHtml(preview)}</p>
      ${tagStr ? `<div class="ls-meta">${tagStr}</div>` : ''}
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
  const catCounts = { market:0, legal:0, ai:0, bio:0, rh:0, prx:0, tx:0, rec:0 };
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
  const aestNow = new Date(new Date().toLocaleString('en-US',{timeZone:'Australia/Sydney'}));
  const today = aestNow.getFullYear()+'-'+String(aestNow.getMonth()+1).padStart(2,'0')+'-'+String(aestNow.getDate()).padStart(2,'0');
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
    {key:'tx',     label:'Transcripts',count: catCounts.tx,       cat: 'tx'},
    {key:'rec',    label:'Recipes',    count: catCounts.rec,      cat: 'rec'},
  ].filter(c => c.key === 'all' || c.count > 0);
  const filterBarHTML = `
<div class="filter-bar">
  ${filterCats.map((c,i) => `<button class="f-chip${i===0?' active':''}" data-filter="${c.key}"${c.cat?` data-cat="${c.cat}"`:''}>${c.label} <span>${c.count}</span></button>`).join('')}
</div>`;

  const heroHTML = leadStoryHTML(today, briefingEntries);

  const feedHTML = allDates.map(date =>
    dateGroupHTML(date, briefingMap[date]||[], transcriptsByDate[date]||[], date===today)
  ).join('');

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GM Research — Intelligence Archive</title>
<link rel="icon" type="image/svg+xml" href="favicon.svg">
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
.tkv{color:var(--muted)}
.tkd{color:var(--muted)}
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
.tsec{border-bottom:1px solid var(--rule)}
.tsec-hdr{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.12em;padding:14px 40px 10px;border-bottom:1px solid var(--ink);display:flex;justify-content:space-between;align-items:center}
.tsec-hdr b{color:var(--ink);font-size:13px;letter-spacing:0;text-transform:none;font-weight:600}
.today-tag{font-size:9px;background:var(--accent);color:#000;padding:2px 8px;border-radius:2px;letter-spacing:0.1em;text-transform:uppercase;margin-left:8px;font-weight:700;vertical-align:middle}
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
  .topbar-inner{padding:0 16px}
  .topbar-nav,.logo-wm{display:none}
  .topbar-meta span.topbar-date-str{display:none}
  .ticker{display:none}
  .section-hdr{padding:20px 16px 16px}
  .kw-bar{padding:8px 16px;gap:8px}
  .filter-bar{padding:8px 16px;gap:6px}
  .lead-story{padding:20px 16px;grid-template-columns:1fr}
  .ls-right{border-left:0;border-top:1px dashed var(--rule);padding:12px 0 0;margin-top:4px}
  .tsec-hdr{padding:12px 16px 8px}
  .tline{grid-template-columns:4px 36px 1fr;padding:10px 16px;gap:10px}
  .t-name,.t-tags{display:none}
  .footer{padding:20px 16px}
}
@media(max-width:900px){
  .tline{grid-template-columns:4px 36px 100px 1fr 80px}
  .t-name{width:100px}
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
    <nav class="topbar-nav">
      <a href="index.html" class="active">~/archive</a>
      <a href="visualizations.html">~/visualisations</a>
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
<div class="feed">
${feedHTML || '<p style="padding:40px;color:var(--muted);font-family:JetBrains Mono,monospace">No briefings yet.</p>'}
</div>

<!-- Footer -->
<footer class="footer">
  <div class="footer-inner">
    <a href="https://github.com/ngmicapital/GM-Research" target="_blank">ngmicapital/GM-Research</a>
    <span class="footer-dot"></span>
    <span>Updated daily</span>
    <span class="footer-dot"></span>
    <span>Powered by Claude</span>
  </div>
</footer>

<script>
// Theme persistence
(function(){var s=localStorage.getItem('gm-theme');if(s)document.documentElement.setAttribute('data-theme',s)})();
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
  // Equities / macro: Yahoo Finance
  try{
    var yUrl='https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EGSPC%2CCL%3DF%2CGC%3DF%2C%5EVIX%2CDX-Y.NYB&fields=regularMarketPrice%2CregularMarketChangePercent';
    var yr=await fetch(yUrl,{headers:{'Accept':'application/json'}});
    var yd=await yr.json();
    var qs=(yd.quoteResponse&&yd.quoteResponse.result)||[];
    var ym={'^GSPC':['tk-spx','tk-spx-d'],'^GSPC':['tk-spx','tk-spx-d'],'CL=F':['tk-wti','tk-wti-d'],'GC=F':['tk-gold','tk-gold-d'],'^VIX':['tk-vix','tk-vix-d'],'DX-Y.NYB':['tk-dxy','tk-dxy-d']};
    qs.forEach(function(q){
      var ids=ym[q.symbol];
      if(ids&&q.regularMarketPrice!=null){setById(ids[0],ids[1],fmtN(q.regularMarketPrice),q.regularMarketChangePercent||0);}
    });
  }catch(e){}
})();
// Filter chips + keyword pills
(function(){
  function applyFilter(type,value){
    document.querySelectorAll('.f-chip').forEach(function(b){b.classList.remove('active');});
    document.querySelectorAll('.kw-pill').forEach(function(b){b.classList.remove('active');});
    if(type==='cat'){
      var btn=document.querySelector('.f-chip[data-filter="'+value+'"]');
      if(btn)btn.classList.add('active');
      document.querySelectorAll('.tline').forEach(function(row){
        row.classList.toggle('f-hide',value!=='all'&&row.dataset.cat!==value);
      });
    } else {
      var kw=value.toLowerCase();
      var btn2=document.querySelector('.kw-pill[data-kw="'+value+'"]');
      if(btn2)btn2.classList.add('active');
      document.querySelectorAll('.tline').forEach(function(row){
        var tags=(row.dataset.tags||'').toLowerCase().split(',');
        row.classList.toggle('f-hide',!tags.some(function(t){return t.trim()===kw;}));
      });
    }
    document.querySelectorAll('.tsec').forEach(function(sec){
      sec.classList.toggle('f-hide',sec.querySelectorAll('.tline:not(.f-hide)').length===0);
    });
  }
  document.querySelectorAll('.f-chip').forEach(function(btn){
    btn.addEventListener('click',function(){applyFilter('cat',btn.dataset.filter);});
  });
  document.querySelectorAll('.kw-pill').forEach(function(btn){
    btn.addEventListener('click',function(e){e.preventDefault();applyFilter('kw',btn.dataset.kw);});
  });
})();
</script>
</body>
</html>`;
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

// ─── Post-build UI validator ──────────────────────────────────────────────────
// Checks every card extraction for common issues and warns loudly.
const SUSPICIOUS = ['Released ', 'Architecture:', 'See also', '§', 'http', 'undefined', 'null'];
let issues = 0;
briefingEntries.slice(0, 3).forEach(e => {  // only check latest 3 dates
  e.briefings.forEach(key => {
    const m = BRIEFING_META[key];
    const filePath = path.join(BRIEFINGS_DIR, e.date, m.filename);
    const { headline, preview } = extractBriefingMeta(filePath, key);
    const warn = (msg) => { console.warn(`  ⚠️  [${e.date}/${key}] ${msg}`); issues++; };
    if (!headline)                                    warn('EMPTY headline — falling back to default');
    if (headline.length < 15)                         warn(`SHORT headline (${headline.length} chars): "${headline}"`);
    if (!preview)                                     warn('EMPTY preview — card will show no description text');
    if (preview.length > 190)                         warn(`LONG preview (${preview.length} chars) — may overflow card`);
    if (/&[a-zA-Z]+;/.test(headline))                warn(`RAW HTML ENTITY in headline: "${headline}"`);
    if (/&[a-zA-Z]+;/.test(preview))                 warn(`RAW HTML ENTITY in preview: "${preview}"`);
    SUSPICIOUS.forEach(s => { if (headline.includes(s)) warn(`SUSPICIOUS headline contains "${s}": "${headline}"`); });
  });
});
if (issues === 0) {
  console.log('✓  UI validator: all card extractions look clean');
} else {
  console.warn(`\n  ${issues} extraction issue(s) found above — check briefing HTML structure (warnings only, continuing)\n`);
  // Warnings are non-fatal: always exit 0 so the deploy pipeline is never blocked.
  // process.exit(1) is reserved for hard errors (e.g. unreadable briefings directory).
}
