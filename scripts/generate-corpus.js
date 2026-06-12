#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const CORPUS_ROOT = path.resolve(__dirname, '..', '..', 'corpus');
const SOURCES_DIR = path.join(CORPUS_ROOT, 'wiki', 'sources');
const OUTPUT_FILE = path.join(ROOT, 'corpus.html');

// ─── Domain metadata ────────────────────────────────────────────────────────

const DOMAINS = {
  ai:         { label: 'AI',         color: '#a78bfa', colorDim: '#a78bfa18' },
  trading:    { label: 'Trading',    color: '#a3e635', colorDim: '#a3e63518' },
  legal:      { label: 'Legal',      color: '#60a5fa', colorDim: '#60a5fa18' },
  biohacking: { label: 'Biohacking', color: '#2dd4bf', colorDim: '#2dd4bf18' },
  web3:       { label: 'Web3',       color: '#eab308', colorDim: '#eab30818' },
  fitness:    { label: 'Fitness',    color: '#f59e0b', colorDim: '#f59e0b18' },
  personal:   { label: 'Personal',   color: '#8888a0', colorDim: '#8888a018' },
};

const TIER_COLORS = {
  S: { bg: '#f59e0b18', border: '#f59e0b', text: '#f59e0b', label: 'S-tier' },
  A: { bg: '#22c55e18', border: '#22c55e', text: '#22c55e', label: 'A-tier' },
  B: { bg: '#60a5fa18', border: '#60a5fa', text: '#60a5fa', label: 'B-tier' },
  C: { bg: '#8888a018', border: '#8888a0', text: '#8888a0', label: 'C-tier' },
  D: { bg: '#ef444418', border: '#ef4444', text: '#ef4444', label: 'D-tier' },
};

const TIER_ORDER = { S: 0, A: 1, B: 2, C: 3, D: 4 };

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Parse source file ──────────────────────────────────────────────────────

function parseSourceFile(filePath, domain) {
  // Normalize CRLF — corpus files on the Windows mirror carry \r\n, which
  // breaks front-matter fence detection and the \n\n section regexes.
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const lines = content.split('\n');

  // YAML front-matter (the corpus-bot / corpus-worker format). Parsed first;
  // **Key**: body lines below remain the fallback for older files (karpathy).
  const fm = {};
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) {
      for (const line of lines.slice(1, end)) {
        const m = line.match(/^([A-Za-z_]+):\s*(.+)$/);
        if (m) fm[m[1].toLowerCase()] = m[2].trim().replace(/^"|"$/g, '');
      }
    }
  }

  // Extract title from first H1
  let title = '';
  const h1Match = content.match(/^#\s+(.+)/m);
  if (h1Match) title = h1Match[1].trim();

  // Extract metadata from **Key**: Value lines
  let author = '', date = '', tier = '', composite = '', sourceUrl = '', ingested = '';
  const tags = [];

  for (const line of lines) {
    const kvMatch = line.match(/^\*\*([^*]+)\*\*:\s*(.+)/);
    if (kvMatch) {
      const key = kvMatch[1].trim().toLowerCase();
      const val = kvMatch[2].trim();
      if (key === 'author(s)' || key === 'author') author = val;
      if (key === 'date') date = val;
      if (key === 'source') sourceUrl = val;
      if (key === 'ingested') ingested = val;
      if (key === 'tier') tier = val.charAt(0).toUpperCase();
      if (key === 'composite') composite = val;
      if (key === 'tags' || key === 'projection tags') {
        val.split(',').map(t => t.trim().replace(/`/g, '')).filter(Boolean).forEach(t => tags.push(t));
      }
    }
  }

  // Front-matter values win over body-line fallbacks
  if (fm.title) title = fm.title;
  if (fm.author) author = fm.author;
  if (fm.date) date = fm.date;
  if (fm.tier) tier = fm.tier.charAt(0).toUpperCase();
  if (fm.composite) composite = fm.composite;
  if (fm.source_url) sourceUrl = fm.source_url;
  if (fm.ingested) ingested = fm.ingested;
  if (fm.tags) {
    fm.tags.replace(/^\[|\]$/g, '').split(',')
      .map(t => t.trim()).filter(Boolean).forEach(t => tags.push(t));
  }

  // Extract Summary section
  let summary = '';
  const sumMatch = content.match(/## Summary\s*\n\n([\s\S]*?)(?=\n## |\n---|\Z)/);
  if (sumMatch) {
    summary = sumMatch[1].trim().split('\n\n')[0].trim();
    if (summary.length > 300) summary = summary.slice(0, 297) + '...';
  }

  // Extract Key Extractables (numbered list)
  const extractables = [];
  const extMatch = content.match(/## Key [Ee]xtractables?\s*\n\n([\s\S]*?)(?=\n## |\n---|\Z)/);
  if (extMatch) {
    const listLines = extMatch[1].trim().split('\n');
    for (const l of listLines) {
      const itemMatch = l.match(/^\d+\.\s+(.+)/);
      if (itemMatch && extractables.length < 5) {
        extractables.push(itemMatch[1].trim());
      }
    }
  }

  // If no Key Extractables section, try "Key quotes / passages"
  if (extractables.length === 0) {
    const quotesMatch = content.match(/## Key quotes\s*[/&]\s*passages?\s*\n\n([\s\S]*?)(?=\n## |\n---|\Z)/i);
    if (quotesMatch) {
      const quoteBlocks = quotesMatch[1].trim().split('\n\n');
      for (const block of quoteBlocks) {
        if (block.startsWith('>') && extractables.length < 3) {
          let q = block.replace(/^>\s*/gm, '').trim();
          if (q.length > 120) q = q.slice(0, 117) + '...';
          extractables.push(q);
        }
      }
    }
  }

  // Clean date — extract just the YYYY-MM-DD portion
  let dateClean = '';
  const dateMatch = (date || '').match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) dateClean = dateMatch[1];
  if (!dateClean && ingested) {
    const ingestedMatch = ingested.match(/(\d{4}-\d{2}-\d{2})/);
    if (ingestedMatch) dateClean = ingestedMatch[1];
  }

  // Derive source link from Source field
  let link = '';
  const urlMatch = (sourceUrl || '').match(/(https?:\/\/[^\s;,)]+)/);
  if (urlMatch) link = urlMatch[1];

  return {
    title,
    author,
    date: dateClean,
    domain,
    tier: TIER_ORDER[tier] !== undefined ? tier : '',
    composite,
    tags,
    summary,
    extractables,
    sourceUrl: link,
    ingested,
  };
}

// ─── Collect all sources ────────────────────────────────────────────────────

function collectSources() {
  const sources = [];
  if (!fs.existsSync(SOURCES_DIR)) {
    console.warn(`Sources directory not found: ${SOURCES_DIR}`);
    return sources;
  }

  const domainDirs = fs.readdirSync(SOURCES_DIR).filter(d =>
    fs.statSync(path.join(SOURCES_DIR, d)).isDirectory()
  );

  for (const domain of domainDirs) {
    const domainPath = path.join(SOURCES_DIR, domain);
    const files = fs.readdirSync(domainPath).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const source = parseSourceFile(path.join(domainPath, file), domain);
        sources.push(source);
      } catch (e) {
        console.warn(`  Warning: failed to parse ${domain}/${file}: ${e.message}`);
      }
    }
  }

  // Sort: newest first, then by tier
  sources.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    const ta = TIER_ORDER[a.tier] ?? 99;
    const tb = TIER_ORDER[b.tier] ?? 99;
    return ta - tb;
  });

  return sources;
}

// ─── Build card HTML ────────────────────────────────────────────────────────

function buildCardHTML(source) {
  const dm = DOMAINS[source.domain] || DOMAINS.personal;
  const tierInfo = TIER_COLORS[source.tier];

  const domainPill = `<span class="card-domain" style="color:${dm.color};background:${dm.colorDim};border-color:${dm.color}40">${escapeHtml(dm.label)}</span>`;
  const tierBadge = tierInfo
    ? `<span class="card-tier" style="color:${tierInfo.text};background:${tierInfo.bg};border-color:${tierInfo.border}40">${escapeHtml(tierInfo.label)}</span>`
    : '<span class="card-tier unrated">Unrated</span>';

  const meta = [source.author, source.date].filter(Boolean).join(' &middot; ');

  const tagsHTML = source.tags.length
    ? `<div class="card-tags">${source.tags.map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  let extractablesHTML = '';
  if (source.extractables.length) {
    extractablesHTML = `
      <div class="card-extractables">
        <div class="card-ext-label">Key takeaways</div>
        <ol>${source.extractables.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ol>
      </div>`;
  }

  const linkHTML = source.sourceUrl
    ? `<a href="${escapeHtml(source.sourceUrl)}" class="card-link" target="_blank" rel="noopener">Source &rarr;</a>`
    : '';

  return `
      <div class="corpus-card" data-domain="${escapeHtml(source.domain)}" style="border-left-color:${dm.color}">
        <div class="card-header">
          ${domainPill}
          ${tierBadge}
        </div>
        <div class="card-title">${escapeHtml(source.title)}</div>
        ${meta ? `<div class="card-meta">${meta}</div>` : ''}
        ${source.summary ? `<div class="card-summary">${escapeHtml(source.summary)}</div>` : ''}
        ${tagsHTML}
        ${extractablesHTML}
        ${linkHTML}
      </div>`;
}

// ─── Build full HTML ────────────────────────────────────────────────────────

function buildHTML(sources) {
  const domainCounts = {};
  for (const s of sources) {
    domainCounts[s.domain] = (domainCounts[s.domain] || 0) + 1;
  }

  const activeDomains = Object.keys(domainCounts).length;
  const topTier = sources.reduce((best, s) => {
    if (!s.tier) return best;
    if (!best) return s.tier;
    return (TIER_ORDER[s.tier] < TIER_ORDER[best]) ? s.tier : best;
  }, '');

  const today = new Date().toISOString().slice(0, 10);

  const cardsHTML = sources.map(s => buildCardHTML(s)).join('\n');

  // Domain filter pills
  const filterPills = [
    { key: 'all', label: 'All', color: '#f59e0b', count: sources.length },
    ...Object.entries(DOMAINS)
      .filter(([k]) => domainCounts[k])
      .map(([k, v]) => ({ key: k, label: v.label, color: v.color, count: domainCounts[k] || 0 })),
  ];

  const filterHTML = filterPills.map((p, i) =>
    `<button class="domain-pill${i === 0 ? ' active' : ''}" data-domain="${p.key}" style="--pill-color:${p.color}">${escapeHtml(p.label)} <span>${p.count}</span></button>`
  ).join('\n        ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GM Research — Corpus</title>
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg-0: #06060a; --bg-1: #0a0a10; --bg-2: #0e0e16; --bg-3: #13131d;
    --border: #1a1a28; --border-hover: #2a2a3d;
    --text-0: #ffffff; --text-1: #c8c8d4; --text-2: #8888a0; --text-3: #55556a;
    --amber: #f59e0b; --amber-dim: #f59e0b18;
    --green: #22c55e; --green-dim: #22c55e18;
    --blue: #60a5fa; --blue-dim: #60a5fa18;
    --purple: #a78bfa; --purple-dim: #a78bfa18;
    --teal: #2dd4bf; --teal-dim: #2dd4bf18;
    --red: #ef4444; --red-dim: #ef444418;
  }
  [data-theme="light"]{--bg-0:#f5f5f7;--bg-1:#fff;--bg-2:#f0f0f3;--bg-3:#e8e8ee;--border:#d4d4dc;--border-hover:#b8b8c4;--text-0:#111118;--text-1:#333340;--text-2:#66667a;--text-3:#9999aa;--amber:#d97706;--amber-dim:#d9770615;--green:#16a34a;--green-dim:#16a34a12;--blue:#2563eb;--blue-dim:#2563eb12;--purple:#7c3aed;--purple-dim:#7c3aed12;--teal:#0d9488;--teal-dim:#0d948812;--red:#dc2626;--red-dim:#dc262612}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg-0); color: var(--text-1); font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }
  a { color: inherit; text-decoration: none; }

  /* ── Topbar ── */
  .topbar{display:flex;align-items:center;justify-content:space-between;padding:0 40px;height:56px;border-bottom:1px solid var(--border);background:rgba(10,10,16,0.8);backdrop-filter:blur(20px) saturate(1.4);-webkit-backdrop-filter:blur(20px) saturate(1.4);position:sticky;top:0;z-index:100}
  [data-theme="light"] .topbar{background:rgba(255,255,255,0.85)}
  .topbar-left{display:flex;align-items:center;gap:16px}
  .logo{font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:var(--text-0);letter-spacing:-.5px;display:flex;align-items:center;gap:10px;text-decoration:none}
  .logo-mark{width:28px;height:28px;border-radius:6px;background:linear-gradient(135deg,var(--amber),#d97706);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#000}
  [data-theme="light"] .logo-mark{background:linear-gradient(135deg,#d97706,#b45309)}
  .logo span{color:var(--amber)}
  .topbar-sep{width:1px;height:20px;background:var(--border)}
  .topbar-tabs{display:flex;gap:4px}
  .topbar-tab{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px;text-decoration:none;padding:6px 12px;border-radius:5px;transition:all .2s}
  .topbar-tab:hover{color:var(--text-1);background:var(--bg-3)}
  .topbar-tab.active{color:var(--text-0);background:var(--bg-3);border:1px solid var(--border)}
  .topbar-right{display:flex;gap:16px;align-items:center}
  .theme-toggle{width:36px;height:36px;border-radius:8px;border:1px solid var(--border);background:var(--bg-3);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;color:var(--text-2);transition:all .2s}
  .theme-toggle:hover{border-color:var(--border-hover)}.theme-toggle .icon-sun{display:none}.theme-toggle .icon-moon{display:block}
  [data-theme="light"] .theme-toggle .icon-sun{display:block}[data-theme="light"] .theme-toggle .icon-moon{display:none}
  [data-theme="light"] .theme-toggle{background:var(--bg-1)}

  /* ── Page layout ── */
  .page { max-width: 1200px; margin: 0 auto; padding: 40px 40px 80px; }
  .page-header { margin-bottom: 32px; }
  .page-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: var(--amber); margin-bottom: 8px; }
  .page-title { font-size: 32px; font-weight: 800; color: var(--text-0); letter-spacing: -1px; }
  .page-sub { font-size: 14px; color: var(--text-3); margin-top: 8px; }

  /* ── Stats bar ── */
  .stats-bar { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 24px; padding: 12px 16px; background: var(--bg-1); border: 1px solid var(--border); border-radius: 8px; }
  .stat { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-3); }
  .stat b { color: var(--text-1); font-weight: 600; }

  /* ── Search ── */
  .search-wrap { margin-bottom: 20px; }
  .search-input { width: 100%; padding: 10px 16px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-1); background: var(--bg-1); border: 1px solid var(--border); border-radius: 8px; outline: none; transition: border-color .2s; }
  .search-input:focus { border-color: var(--border-hover); }
  .search-input::placeholder { color: var(--text-3); }
  [data-theme="light"] .search-input { background: var(--bg-1); }

  /* ── Domain filter pills ── */
  .filter-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 28px; }
  .domain-pill { display: inline-flex; align-items: center; gap: 5px; padding: 5px 14px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--pill-color) 35%, var(--border)); font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--pill-color); cursor: pointer; background: transparent; white-space: nowrap; transition: all .15s; }
  .domain-pill:hover { border-color: var(--pill-color); background: color-mix(in oklab, var(--pill-color) 10%, transparent); }
  .domain-pill.active { background: color-mix(in oklab, var(--pill-color) 20%, var(--bg-1)); border-color: var(--pill-color); color: var(--pill-color); font-weight: 600; }
  .domain-pill span { opacity: .55; font-size: 9px; }

  /* ── Card grid ── */
  .card-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
  @media (min-width: 768px) { .card-grid { grid-template-columns: 1fr 1fr; } }

  .corpus-card { background: var(--bg-1); border: 1px solid var(--border); border-radius: 12px; padding: 20px 24px; border-left: 4px solid var(--border); transition: border-color .2s; }
  .corpus-card:hover { border-color: var(--border-hover); }

  .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .card-domain { font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; padding: 3px 8px; border-radius: 4px; border: 1px solid; font-weight: 600; }
  .card-tier { font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; padding: 3px 8px; border-radius: 4px; border: 1px solid; font-weight: 600; }
  .card-tier.unrated { color: var(--text-3); background: transparent; border-color: var(--border); }

  .card-title { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 700; color: var(--text-0); line-height: 1.3; margin-bottom: 4px; }
  .card-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-3); margin-bottom: 10px; }

  .card-summary { font-family: 'Inter', sans-serif; font-size: 13px; color: var(--text-2); line-height: 1.55; margin-bottom: 12px; }

  .card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .card-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--text-3); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border); text-transform: lowercase; }

  .card-extractables { margin-bottom: 12px; }
  .card-ext-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-3); margin-bottom: 6px; }
  .card-extractables ol { padding-left: 18px; font-family: 'Inter', sans-serif; font-size: 12px; color: var(--text-2); line-height: 1.6; }
  .card-extractables li { margin-bottom: 2px; }
  .card-extractables li::marker { color: var(--text-3); }

  .card-link { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--amber); display: inline-flex; align-items: center; gap: 4px; transition: opacity .15s; }
  .card-link:hover { opacity: .75; text-decoration: underline; }

  /* ── Empty state ── */
  .empty-state { text-align: center; padding: 60px 20px; color: var(--text-3); font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .empty-state .empty-icon { font-size: 32px; margin-bottom: 12px; opacity: .4; }

  .card-hidden { display: none !important; }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .topbar { padding: 0 16px; }
    .topbar-tabs { gap: 2px; }
    .topbar-tab { font-size: 9px; padding: 5px 8px; letter-spacing: 1px; }
    .page { padding: 24px 16px 60px; }
    .page-title { font-size: 24px; }
    .stats-bar { gap: 12px; padding: 10px 12px; }
    .card-grid { grid-template-columns: 1fr; }
    .corpus-card { padding: 16px; }
    .card-title { font-size: 15px; }
  }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar{width:6px}
  ::-webkit-scrollbar-track{background:var(--bg-0)}
  ::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
</style>
</head>
<body>
<div class="topbar">
  <div class="topbar-left">
    <a href="index.html" class="logo"><div class="logo-mark">GM</div>GM <span>Research</span></a>
    <div class="topbar-sep"></div>
    <div class="topbar-tabs">
      <a href="index.html" class="topbar-tab">Intelligence Archive</a>
      <a href="visualizations.html" class="topbar-tab">Visualizations</a>
      <a href="wyckoff.html" class="topbar-tab">Wyckoff</a>
      <a href="corpus.html" class="topbar-tab active">Corpus</a>
    </div>
  </div>
  <div class="topbar-right">
    <button class="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark mode"><span class="icon-moon">&#x1F319;</span><span class="icon-sun">&#x2600;&#xFE0F;</span></button>
  </div>
</div>

<div class="page">
  <div class="page-header">
    <div class="page-label">Knowledge Base</div>
    <div class="page-title">Corpus</div>
    <div class="page-sub">Curated sources across trading, AI, legal, biohacking, and more.</div>
  </div>

  <div class="stats-bar">
    <div class="stat">Total: <b>${sources.length} source${sources.length !== 1 ? 's' : ''}</b></div>
    <div class="stat">Domains: <b>${activeDomains} active</b></div>
    <div class="stat">Top tier: <b>${topTier || 'N/A'}</b></div>
    <div class="stat">Last updated: <b>${today}</b></div>
  </div>

  <div class="search-wrap">
    <input type="text" class="search-input" id="corpus-search" placeholder="Search sources by title, summary, or tags..." autocomplete="off">
  </div>

  <div class="filter-bar">
    ${filterHTML}
  </div>

  <div class="card-grid" id="card-grid">
    ${sources.length > 0 ? cardsHTML : `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">&#x1F4DA;</div>
        <div>No sources ingested yet.</div>
        <div style="margin-top:4px;opacity:.6">Add sources to the corpus to see them here.</div>
      </div>`}
  </div>
</div>

<script>
// Theme persistence
(function(){var s=localStorage.getItem('gm-theme');if(s)document.documentElement.setAttribute('data-theme',s)})();
function toggleTheme(){var h=document.documentElement,c=h.getAttribute('data-theme'),n=c==='light'?'dark':'light';h.setAttribute('data-theme',n);localStorage.setItem('gm-theme',n)}

// Domain filtering
(function(){
  var activeDomain = 'all';
  document.querySelectorAll('.domain-pill').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.domain-pill').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      activeDomain = btn.dataset.domain;
      applyFilters();
    });
  });

  var searchInput = document.getElementById('corpus-search');
  if (searchInput) {
    searchInput.addEventListener('input', function(){ applyFilters(); });
  }

  function applyFilters(){
    var query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    var cards = document.querySelectorAll('.corpus-card');
    var visibleCount = 0;
    cards.forEach(function(card){
      var domainMatch = activeDomain === 'all' || card.dataset.domain === activeDomain;
      var textMatch = true;
      if (query) {
        var text = card.textContent.toLowerCase();
        textMatch = text.indexOf(query) !== -1;
      }
      var show = domainMatch && textMatch;
      card.classList.toggle('card-hidden', !show);
      if (show) visibleCount++;
    });

    // Show/hide empty state
    var grid = document.getElementById('card-grid');
    var emptyEl = grid.querySelector('.empty-state');
    if (visibleCount === 0 && !emptyEl) {
      var div = document.createElement('div');
      div.className = 'empty-state dynamic-empty';
      div.style.gridColumn = '1/-1';
      div.innerHTML = '<div class="empty-icon">&#x1F50D;</div><div>No sources match your filter.</div>';
      grid.appendChild(div);
    } else if (visibleCount > 0 && emptyEl && emptyEl.classList.contains('dynamic-empty')) {
      emptyEl.remove();
    }
    // Also remove dynamic empty if filters cleared
    var dynEmpty = grid.querySelector('.dynamic-empty');
    if (dynEmpty && visibleCount > 0) dynEmpty.remove();
  }
})();
</script>
</body>
</html>`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const sources = collectSources();

// Domain counts for console output
const domainCounts = {};
for (const s of sources) {
  domainCounts[s.domain] = (domainCounts[s.domain] || 0) + 1;
}

fs.writeFileSync(OUTPUT_FILE, buildHTML(sources));

console.log(`corpus.html written -- ${sources.length} source(s)`);
if (Object.keys(domainCounts).length > 0) {
  console.log('  Per domain:');
  for (const [domain, count] of Object.entries(domainCounts).sort()) {
    console.log(`    ${domain}: ${count}`);
  }
}
if (sources.length === 0) {
  console.log('  (no sources found -- page will show empty state)');
}

// Warnings
const unrated = sources.filter(s => !s.tier);
if (unrated.length > 0) {
  console.log(`  ${unrated.length} source(s) unrated: ${unrated.map(s => s.title || '(untitled)').join(', ')}`);
}
const noSummary = sources.filter(s => !s.summary);
if (noSummary.length > 0) {
  console.log(`  ${noSummary.length} source(s) missing summary`);
}
