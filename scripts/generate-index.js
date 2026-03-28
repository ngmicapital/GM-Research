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
  'market-briefing':   { title:'The Morning Edge', subtitle:'Market Intelligence',   icon:'&#x1F4C8;',         accent:'#22c55e', accentDim:'#22c55e18', typeLabel:'Morning Edge', filename:'market-briefing.html', preview:'BTC, equities, macro, crypto derivatives & prediction markets' },
  'legal-brief':       { title:'The Brief',        subtitle:'Legal Intelligence',    icon:'&#x2696;&#xFE0F;',  accent:'#60a5fa', accentDim:'#60a5fa18', typeLabel:'The Brief',    filename:'legal-brief.html', preview:'Crypto regulation, enforcement actions & legislative tracker' },
  'ai-briefing':       { title:'AI Intelligence',   subtitle:'Models & Strategy',     icon:'&#x1F916;',         accent:'#a78bfa', accentDim:'#a78bfa18', typeLabel:'AI Update',    filename:'ai-briefing.html', preview:'Model releases, benchmarks, AI x Crypto & research papers' },
  'biohacker-report':  { title:'Biohacker Report',  subtitle:'Health & Longevity',    icon:'&#x1F9EC;',         accent:'#2dd4bf', accentDim:'#2dd4bf18', typeLabel:'Biohacker',    filename:'biohacker-report.html', preview:'Longevity science, training protocols & daily wisdom' },
};
const ORDER = ['market-briefing', 'legal-brief', 'ai-briefing', 'biohacker-report'];

function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function formatDate(ds) {
  const d = new Date(`${ds}T12:00:00Z`);
  return d.toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
}

// ─── Card HTML generators ────────────────────────────────────────────────────

function briefingCard(date, key) {
  const m = BRIEFING_META[key];
  return `
      <a href="briefings/${date}/${m.filename}" class="card-row">
        <div class="card-accent" style="background:${m.accent}"></div>
        <div class="card-body">
          <div class="card-icon" style="background:${m.accentDim}">${m.icon}</div>
          <div class="card-type" style="color:${m.accent}">${m.typeLabel}</div>
          <div class="card-mid"><div class="card-title">${m.title} — ${m.subtitle}</div><div class="card-preview">${m.preview}</div></div>
          <div class="card-arrow">&#x203A;</div>
        </div>
      </a>`;
}

function transcriptCard(t) {
  const folder = t.slug;
  const date = t.date;
  return `
      <a href="transcripts/${folder}/index.html" class="card-row">
        <div class="card-accent" style="background:#f59e0b"></div>
        <div class="card-body">
          <div class="card-icon" style="background:#f59e0b18">&#x1F3A5;</div>
          <div class="card-type" style="color:#f59e0b">Transcript</div>
          <div class="card-mid">
            <div class="card-title">${escapeHtml(t.title)}</div>
            <div class="card-preview">${escapeHtml(t.source)} &middot; ${escapeHtml(t.domain)}</div>
          </div>
          <div class="card-arrow">&#x203A;</div>
        </div>
      </a>`;
}

function dateGroupHTML(date, briefings, transcripts, isToday) {
  const bCount = briefings.length, tCount = transcripts.length;
  const parts = [];
  if (bCount) parts.push(`${bCount} briefing${bCount>1?'s':''}`);
  if (tCount) parts.push(`${tCount} transcript${tCount>1?'s':''}`);
  return `
    <div class="date-group">
      <div class="date-header">
        <span>${formatDate(date)}${isToday?' <span class="today-badge">TODAY</span>':''}</span>
        <span class="date-count">${parts.join(' &middot; ')}</span>
      </div>
      ${briefings.map(k => briefingCard(date, k)).join('')}
      ${transcripts.map(t => transcriptCard(t)).join('')}
      <div class="date-group-pad"></div>
    </div>`;
}

// ─── Build full HTML ─────────────────────────────────────────────────────────

function buildHTML(briefingEntries, transcriptsByDate) {
  const totalBriefings = briefingEntries.reduce((n,e) => n + e.briefings.length, 0);
  const totalTranscripts = Object.values(transcriptsByDate).reduce((n,arr) => n + arr.length, 0);
  const allDates = [...new Set([...briefingEntries.map(e=>e.date), ...Object.keys(transcriptsByDate)])].sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  const todayDisplay = new Date().toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).toUpperCase();

  const briefingMap = {};
  briefingEntries.forEach(e => { briefingMap[e.date] = e.briefings; });

  // Heatmap
  const hm = [];
  for (let i=29;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const ds=d.toISOString().split('T')[0];
    const c=(briefingMap[ds]?.length||0)+(transcriptsByDate[ds]?.length||0);
    hm.push(`<div class="hm${c===0?'':c<=2?' l1':c<=3?' l2':' l3'}"></div>`);}

  // Category counts
  const cc={};ORDER.forEach(k=>{cc[k]=0;});
  briefingEntries.forEach(e=>{e.briefings.forEach(b=>{cc[b]=(cc[b]||0)+1;});});

  // Keywords — static curated list tied to briefing types present
  const keywordPool = [
    { kw:'BTC',        types:['market-briefing'], weight:3 },
    { kw:'Gold',       types:['market-briefing'], weight:2 },
    { kw:'SPX',        types:['market-briefing'], weight:1 },
    { kw:'VIX',        types:['market-briefing'], weight:1 },
    { kw:'Tariffs',    types:['market-briefing'], weight:1 },
    { kw:'SEC',        types:['legal-brief'],     weight:3 },
    { kw:'MiCA',       types:['legal-brief'],     weight:2 },
    { kw:'Ripple',     types:['legal-brief'],     weight:1 },
    { kw:'Stablecoin', types:['legal-brief'],     weight:1 },
    { kw:'GENIUS Act', types:['legal-brief'],     weight:1 },
    { kw:'Claude',     types:['ai-briefing'],     weight:2 },
    { kw:'Gemini',     types:['ai-briefing'],     weight:1 },
    { kw:'GPT',        types:['ai-briefing'],     weight:1 },
    { kw:'Open Source', types:['ai-briefing'],    weight:1 },
    { kw:'Creatine',   types:['biohacker-report'],weight:2 },
    { kw:'GLP-1',      types:['biohacker-report'],weight:1 },
    { kw:'Zone 2',     types:['biohacker-report'],weight:1 },
    { kw:'Sleep',      types:['biohacker-report'],weight:1 },
  ];
  // Count how many briefings of each type exist
  const typeCount = {};
  briefingEntries.forEach(e => { e.briefings.forEach(b => { typeCount[b] = (typeCount[b]||0) + 1; }); });
  // Build keyword list with counts based on how many briefings of that type exist
  const keywords = keywordPool
    .map(k => ({ kw: k.kw, count: k.types.reduce((n,t) => n + (typeCount[t]||0), 0) * k.weight, hot: k.weight >= 3 }))
    .filter(k => k.count > 0)
    .sort((a,b) => b.count - a.count);
  const kwHTML = keywords.map(k =>
    `<span class="kw${k.hot?' hot':''}">${k.kw}<span class="kw-count">${k.count}</span></span>`
  ).join('');

  const feedHTML = allDates.map(date =>
    dateGroupHTML(date, briefingMap[date]||[], transcriptsByDate[date]||[], date===today)
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GM Research — Intelligence Archive</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg-0:#06060a;--bg-1:#0a0a10;--bg-2:#0e0e16;--bg-3:#13131d;--border:#1a1a28;--border-hover:#2a2a3d;--text-0:#fff;--text-1:#c8c8d4;--text-2:#8888a0;--text-3:#55556a;--amber:#f59e0b;--amber-dim:#f59e0b18;--green:#22c55e;--green-dim:#22c55e18;--blue:#60a5fa;--blue-dim:#60a5fa18;--purple:#a78bfa;--purple-dim:#a78bfa18;--teal:#2dd4bf;--teal-dim:#2dd4bf18;--topbar-bg:rgba(10,10,16,0.8);--hero-grad-from:#0e0e16;--hero-glow:rgba(245,158,11,0.04);--hm-l1:#1a3320;--hm-l2:#1f5c2e;--scrollbar-track:#06060a}
[data-theme="light"]{--bg-0:#f5f5f7;--bg-1:#fff;--bg-2:#f0f0f3;--bg-3:#e8e8ee;--border:#d4d4dc;--border-hover:#b8b8c4;--text-0:#111118;--text-1:#333340;--text-2:#66667a;--text-3:#9999aa;--amber:#d97706;--amber-dim:#d9770615;--green:#16a34a;--green-dim:#16a34a12;--blue:#2563eb;--blue-dim:#2563eb12;--purple:#7c3aed;--purple-dim:#7c3aed12;--teal:#0d9488;--teal-dim:#0d948812;--topbar-bg:rgba(255,255,255,0.85);--hero-grad-from:#ebebf0;--hero-glow:rgba(245,158,11,0.06);--hm-l1:#bbf7d0;--hm-l2:#4ade80;--scrollbar-track:#f5f5f7}
*{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth}
body{background:var(--bg-0);color:var(--text-1);font-family:'Inter',-apple-system,sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:0 40px;height:56px;border-bottom:1px solid var(--border);background:var(--topbar-bg);backdrop-filter:blur(20px) saturate(1.4);-webkit-backdrop-filter:blur(20px) saturate(1.4);position:sticky;top:0;z-index:100}
.topbar-left{display:flex;align-items:center;gap:16px}
.logo{font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:var(--text-0);letter-spacing:-.5px;display:flex;align-items:center;gap:10px;text-decoration:none}
.logo-mark{width:28px;height:28px;border-radius:6px;background:linear-gradient(135deg,var(--amber),#d97706);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#000}
.logo span{color:var(--amber)}
.topbar-sep{width:1px;height:20px;background:var(--border)}
.topbar-tabs{display:flex;gap:4px}
.topbar-tab{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px;text-decoration:none;padding:6px 12px;border-radius:5px;transition:all .2s}
.topbar-tab:hover{color:var(--text-1);background:var(--bg-3)}
.topbar-tab.active{color:var(--text-0);background:var(--bg-3);border:1px solid var(--border)}
.topbar-right{display:flex;gap:16px;align-items:center}
.topbar-date{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-3)}
.live-label{font-size:10px;color:var(--green);font-family:'JetBrains Mono',monospace;display:flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:1px;background:var(--green-dim);padding:4px 10px;border-radius:4px;border:1px solid rgba(34,197,94,0.15)}
.live-dot{width:5px;height:5px;background:var(--green);border-radius:50%;box-shadow:0 0 8px var(--green);animation:pulse 2.5s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.theme-toggle{width:36px;height:36px;border-radius:8px;border:1px solid var(--border);background:var(--bg-3);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;color:var(--text-2);transition:all .2s}
.theme-toggle:hover{border-color:var(--border-hover)}.theme-toggle .icon-sun{display:none}.theme-toggle .icon-moon{display:block}
[data-theme="light"] .theme-toggle .icon-sun{display:block}[data-theme="light"] .theme-toggle .icon-moon{display:none}
[data-theme="light"] .theme-toggle{background:var(--bg-1)}[data-theme="light"] .logo-mark{background:linear-gradient(135deg,#d97706,#b45309)}
[data-theme="light"] .card-row:hover{background:linear-gradient(90deg,var(--bg-3),var(--bg-1))}
.hero{padding:28px 40px 24px;background:linear-gradient(180deg,var(--hero-grad-from),var(--bg-0));position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-120px;left:50%;transform:translateX(-50%);width:800px;height:400px;background:radial-gradient(ellipse,var(--hero-glow),transparent 70%);pointer-events:none}
.hero-top{display:flex;align-items:flex-end;justify-content:space-between}
.hero-label{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:3px;color:var(--amber);margin-bottom:6px;opacity:.8}
.hero-title{font-size:32px;font-weight:800;color:var(--text-0);letter-spacing:-1.5px;line-height:1}
.hero-title span{color:var(--text-3);font-weight:400}
.heatmap-section{padding:20px 40px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:24px}
.heatmap-label{font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px;font-family:'JetBrains Mono',monospace;white-space:nowrap;min-width:80px}
.heatmap{display:flex;gap:3px;flex:1}.hm{flex:1;height:6px;border-radius:2px;background:var(--bg-3);min-width:4px;transition:all .2s}.hm:hover{transform:scaleY(2)}
.hm.l1{background:var(--hm-l1)}.hm.l2{background:var(--hm-l2)}.hm.l3{background:var(--green);box-shadow:0 0 6px rgba(34,197,94,0.25)}
[data-theme="light"] .hm.l3{box-shadow:none}
.heatmap-legend{display:flex;align-items:center;gap:6px;white-space:nowrap;font-size:10px;color:var(--text-3);font-family:'JetBrains Mono',monospace}
.legend-sq{width:8px;height:8px;border-radius:2px}
.keywords-section{padding:18px 40px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:24px}
.keywords-label{font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px;font-family:'JetBrains Mono',monospace;white-space:nowrap;min-width:80px;padding-top:5px}
.keywords-cloud{display:flex;flex-wrap:wrap;gap:6px;flex:1}
.kw{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;padding:4px 12px;border-radius:5px;transition:all .2s;border:1px solid var(--border);background:var(--bg-1);color:var(--text-2);text-decoration:none;cursor:pointer}
.kw:hover{border-color:var(--border-hover);color:var(--text-0);background:var(--bg-3)}
.kw.hot{color:var(--amber);border-color:rgba(245,158,11,0.25);background:var(--amber-dim)}.kw.hot:hover{border-color:var(--amber)}
.kw-count{font-size:9px;color:var(--text-3);margin-left:4px;font-weight:400}
[data-theme="light"] .kw{box-shadow:0 1px 2px rgba(0,0,0,.04)}
.filter-bar{display:flex;align-items:center;gap:6px;padding:14px 40px;border-bottom:1px solid var(--border);background:var(--bg-1)}
.filter-chip{padding:5px 14px;border-radius:20px;font-size:11px;font-weight:500;cursor:pointer;transition:all .2s;border:1px solid var(--border);background:transparent;color:var(--text-2)}
.filter-chip:hover{border-color:var(--border-hover);color:var(--text-1)}
.filter-chip.active{background:var(--text-0);color:var(--bg-0);border-color:var(--text-0);font-weight:600}
.filter-chip.c-m{color:var(--green);border-color:rgba(34,197,94,0.2)}.filter-chip.c-m:hover{background:var(--green-dim)}
.filter-chip.c-l{color:var(--blue);border-color:rgba(96,165,250,0.2)}.filter-chip.c-l:hover{background:var(--blue-dim)}
.filter-chip.c-a{color:var(--purple);border-color:rgba(167,139,250,0.2)}.filter-chip.c-a:hover{background:var(--purple-dim)}
.filter-chip.c-b{color:var(--teal);border-color:rgba(45,212,191,0.2)}.filter-chip.c-b:hover{background:var(--teal-dim)}
.filter-chip.c-t{color:var(--amber);border-color:rgba(245,158,11,0.2);margin-left:auto}.filter-chip.c-t:hover{background:var(--amber-dim)}
.filter-count{font-family:'JetBrains Mono',monospace;font-size:9px;background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:8px;margin-left:4px}
.feed{padding:0}.date-group{border-bottom:1px solid var(--border)}
.date-header{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:2px;padding:20px 40px 12px;display:flex;justify-content:space-between;align-items:center}
.today-badge{background:linear-gradient(135deg,var(--amber),#d97706);color:#000;font-size:9px;font-weight:700;padding:3px 10px;border-radius:4px;letter-spacing:1px;box-shadow:0 2px 8px rgba(245,158,11,0.2)}
[data-theme="light"] .today-badge{box-shadow:0 2px 8px rgba(217,119,6,0.2)}
.date-count{font-size:10px;color:var(--text-3);letter-spacing:0;text-transform:none}
.card-row{display:flex;align-items:stretch;margin:0 24px;border-radius:8px;transition:all .2s;cursor:pointer;text-decoration:none;color:inherit}
.card-row:hover{background:linear-gradient(90deg,var(--bg-3),var(--bg-2))}.card-row+.card-row{margin-top:2px}
.card-accent{width:3px;border-radius:3px;flex-shrink:0;margin:8px 0;opacity:.7;transition:opacity .2s}.card-row:hover .card-accent{opacity:1}
.card-body{flex:1;display:flex;align-items:center;padding:14px 16px}
.card-icon{width:32px;height:32px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;margin-right:14px;flex-shrink:0}
.card-type{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.2px;width:120px;flex-shrink:0;font-family:'JetBrains Mono',monospace}
.card-mid{flex:1;min-width:0}
.card-title{font-size:13px;font-weight:500;color:var(--text-0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-preview{font-size:12px;color:var(--text-3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-row:hover .card-preview{color:var(--text-2)}
.card-arrow{color:var(--text-3);font-size:18px;padding:0 4px 0 16px;transition:all .2s;opacity:0}
.card-row:hover .card-arrow{opacity:1;color:var(--amber);transform:translateX(2px)}
.date-group-pad{height:16px}
.footer{padding:32px 40px;border-top:1px solid var(--border);display:flex;align-items:center;margin-top:20px}
.footer-left{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-3);display:flex;align-items:center;gap:12px}
.footer-left a{color:var(--text-2);text-decoration:none}.footer-left a:hover{color:var(--amber)}
.footer-dot{width:3px;height:3px;border-radius:50%;background:var(--text-3)}
.empty{text-align:center;padding:60px 20px}.empty-h{font-size:1rem;font-weight:600;color:var(--text-2);margin-bottom:8px}.empty-b{font-size:.82rem;color:var(--text-3)}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--scrollbar-track)}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
@media(max-width:900px){.card-type{width:100px}}
@media(max-width:600px){.topbar,.hero,.filter-bar,.date-header,.heatmap-section,.keywords-section,.footer{padding-left:20px;padding-right:20px}.card-row{margin:0 12px}.hero-top{flex-direction:column;gap:12px}.card-preview,.card-icon{display:none}.topbar-date{display:none}}
</style>
</head>
<body>
<div class="topbar">
  <div class="topbar-left">
    <a href="index.html" class="logo"><div class="logo-mark">GM</div>GM <span>Research</span></a>
    <div class="topbar-sep"></div>
    <div class="topbar-tabs">
      <a href="index.html" class="topbar-tab active">Intelligence Archive</a>
      <a href="visualizations.html" class="topbar-tab">Visualizations</a>
    </div>
  </div>
  <div class="topbar-right">
    <div class="topbar-date">${todayDisplay}</div>
    <div class="live-label"><div class="live-dot"></div> Live</div>
    <button class="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark mode"><span class="icon-moon">&#x1F319;</span><span class="icon-sun">&#x2600;&#xFE0F;</span></button>
  </div>
</div>
<div class="hero">
  <div class="hero-top">
    <div>
      <div class="hero-label">Daily Intelligence</div>
      <div class="hero-title">Briefings <span>&amp;</span> Transcripts</div>
    </div>
  </div>
</div>
<div class="heatmap-section">
  <div class="heatmap-label">Activity</div>
  <div class="heatmap">${hm.join('')}</div>
  <div class="heatmap-legend"><span>Less</span><div class="legend-sq" style="background:var(--bg-3)"></div><div class="legend-sq" style="background:var(--hm-l1)"></div><div class="legend-sq" style="background:var(--hm-l2)"></div><div class="legend-sq" style="background:var(--green)"></div><span>More</span></div>
</div>
<div class="keywords-section">
  <div class="keywords-label">Trending</div>
  <div class="keywords-cloud">${kwHTML}</div>
</div>
<div class="filter-bar">
  <div class="filter-chip active">All<span class="filter-count">${totalBriefings+totalTranscripts}</span></div>
  <div class="filter-chip c-m">Market<span class="filter-count">${cc['market-briefing']}</span></div>
  <div class="filter-chip c-l">Legal<span class="filter-count">${cc['legal-brief']}</span></div>
  <div class="filter-chip c-a">AI<span class="filter-count">${cc['ai-briefing']}</span></div>
  <div class="filter-chip c-b">Biohacker<span class="filter-count">${cc['biohacker-report']}</span></div>
  <div class="filter-chip c-t">Transcripts<span class="filter-count">${totalTranscripts}</span></div>
</div>
<div class="feed">
${feedHTML||'<div class="empty"><p class="empty-h">No briefings yet</p></div>'}
</div>
<div class="footer"><div class="footer-left"><a href="https://github.com/ngmicapital/GM-Research" target="_blank">ngmicapital/GM-Research</a><div class="footer-dot"></div><span>Updated daily</span><div class="footer-dot"></div><span>Powered by Claude</span></div></div>
<script>
function toggleTheme(){var h=document.documentElement,c=h.getAttribute('data-theme'),n=c==='light'?'dark':'light';h.setAttribute('data-theme',n);localStorage.setItem('gm-theme',n)}
(function(){var s=localStorage.getItem('gm-theme');if(s)document.documentElement.setAttribute('data-theme',s)})();
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
