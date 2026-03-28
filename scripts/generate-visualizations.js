#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT          = path.join(__dirname, '..');
const BRIEFINGS_DIR = path.join(ROOT, 'briefings');
const OUTPUT_FILE   = path.join(ROOT, 'visualizations.html');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(s) {
  return s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&times;/g, '×').replace(/\s+/g, ' ').trim();
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatShortDate(ds) {
  const d = new Date(`${ds}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatDayLabel(ds) {
  const d = new Date(`${ds}T12:00:00Z`);
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

// ─── Read all briefings ──────────────────────────────────────────────────────

const TYPES = {
  'market-briefing':  { file: 'market-briefing.html', label: 'Morning Edge', color: 'green', accent: '#22c55e' },
  'legal-brief':      { file: 'legal-brief.html',     label: 'The Brief',    color: 'blue',  accent: '#60a5fa' },
  'ai-briefing':      { file: 'ai-briefing.html',     label: 'AI Update',    color: 'purple', accent: '#a78bfa' },
  'biohacker-report': { file: 'biohacker-report.html', label: 'Biohacker',   color: 'teal',  accent: '#2dd4bf' },
};

// Collect all date folders sorted descending
const dateFolders = fs.existsSync(BRIEFINGS_DIR)
  ? fs.readdirSync(BRIEFINGS_DIR).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort().reverse()
  : [];

// Read all briefing HTML indexed by date and type
const briefings = {}; // { date: { type: htmlContent } }
for (const date of dateFolders) {
  briefings[date] = {};
  for (const [key, meta] of Object.entries(TYPES)) {
    const fp = path.join(BRIEFINGS_DIR, date, meta.file);
    if (fs.existsSync(fp)) {
      briefings[date][key] = fs.readFileSync(fp, 'utf8');
    }
  }
}

const dates = Object.keys(briefings).sort(); // ascending for charts

// ─── 1. BTC PRICE & SENTIMENT TIMELINE ──────────────────────────────────────

function extractBtcPrice(html) {
  if (!html) return null;
  const text = stripHtml(html);
  // Look for BTC price patterns
  const patterns = [
    // "$68,809" or "$66,000" near BTC
    /BTC\s+(?:at\s+|sits\s+at\s+|trading\s+at\s+|hovering\s+(?:at\s+|around\s+)?|near\s+)?\$([0-9,]+(?:\.\d+)?)\b/i,
    /Bitcoin\s+(?:at\s+|sits\s+at\s+|trading\s+at\s+|hovering\s+(?:at\s+|around\s+)?|near\s+)?\$([0-9,]+(?:\.\d+)?)\b/i,
    // "$66K" shorthand near BTC
    /BTC\s+(?:at\s+|sits\s+at\s+|trading\s+at\s+|hovering\s+(?:at\s+|around\s+)?|near\s+)?\$([0-9]+(?:\.\d+)?)[Kk]\b/i,
    /\$([0-9,]+(?:\.\d+)?)\s*(?:BTC|Bitcoin)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      let price = parseFloat(m[1].replace(/,/g, ''));
      // Handle K shorthand
      if (m[0].match(/[Kk]\b/) && price < 1000) price *= 1000;
      if (price > 10000 && price < 500000) return price;
    }
  }
  return null;
}

function extractOutlook(html) {
  if (!html) return null;
  // Match the HTML element: class="outlook-badge">Text</span>
  const m = html.match(/class="outlook-badge"[^>]*>([^<]+)/i);
  if (m) {
    const val = m[1].trim().toLowerCase();
    if (val) return val;
  }
  return null;
}

function extractFearGreed(html) {
  if (!html) return null;
  const text = stripHtml(html);
  // Pattern: "Fear & Greed" near a number like "13" or "14 — Extreme Fear"
  const patterns = [
    /Fear\s*&\s*Greed\D{0,30}?(\d{1,3})\s*(?:\/100)?/i,
    /(\d{1,3})\s*(?:\/100)?\s*\(?(?:Extreme\s+)?(?:Fear|Greed|Neutral)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const val = parseInt(m[1]);
      if (val >= 0 && val <= 100) return val;
    }
  }
  return null;
}

function getSentimentClass(score) {
  if (score <= 20) return 's-extreme-fear';
  if (score <= 40) return 's-fear';
  if (score <= 60) return 's-neutral';
  if (score <= 80) return 's-greed';
  return 's-extreme-greed';
}

function getSentimentWord(score) {
  if (score <= 20) return 'Extreme Fear';
  if (score <= 40) return 'Fear';
  if (score <= 60) return 'Neutral';
  if (score <= 80) return 'Greed';
  return 'Extreme Greed';
}

function getSentimentEmoji(score) {
  if (score <= 20) return '&#x1F631;';
  if (score <= 40) return '&#x1F628;';
  if (score <= 60) return '&#x1F610;';
  if (score <= 80) return '&#x1F929;';
  return '&#x1F911;';
}

// ─── 2. ASSET MENTION TRACKER ────────────────────────────────────────────────

const TRACKED_ASSETS = ['BTC', 'Gold', 'SPX', 'ETH', 'SOL', 'WTI', 'DXY', 'VIX'];

function countAssetMentions(html) {
  const counts = {};
  const text = stripHtml(html);
  for (const asset of TRACKED_ASSETS) {
    const re = new RegExp(`\\b${asset}\\b`, 'gi');
    const matches = text.match(re);
    counts[asset] = matches ? matches.length : 0;
  }
  // Also match "Bitcoin" for BTC and "S&P" or "S&P 500" for SPX
  const btcExtra = (text.match(/\bBitcoin\b/gi) || []).length;
  counts['BTC'] = (counts['BTC'] || 0) + btcExtra;
  const spxExtra = (text.match(/\bS&P\s*500?\b/gi) || []).length;
  counts['SPX'] = (counts['SPX'] || 0) + spxExtra;
  return counts;
}

// ─── 4. REGULATORY RADAR ────────────────────────────────────────────────────

const TRACKED_REGULATORS = [
  { name: 'SEC',  color: 'blue',   rgb: '96,165,250' },
  { name: 'CFTC', color: 'purple', rgb: '167,139,250' },
  { name: 'ESMA', color: 'amber',  rgb: '245,158,11' },
  { name: 'FCA',  color: 'teal',   rgb: '45,212,191' },
  { name: 'MAS',  color: 'red',    rgb: '239,68,68' },
  { name: 'ASIC', color: 'green',  rgb: '34,197,94' },
  { name: 'OCC',  color: 'blue',   rgb: '96,165,250' },
  { name: 'DOJ',  color: 'red',    rgb: '239,68,68' },
];

function countRegulatorMentions(html) {
  const text = stripHtml(html);
  const counts = {};
  for (const reg of TRACKED_REGULATORS) {
    const re = new RegExp(`\\b${reg.name}\\b`, 'g');
    const matches = text.match(re);
    counts[reg.name] = matches ? matches.length : 0;
  }
  return counts;
}

// ─── 5. LEGISLATION PIPELINE ─────────────────────────────────────────────────

function extractLegislation(html) {
  const items = [];
  if (!html) return items;
  // Extract story titles from legal briefs
  const re = /story-title[^>]*>([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    let title = stripHtml(m[1]);
    // Shorten overly long titles at first " — " or ": "
    const dashIdx = title.indexOf(' — ');
    if (dashIdx > 10 && dashIdx < 80) title = title.slice(0, dashIdx);
    else if (title.length > 80) title = title.slice(0, 77) + '...';
    items.push(title);
  }
  return items;
}

// Classify legislation items into pipeline stages
function classifyStage(title) {
  const t = title.toLowerCase();
  if (/settle|plea|guilty|ordered|fine|penalt|monitor|consent/i.test(t)) return 'resolved';
  if (/enforce|charged|sued|indic|sanction|misclass/i.test(t)) return 'enforcement';
  if (/propos|introduc|draft|comment\s*period|markup|bill|act\b/i.test(t)) return 'proposed';
  return 'in-progress';
}

function getTagClass(title) {
  const t = title.toLowerCase();
  if (/\bact\b|bill|legislat/i.test(t)) return 'ptag-bill';
  if (/case|v\.\s|settle|enforce|order|charged|sued|misclass/i.test(t)) return 'ptag-case';
  if (/eu\b|mica|esma/i.test(t)) return 'ptag-eu';
  return 'ptag-rule';
}

function getTagLabel(title) {
  const t = title.toLowerCase();
  if (/\bact\b|bill|legislat/i.test(t)) return 'Bill';
  if (/case|v\.\s|settle|enforce|order|charged|sued|misclass/i.test(t)) return 'Case';
  if (/eu\b|mica|esma/i.test(t)) return 'EU Reg';
  return 'Rulemaking';
}

// ─── 6. KEYWORD VELOCITY ─────────────────────────────────────────────────────

const VELOCITY_KEYWORDS = [
  'BTC', 'Gold', 'SEC', 'MiCA', 'Tariff', 'VIX', 'Claude', 'GPT',
  'Stablecoin', 'ETH', 'CFTC', 'Creatine', 'GLP-1', 'NVIDIA', 'Oil',
  'DeFi', 'ETF', 'Ripple', 'GENIUS', 'Sleep',
];

function countKeywordInAllBriefings(date, keyword) {
  let total = 0;
  for (const [, html] of Object.entries(briefings[date] || {})) {
    const text = stripHtml(html);
    // Special case multi-word and variants
    let re;
    if (keyword === 'Tariff') re = /\btariff/gi;
    else if (keyword === 'Oil') re = /\b(?:WTI|Brent|oil)\b/gi;
    else if (keyword === 'ETF') re = /\bETF/g;
    else if (keyword === 'DeFi') re = /\bDeFi\b/gi;
    else re = new RegExp(`\\b${keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
    const matches = text.match(re);
    total += matches ? matches.length : 0;
  }
  return total;
}

// ─── 7. NARRATIVE THREADS ────────────────────────────────────────────────────

// Themes that can cross briefing types
const CROSS_THEMES = [
  { topic: 'Stablecoin Regulation', keywords: ['stablecoin', 'GENIUS', 'CLARITY', 'stablecoin regulation'], types: ['market-briefing', 'legal-brief'] },
  { topic: 'AI Infrastructure', keywords: ['Claude', 'GPT', 'NVIDIA', 'AI infrastructure', 'GPU', 'semiconductor'], types: ['ai-briefing', 'market-briefing'] },
  { topic: 'GLP-1 & Metabolic Health', keywords: ['GLP-1', 'Ozempic', 'semaglutide', 'metabolic'], types: ['biohacker-report', 'market-briefing'] },
  { topic: 'Oil & Geopolitics', keywords: ['WTI', 'Brent', 'oil shock', 'Iran', 'Hormuz'], types: ['market-briefing', 'legal-brief'] },
  { topic: 'Crypto ETFs', keywords: ['ETF', 'IBIT', 'FBTC', 'GBTC', 'spot ETF'], types: ['market-briefing', 'legal-brief'] },
  { topic: 'DeFi Regulation', keywords: ['DeFi', 'decentralized', 'DEX'], types: ['legal-brief', 'market-briefing'] },
  { topic: 'Tokenization', keywords: ['tokeniz', 'RWA', 'real world asset', 'tokenized'], types: ['legal-brief', 'market-briefing'] },
  { topic: 'BTC Market Structure', keywords: ['BTC', 'Bitcoin', 'halving', 'dominance'], types: ['market-briefing', 'legal-brief'] },
  { topic: 'Sleep & Recovery', keywords: ['sleep', 'HRV', 'recovery', 'circadian'], types: ['biohacker-report', 'ai-briefing'] },
  { topic: 'Open Source AI', keywords: ['open source', 'Llama', 'Mistral', 'open-source'], types: ['ai-briefing', 'market-briefing'] },
];

function findNarrativeThreads() {
  const threads = [];
  for (const date of dates) {
    for (const theme of CROSS_THEMES) {
      const appearances = [];
      for (const type of theme.types) {
        const html = briefings[date]?.[type];
        if (!html) continue;
        const text = stripHtml(html);
        // Check if any keyword from this theme appears
        const found = theme.keywords.some(kw => {
          const re = new RegExp(kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
          return re.test(text);
        });
        if (found) {
          // Extract a context snippet — find a sentence containing the keyword
          let snippet = '';
          for (const kw of theme.keywords) {
            const re = new RegExp(`[^.]*\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b[^.]*\\.`, 'gi');
            const sm = text.match(re);
            if (sm && sm[0]) {
              snippet = sm[0].trim();
              if (snippet.length > 100) snippet = snippet.slice(0, 97) + '...';
              break;
            }
          }
          appearances.push({ type, snippet: snippet || `${theme.topic} mentioned` });
        }
      }
      // Only a "thread" if it appears in 2+ different briefing types on same day
      if (appearances.length >= 2) {
        threads.push({ date, topic: theme.topic, appearances, signal: appearances.length >= 3 ? 'high' : 'med' });
      }
    }
  }
  // Deduplicate: keep latest per topic, limit to 5
  const seen = new Set();
  const unique = [];
  for (const t of threads.reverse()) {
    if (!seen.has(t.topic)) {
      seen.add(t.topic);
      unique.push(t);
    }
  }
  return unique.slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD HTML
// ═══════════════════════════════════════════════════════════════════════════════

function buildVisualizationsHTML() {
  const today = new Date().toISOString().split('T')[0];

  // ── 1. BTC Timeline data ──
  const btcData = [];
  for (const date of dates) {
    const html = briefings[date]?.['market-briefing'];
    const price = extractBtcPrice(html);
    const outlook = extractOutlook(html);
    if (price) btcData.push({ date, price, outlook });
  }

  // ── 2. Asset Mentions ──
  const assetTotals = {};
  const assetDaily = {}; // { asset: [count per date] }
  for (const a of TRACKED_ASSETS) { assetTotals[a] = 0; assetDaily[a] = []; }
  for (const date of dates) {
    // Aggregate across all briefing types
    const dayCounts = {};
    for (const a of TRACKED_ASSETS) dayCounts[a] = 0;
    for (const [, html] of Object.entries(briefings[date] || {})) {
      const counts = countAssetMentions(html);
      for (const a of TRACKED_ASSETS) dayCounts[a] += counts[a] || 0;
    }
    for (const a of TRACKED_ASSETS) {
      assetTotals[a] += dayCounts[a];
      assetDaily[a].push(dayCounts[a]);
    }
  }
  // Sort by total desc, take top 8
  const topAssets = TRACKED_ASSETS.slice().sort((a, b) => assetTotals[b] - assetTotals[a]).filter(a => assetTotals[a] > 0).slice(0, 8);
  const maxAssetCount = Math.max(1, ...topAssets.map(a => assetTotals[a]));

  // ── 3. Sentiment / Fear & Greed ──
  const sentimentData = [];
  for (const date of dates.slice(-7)) { // last 7 days
    const html = briefings[date]?.['market-briefing'];
    const score = extractFearGreed(html);
    sentimentData.push({ date, score });
  }
  // Pad to 7 if needed
  while (sentimentData.length < 7) sentimentData.unshift({ date: '', score: null });

  // ── 4. Regulatory Radar ──
  const regTotals = {};
  for (const reg of TRACKED_REGULATORS) regTotals[reg.name] = 0;
  for (const date of dates) {
    for (const [key, html] of Object.entries(briefings[date] || {})) {
      if (key !== 'legal-brief') continue;
      const counts = countRegulatorMentions(html);
      for (const reg of TRACKED_REGULATORS) regTotals[reg.name] += counts[reg.name] || 0;
    }
  }
  const topRegs = TRACKED_REGULATORS.filter(r => regTotals[r.name] > 0).sort((a, b) => regTotals[b.name] - regTotals[a.name]).slice(0, 6);
  const maxRegCount = Math.max(1, ...topRegs.map(r => regTotals[r.name]));

  // ── 5. Legislation Pipeline ──
  const pipeline = { proposed: [], 'in-progress': [], enforcement: [], resolved: [] };
  const seenTitles = new Set();
  for (const date of dates.slice().reverse()) { // newest first
    const html = briefings[date]?.['legal-brief'];
    const items = extractLegislation(html);
    for (const title of items) {
      const norm = title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seenTitles.has(norm)) continue;
      seenTitles.add(norm);
      const stage = classifyStage(title);
      if (pipeline[stage].length < 4) { // max 4 per column
        pipeline[stage].push({ title, date, tag: getTagLabel(title), tagClass: getTagClass(title) });
      }
    }
  }

  // ── 6. Keyword Velocity ──
  const velocityData = [];
  const latestDate = dates[dates.length - 1];
  const prevDate = dates.length >= 2 ? dates[dates.length - 2] : null;
  for (const kw of VELOCITY_KEYWORDS) {
    const thisCount = latestDate ? countKeywordInAllBriefings(latestDate, kw) : 0;
    const prevCount = prevDate ? countKeywordInAllBriefings(prevDate, kw) : 0;
    if (thisCount > 0 || prevCount > 0) {
      const delta = prevCount > 0 ? Math.round(((thisCount - prevCount) / prevCount) * 100) : (thisCount > 0 ? 999 : 0);
      velocityData.push({ keyword: kw, thisCount, prevCount, delta });
    }
  }
  velocityData.sort((a, b) => b.delta - a.delta);
  const topVelocity = velocityData.slice(0, 8);
  const maxVelocityCount = Math.max(1, ...topVelocity.map(v => Math.max(v.thisCount, v.prevCount)));

  // ── 7. Narrative Threads ──
  const threads = findNarrativeThreads();

  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────

  // 1. BTC Timeline SVG
  let btcChartHTML = '<div style="text-align:center; padding:40px; color:var(--text-3); font-size:13px;">No BTC price data available yet. Publish more market briefings to populate this chart.</div>';
  if (btcData.length > 0) {
    const prices = btcData.map(d => d.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1000;
    const padMin = minP - range * 0.1;
    const padMax = maxP + range * 0.1;
    const padRange = padMax - padMin;
    const svgW = 800;
    const svgH = 190;
    const points = btcData.map((d, i) => {
      const x = btcData.length === 1 ? svgW / 2 : (i / (btcData.length - 1)) * svgW;
      const y = svgH - ((d.price - padMin) / padRange) * svgH;
      return { x, y, date: d.date, price: d.price };
    });
    const polyline = points.map(p => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' ');
    const areaPath = `M${points[0].x.toFixed(0)},${points[0].y.toFixed(0)} ` + points.slice(1).map(p => `L${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' ') + ` L${svgW},${svgH} L0,${svgH} Z`;
    const dots = points.map(p => `<circle cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="3" fill="#f59e0b"/>`).join('\n            ');

    // Y-axis labels
    const ySteps = 5;
    const yLabels = [];
    for (let i = 0; i < ySteps; i++) {
      const val = padMax - (i / (ySteps - 1)) * padRange;
      yLabels.push(`<span>$${(val / 1000).toFixed(0)}K</span>`);
    }

    // X-axis labels
    const xLabels = btcData.map(d => `<span>${formatShortDate(d.date)}</span>`);

    btcChartHTML = `
      <div class="timeline-chart">
        <div class="timeline-y">${yLabels.join('')}</div>
        <div class="timeline-area">
          ${Array.from({length: ySteps}, (_, i) => `<div class="timeline-grid-line" style="top:${(i / (ySteps - 1)) * 100}%"></div>`).join('\n          ')}
          <svg class="timeline-svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none">
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.15"/>
                <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <path d="${areaPath}" fill="url(#priceFill)"/>
            <polyline points="${polyline}" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round"/>
            ${dots}
          </svg>
        </div>
        <div class="timeline-x">${xLabels.join('')}</div>
      </div>
      <div class="wyckoff-labels">
        ${btcData.map(d => {
          if (!d.outlook) return '';
          const ol = d.outlook;
          let cls = 'tag-accum', col = 'green', label = ol.charAt(0).toUpperCase() + ol.slice(1);
          if (ol.includes('bearish')) { cls = 'tag-distrib'; col = 'red'; }
          else if (ol.includes('bullish')) { cls = 'tag-markup'; col = 'amber'; }
          else if (ol.includes('cautious') || ol.includes('neutral')) { cls = 'tag-accum'; col = 'green'; }
          return `<div class="wyckoff-label"><div class="wyckoff-dot" style="background:var(--${col})"></div><span class="wyckoff-tag ${cls}">${formatShortDate(d.date)}: ${escapeHtml(label)}</span></div>`;
        }).filter(Boolean).join('\n        ')}
        <div class="wyckoff-label" style="margin-left:auto; color:var(--text-3); font-family:'JetBrains Mono',monospace; font-size:10px;">${dates.length}-day window</div>
      </div>`;
  }

  // 2. Asset Mention cards
  const assetCardsHTML = topAssets.slice(0, 4).map((asset, i) => {
    const total = assetTotals[asset];
    const pct = (total / maxAssetCount * 100).toFixed(0);
    const cls = i === 0 ? 'high' : (total > maxAssetCount * 0.4 ? 'med' : 'low');
    const barColor = i === 0 ? 'var(--amber)' : (cls === 'med' ? 'var(--text-1)' : 'var(--text-3)');
    const sparkColor = i === 0 ? 'var(--amber)' : (cls === 'med' ? 'var(--text-1)' : 'var(--border)');
    const daily = assetDaily[asset];
    const maxDaily = Math.max(1, ...daily);
    const sparkBars = daily.map(c => {
      const h = Math.max(2, (c / maxDaily * 100));
      return `<div class="asset-spark-bar" style="height:${h}%; background:${sparkColor};"></div>`;
    }).join('\n            ');
    return `
        <div class="asset-card">
          <div class="asset-top">
            <div class="asset-name">${escapeHtml(asset)}</div>
            <div class="asset-count ${cls}">${total}</div>
          </div>
          <div class="asset-bar-track"><div class="asset-bar-fill" style="width:${pct}%; background:${barColor};"></div></div>
          <div class="asset-spark">${sparkBars}</div>
        </div>`;
  }).join('');

  // 3. Sentiment heatmap
  const sentimentHTML = sentimentData.map(d => {
    if (d.score === null) {
      return `
        <div class="sentiment-day" style="opacity:0.4;">
          <div class="sentiment-day-label">${d.date ? formatDayLabel(d.date) : '—'}</div>
          <div class="sentiment-day-date">${d.date ? formatShortDate(d.date) : '—'}</div>
          <div class="sentiment-emoji">&#x2014;</div>
          <div class="sentiment-score">—</div>
          <div class="sentiment-word">No data</div>
        </div>`;
    }
    const isToday = d.date === today;
    return `
        <div class="sentiment-day ${getSentimentClass(d.score)}"${isToday ? ' style="border-color:var(--green);"' : ''}>
          <div class="sentiment-day-label">${formatDayLabel(d.date)}</div>
          <div class="sentiment-day-date">${formatShortDate(d.date)}</div>
          <div class="sentiment-emoji">${getSentimentEmoji(d.score)}</div>
          <div class="sentiment-score">${d.score}</div>
          <div class="sentiment-word">${getSentimentWord(d.score)}</div>
        </div>`;
  }).join('');

  // 4. Regulatory Radar
  // Bubble positions — spread around center
  const radarPositions = [
    { top: '50%', left: '45%' }, { top: '28%', left: '65%' }, { top: '35%', left: '25%' },
    { top: '70%', left: '30%' }, { top: '72%', left: '68%' }, { top: '22%', left: '42%' },
  ];
  const radarBubblesHTML = topRegs.map((reg, i) => {
    const count = regTotals[reg.name];
    const size = Math.max(30, Math.min(72, 30 + (count / maxRegCount) * 42));
    const fontSize = size > 50 ? 13 : (size > 40 ? 11 : 9);
    const pos = radarPositions[i] || { top: '50%', left: '50%' };
    return `
          <div class="radar-bubble" style="width:${size}px; height:${size}px; background:linear-gradient(135deg, rgba(${reg.rgb},0.3), rgba(${reg.rgb},0.1)); border:2px solid rgba(${reg.rgb},0.5); top:${pos.top}; left:${pos.left}; transform:translate(-50%,-50%); font-size:${fontSize}px; color:var(--${reg.color});">
            ${reg.name}<span>${count} mentions</span>
          </div>`;
  }).join('');

  const radarSidebarHTML = topRegs.map(reg => {
    const count = regTotals[reg.name];
    const pct = (count / maxRegCount * 100).toFixed(0);
    return `
          <div class="radar-item">
            <div class="radar-item-dot" style="background:var(--${reg.color});"></div>
            <div class="radar-item-name">${reg.name}</div>
            <div class="radar-item-count">${count}</div>
            <div class="radar-item-bar"><div class="radar-item-fill" style="width:${pct}%; background:var(--${reg.color});"></div></div>
          </div>`;
  }).join('');

  // 5. Legislation Pipeline
  const stageLabels = { proposed: 'Proposed', 'in-progress': 'In Progress', enforcement: 'Enforcement', resolved: 'Resolved' };
  const pipelineHTML = Object.entries(stageLabels).map(([stage, label]) => {
    const items = pipeline[stage];
    const cardsHTML = items.map(item => `
          <div class="pipeline-card"${stage === 'resolved' ? ' style="opacity:0.6;"' : ''}>
            <div class="pipeline-card-title">${escapeHtml(item.title)}</div>
            <div class="pipeline-card-meta"><span class="pipeline-card-tag ${item.tagClass}">${item.tag}</span></div>
            <div class="pipeline-card-date">${formatShortDate(item.date)}</div>
          </div>`).join('');
    return `
        <div class="pipeline-col">
          <div class="pipeline-col-header">${label} <span class="pipeline-col-count">${items.length}</span></div>
          ${cardsHTML || '<div style="font-size:11px; color:var(--text-3); text-align:center; padding:20px;">No items</div>'}
        </div>`;
  }).join('');

  // 6. Keyword Velocity
  const velocityHTML = topVelocity.map((v, i) => {
    const arrowCls = v.delta > 15 ? 'up' : (v.delta < -15 ? 'down' : 'flat');
    const arrow = v.delta > 15 ? '&#9650;' : (v.delta < -15 ? '&#9660;' : '&#9644;');
    const barColor = v.delta > 15 ? 'var(--green)' : (v.delta < -15 ? 'var(--red)' : 'var(--amber)');
    const deltaCls = v.delta > 15 ? 'pos' : (v.delta < -15 ? 'neg' : 'zero');
    const thisW = Math.max(28, (v.thisCount / maxVelocityCount) * 200);
    const prevW = Math.max(28, (v.prevCount / maxVelocityCount) * 200);
    const deltaStr = v.delta === 999 ? 'NEW' : (v.delta >= 0 ? `+${v.delta}%` : `${v.delta}%`);
    return `
        <div class="velocity-row">
          <div class="velocity-rank">${i + 1}</div>
          <div class="velocity-arrow ${arrowCls}">${arrow}</div>
          <div class="velocity-keyword">${escapeHtml(v.keyword)}</div>
          <div class="velocity-bars">
            <div class="velocity-this-week" style="width:${thisW}px; background:${barColor};">${v.thisCount}</div>
            <div class="velocity-last-week" style="width:${prevW}px;">${v.prevCount}</div>
          </div>
          <div class="velocity-delta ${deltaCls}">${deltaStr}</div>
        </div>`;
  }).join('');

  // 7. Narrative Threads
  const typeColors = { 'market-briefing': 'green', 'legal-brief': 'blue', 'ai-briefing': 'purple', 'biohacker-report': 'teal' };
  const threadsHTML = threads.length > 0 ? threads.map(t => {
    const chipsHTML = t.appearances.map((a, i) => {
      const meta = TYPES[a.type];
      const col = typeColors[a.type] || 'amber';
      return (i > 0 ? '<div class="thread-connector">&#x27A1;</div>' : '') + `
            <div class="thread-chip">
              <div class="thread-chip-dot" style="background:var(--${col});"></div>
              <div>
                <div class="thread-chip-type" style="color:var(--${col});">${meta.label}</div>
                <div class="thread-chip-text">${escapeHtml(a.snippet)}</div>
              </div>
            </div>`;
    }).join('');
    return `
        <div class="thread">
          <div class="thread-header">
            <div class="thread-topic">${escapeHtml(t.topic)} <span style="font-size:11px; color:var(--text-3); font-weight:400;">(${formatShortDate(t.date)})</span></div>
            <div class="thread-signal signal-${t.signal}">${t.signal === 'high' ? 'High' : 'Medium'} Signal</div>
          </div>
          <div class="thread-appearances">${chipsHTML}</div>
        </div>`;
  }).join('') : '<div style="text-align:center; padding:30px; color:var(--text-3); font-size:13px;">No cross-briefing threads detected yet. Publish briefings across multiple categories on the same day.</div>';

  // Data freshness label
  const dataLabel = dates.length > 0
    ? `Data from ${dates.length} day${dates.length > 1 ? 's' : ''} (${formatShortDate(dates[0])} – ${formatShortDate(dates[dates.length - 1])})`
    : 'No briefing data available';

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL PAGE HTML
  // ═══════════════════════════════════════════════════════════════════════════

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GM Research — Visualizations</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
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

  .page { max-width: 1200px; margin: 0 auto; padding: 40px 40px 80px; }
  .page-header { margin-bottom: 48px; }
  .page-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: var(--amber); margin-bottom: 8px; }
  .page-title { font-size: 32px; font-weight: 800; color: var(--text-0); letter-spacing: -1px; }
  .page-sub { font-size: 14px; color: var(--text-3); margin-top: 8px; }
  .data-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-3); margin-top: 4px; letter-spacing: 0.5px; }

  .section { margin-bottom: 56px; }
  .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
  .section-num { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--amber); background: var(--amber-dim); width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 600; }
  .section-title { font-size: 18px; font-weight: 700; color: var(--text-0); }
  .section-cat { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; margin-left: auto; padding: 4px 10px; border-radius: 4px; font-weight: 500; }
  .cat-market { color: var(--green); background: var(--green-dim); }
  .cat-legal { color: var(--blue); background: var(--blue-dim); }
  .cat-cross { color: var(--purple); background: var(--purple-dim); }
  .section-desc { font-size: 13px; color: var(--text-3); margin-bottom: 20px; line-height: 1.5; }

  .panel { background: var(--bg-1); border: 1px solid var(--border); border-radius: 12px; padding: 28px; position: relative; overflow: hidden; }
  .panel::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent); }

  /* 1. BTC Timeline */
  .timeline-chart { position: relative; height: 220px; margin-top: 16px; }
  .timeline-y { position: absolute; left: 0; top: 0; bottom: 30px; width: 50px; display: flex; flex-direction: column; justify-content: space-between; }
  .timeline-y span { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-3); text-align: right; }
  .timeline-area { position: absolute; left: 56px; right: 0; top: 0; bottom: 30px; }
  .timeline-grid-line { position: absolute; left: 0; right: 0; height: 1px; background: var(--border); }
  .timeline-svg { width: 100%; height: 100%; }
  .timeline-x { position: absolute; left: 56px; right: 0; bottom: 0; height: 28px; display: flex; justify-content: space-between; }
  .timeline-x span { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-3); }
  .wyckoff-labels { display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
  .wyckoff-label { display: flex; align-items: center; gap: 6px; font-size: 11px; }
  .wyckoff-dot { width: 8px; height: 8px; border-radius: 50%; }
  .wyckoff-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; padding: 2px 8px; border-radius: 3px; font-weight: 600; }
  .tag-accum { background: var(--green-dim); color: var(--green); }
  .tag-distrib { background: var(--red-dim); color: var(--red); }
  .tag-markup { background: var(--amber-dim); color: var(--amber); }

  /* 2. Asset Mention Tracker */
  .asset-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .asset-card { background: var(--bg-2); border: 1px solid var(--border); border-radius: 10px; padding: 20px; transition: border-color 0.2s; }
  .asset-card:hover { border-color: var(--border-hover); }
  .asset-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .asset-name { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; color: var(--text-0); }
  .asset-count { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; }
  .asset-count.high { color: var(--amber); }
  .asset-count.med { color: var(--text-1); }
  .asset-count.low { color: var(--text-3); }
  .asset-bar-track { height: 4px; background: var(--bg-3); border-radius: 2px; margin-bottom: 8px; overflow: hidden; }
  .asset-bar-fill { height: 100%; border-radius: 2px; transition: width 0.5s; }
  .asset-spark { display: flex; align-items: flex-end; gap: 2px; height: 32px; margin-top: 8px; }
  .asset-spark-bar { flex: 1; border-radius: 1px; min-height: 2px; transition: height 0.3s; }

  /* 3. Sentiment Heatmap */
  .sentiment-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
  .sentiment-day { border-radius: 8px; padding: 12px; text-align: center; border: 1px solid var(--border); transition: all 0.2s; }
  .sentiment-day:hover { transform: scale(1.05); }
  .sentiment-day-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--text-3); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .sentiment-day-date { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-2); margin-bottom: 8px; }
  .sentiment-emoji { font-size: 24px; margin-bottom: 6px; }
  .sentiment-score { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; }
  .sentiment-word { font-size: 10px; margin-top: 2px; }
  .s-extreme-greed { background: linear-gradient(135deg, #052e16, #0a3d1e); }
  .s-extreme-greed .sentiment-score { color: #4ade80; }
  .s-extreme-greed .sentiment-word { color: #22c55e; }
  .s-greed { background: linear-gradient(135deg, #0a2818, #0f3520); }
  .s-greed .sentiment-score { color: #86efac; }
  .s-greed .sentiment-word { color: #4ade80; }
  .s-neutral { background: linear-gradient(135deg, #1a1a10, #222218); }
  .s-neutral .sentiment-score { color: var(--amber); }
  .s-neutral .sentiment-word { color: #fbbf24; }
  .s-fear { background: linear-gradient(135deg, #1a0a0a, #2a1010); }
  .s-fear .sentiment-score { color: #f87171; }
  .s-fear .sentiment-word { color: #ef4444; }
  .s-extreme-fear { background: linear-gradient(135deg, #250505, #3a0a0a); }
  .s-extreme-fear .sentiment-score { color: #ef4444; }
  .s-extreme-fear .sentiment-word { color: #dc2626; }
  .sentiment-legend { display: flex; align-items: center; gap: 4px; margin-top: 16px; justify-content: center; }
  .sentiment-legend-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--text-3); margin: 0 6px; }
  .sentiment-bar { height: 8px; border-radius: 4px; flex: 1; max-width: 300px; background: linear-gradient(90deg, #ef4444, #f59e0b, #22c55e); }

  /* 4. Regulatory Radar */
  .radar-container { display: flex; gap: 32px; align-items: flex-start; }
  .radar-chart { flex: 1; position: relative; height: 300px; display: flex; align-items: center; justify-content: center; }
  .radar-bg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
  .radar-ring { position: absolute; border: 1px solid var(--border); border-radius: 50%; }
  .radar-bubble { position: absolute; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono', monospace; font-weight: 700; transition: all 0.3s; cursor: pointer; z-index: 2; }
  .radar-bubble:hover { transform: scale(1.1); z-index: 10; }
  .radar-bubble span { font-size: 10px; position: absolute; bottom: -18px; white-space: nowrap; color: var(--text-2); font-weight: 500; }
  .radar-sidebar { width: 260px; }
  .radar-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; margin-bottom: 4px; transition: background 0.2s; }
  .radar-item:hover { background: var(--bg-3); }
  .radar-item-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .radar-item-name { font-size: 13px; font-weight: 500; color: var(--text-0); flex: 1; }
  .radar-item-count { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-3); }
  .radar-item-bar { width: 60px; height: 4px; background: var(--bg-3); border-radius: 2px; overflow: hidden; }
  .radar-item-fill { height: 100%; border-radius: 2px; }

  /* 5. Legislation Pipeline */
  .pipeline { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .pipeline-col { background: var(--bg-2); border: 1px solid var(--border); border-radius: 10px; padding: 16px; min-height: 200px; }
  .pipeline-col-header { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-3); margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; }
  .pipeline-col-count { background: var(--bg-3); padding: 1px 7px; border-radius: 8px; font-size: 10px; }
  .pipeline-card { background: var(--bg-1); border: 1px solid var(--border); border-radius: 8px; padding: 14px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; }
  .pipeline-card:hover { border-color: var(--border-hover); transform: translateY(-1px); }
  .pipeline-card-title { font-size: 13px; font-weight: 600; color: var(--text-0); margin-bottom: 6px; line-height: 1.3; }
  .pipeline-card-meta { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-3); display: flex; gap: 8px; align-items: center; }
  .pipeline-card-tag { font-size: 9px; padding: 2px 6px; border-radius: 3px; font-weight: 600; }
  .ptag-bill { background: var(--blue-dim); color: var(--blue); }
  .ptag-case { background: var(--purple-dim); color: var(--purple); }
  .ptag-rule { background: var(--teal-dim); color: var(--teal); }
  .ptag-eu { background: var(--amber-dim); color: var(--amber); }
  .pipeline-card-date { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--text-3); margin-top: 8px; }

  /* 6. Keyword Velocity */
  .velocity-row { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--border); }
  .velocity-row:last-child { border-bottom: none; }
  .velocity-rank { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-3); width: 24px; text-align: center; }
  .velocity-arrow { font-size: 16px; width: 24px; text-align: center; }
  .velocity-arrow.up { color: var(--green); }
  .velocity-arrow.down { color: var(--red); }
  .velocity-arrow.flat { color: var(--text-3); }
  .velocity-keyword { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; color: var(--text-0); width: 120px; }
  .velocity-bars { flex: 1; display: flex; align-items: center; gap: 8px; }
  .velocity-this-week { height: 20px; border-radius: 4px; display: flex; align-items: center; padding: 0 8px; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; color: #000; min-width: 28px; }
  .velocity-last-week { height: 20px; border-radius: 4px; background: var(--bg-3); display: flex; align-items: center; padding: 0 8px; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-3); min-width: 28px; }
  .velocity-delta { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; width: 60px; text-align: right; }
  .velocity-delta.pos { color: var(--green); }
  .velocity-delta.neg { color: var(--red); }
  .velocity-delta.zero { color: var(--text-3); }
  .velocity-legend { display: flex; gap: 20px; margin-top: 12px; }
  .velocity-legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-3); }
  .velocity-legend-swatch { width: 12px; height: 12px; border-radius: 3px; }

  /* 7. Narrative Threads */
  .thread { background: var(--bg-2); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 12px; transition: border-color 0.2s; }
  .thread:hover { border-color: var(--border-hover); }
  .thread-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .thread-topic { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; color: var(--amber); }
  .thread-signal { font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .signal-high { background: var(--red-dim); color: var(--red); }
  .signal-med { background: var(--amber-dim); color: var(--amber); }
  .thread-appearances { display: flex; gap: 8px; flex-wrap: wrap; }
  .thread-chip { display: flex; align-items: center; gap: 8px; background: var(--bg-1); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; font-size: 12px; color: var(--text-1); }
  .thread-chip-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .thread-chip-type { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .thread-chip-text { color: var(--text-2); font-size: 11px; max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .thread-connector { display: flex; align-items: center; justify-content: center; color: var(--text-3); font-size: 14px; padding: 0 4px; }

  @media(max-width:900px){.asset-grid{grid-template-columns:repeat(2,1fr)}.pipeline{grid-template-columns:repeat(2,1fr)}.radar-container{flex-direction:column}.sentiment-grid{grid-template-columns:repeat(4,1fr)}}
  @media(max-width:600px){.page{padding:20px}.asset-grid{grid-template-columns:1fr 1fr}.pipeline{grid-template-columns:1fr}.sentiment-grid{grid-template-columns:repeat(3,1fr)}.velocity-bars{display:none}.thread-appearances{flex-direction:column}.thread-connector{display:none}}
</style>
</head>
<body>
<div class="topbar">
  <div class="topbar-left">
    <a href="index.html" class="logo"><div class="logo-mark">GM</div>GM <span>Research</span></a>
    <div class="topbar-sep"></div>
    <div class="topbar-tabs">
      <a href="index.html" class="topbar-tab">Intelligence Archive</a>
      <a href="visualizations.html" class="topbar-tab active">Visualizations</a>
    </div>
  </div>
  <div class="topbar-right">
    <button class="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark mode"><span class="icon-moon">&#x1F319;</span><span class="icon-sun">&#x2600;&#xFE0F;</span></button>
  </div>
</div>

<div class="page">
  <div class="page-header">
    <div class="page-label">Visualizations</div>
    <div class="page-title">Intelligence Analytics</div>
    <div class="page-sub">Patterns, trends, and signals extracted from your daily briefings.</div>
    <div class="data-label">${escapeHtml(dataLabel)}</div>
  </div>

  <!-- 1. BTC PRICE & SENTIMENT TIMELINE -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">1</div>
      <div class="section-title">BTC Price & Sentiment Timeline</div>
      <div class="section-cat cat-market">Market</div>
    </div>
    <div class="section-desc">BTC price mentions from each Morning Edge plotted over time, with outlook badges showing your daily read.</div>
    <div class="panel">
      ${btcChartHTML}
    </div>
  </div>

  <!-- 2. ASSET MENTION TRACKER -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">2</div>
      <div class="section-title">Asset Mention Tracker</div>
      <div class="section-cat cat-market">Market</div>
    </div>
    <div class="section-desc">Which assets dominate your briefing coverage? Frequency across all briefings with daily sparklines.</div>
    <div class="panel">
      <div class="asset-grid">
        ${assetCardsHTML || '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-3); font-size:13px;">No asset data yet.</div>'}
      </div>
    </div>
  </div>

  <!-- 3. SENTIMENT HEATMAP -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">3</div>
      <div class="section-title">Briefing Sentiment Heatmap</div>
      <div class="section-cat cat-market">Market</div>
    </div>
    <div class="section-desc">Fear &amp; Greed Index extracted from each Market briefing. Track how narrative shifts before price does.</div>
    <div class="panel">
      <div class="sentiment-grid">
        ${sentimentHTML}
      </div>
      <div class="sentiment-legend">
        <div class="sentiment-legend-label">Extreme Fear</div>
        <div class="sentiment-bar"></div>
        <div class="sentiment-legend-label">Extreme Greed</div>
      </div>
    </div>
  </div>

  <!-- 4. REGULATORY RADAR -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">4</div>
      <div class="section-title">Regulatory Radar</div>
      <div class="section-cat cat-legal">Legal</div>
    </div>
    <div class="section-desc">Which regulators dominate your Legal briefs? Bubble size = mention frequency across all briefings.</div>
    <div class="panel">
      <div class="radar-container">
        <div class="radar-chart">
          <div class="radar-bg">
            <div class="radar-ring" style="width:260px; height:260px;"></div>
            <div class="radar-ring" style="width:180px; height:180px;"></div>
            <div class="radar-ring" style="width:100px; height:100px;"></div>
          </div>
          ${radarBubblesHTML || '<div style="color:var(--text-3); font-size:13px;">No legal brief data yet.</div>'}
        </div>
        <div class="radar-sidebar">
          ${radarSidebarHTML}
        </div>
      </div>
    </div>
  </div>

  <!-- 5. LEGISLATION PIPELINE -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">5</div>
      <div class="section-title">Legislation Pipeline</div>
      <div class="section-cat cat-legal">Legal</div>
    </div>
    <div class="section-desc">Bills, rulemakings, and enforcement actions tracked across your briefs — mapped to their current stage.</div>
    <div class="panel">
      <div class="pipeline">
        ${pipelineHTML}
      </div>
    </div>
  </div>

  <!-- 6. KEYWORD VELOCITY -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">6</div>
      <div class="section-title">Keyword Velocity</div>
      <div class="section-cat cat-cross">Cross-Briefing</div>
    </div>
    <div class="section-desc">What topics are trending up vs fading across all your briefings? Compared day-over-day.</div>
    <div class="panel">
      <div class="velocity-list">
        ${velocityHTML || '<div style="text-align:center; padding:30px; color:var(--text-3); font-size:13px;">Need at least 2 days of briefings for velocity comparison.</div>'}
      </div>
      <div class="velocity-legend">
        <div class="velocity-legend-item"><div class="velocity-legend-swatch" style="background:var(--green);"></div> Latest</div>
        <div class="velocity-legend-item"><div class="velocity-legend-swatch" style="background:var(--bg-3);"></div> Previous</div>
        <div class="velocity-legend-item"><div class="velocity-legend-swatch" style="background:var(--amber);"></div> Steady</div>
      </div>
    </div>
  </div>

  <!-- 7. NARRATIVE THREADS -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">7</div>
      <div class="section-title">Narrative Threads</div>
      <div class="section-cat cat-cross">Cross-Briefing</div>
    </div>
    <div class="section-desc">When the same topic appears across multiple briefing types on the same day, that's a signal. These threads connect the dots.</div>
    <div class="panel">
      <div class="threads">
        ${threadsHTML}
      </div>
    </div>
  </div>

</div>

<script>
function toggleTheme(){var h=document.documentElement,c=h.getAttribute('data-theme'),n=c==='light'?'dark':'light';h.setAttribute('data-theme',n);localStorage.setItem('gm-theme',n)}
(function(){var s=localStorage.getItem('gm-theme');if(s)document.documentElement.setAttribute('data-theme',s)})();
</script>
</body>
</html>`;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

fs.writeFileSync(OUTPUT_FILE, buildVisualizationsHTML());
console.log(`visualizations.html written — ${dates.length} date(s) of briefing data`);
