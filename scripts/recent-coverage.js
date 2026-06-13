#!/usr/bin/env node
'use strict';

// recent-coverage.js — surface what recent issues of a briefing type covered, so
// authoring skills can write CONTEXT-AWARE briefings instead of isolated snapshots:
//   • dedup     — don't repeat topics covered in recent issues (biohacker, alpha, rabbit-hole, praxis)
//   • delta     — open the market briefing with what moved since yesterday + whether the prior thesis held
//   • threading — thread ongoing legal storylines instead of re-introducing them cold
//
// Reads each issue's gm-meta block first (authoritative); falls back to a light
// extraction (story-title / tldr-text / <title>). Output is human-readable — an
// authoring skill runs this as a pre-write step and reads the result.
//
//   node scripts/recent-coverage.js <type> [n]
//     <type>  market-briefing | legal-brief | ai-briefing | biohacker-report
//             | rabbit-hole | praxis-brief | trading-concept   (aliases accepted)
//     [n]     number of recent issues to show (default 6)

const fs   = require('fs');
const path = require('path');
const { stripHtml } = require('./lib/text');
const { BRIEFING_META, BRIEFING_FILENAMES, extractTags, readMeta } = require('./lib/briefings');

const ROOT          = path.join(__dirname, '..');
const BRIEFINGS_DIR = path.join(ROOT, 'briefings');
const TICKER_FILE   = path.join(ROOT, 'data', 'ticker.json');

const ALIASES = {
  market:'market-briefing', 'morning-edge':'market-briefing', edge:'market-briefing',
  legal:'legal-brief', precedent:'legal-brief',
  ai:'ai-briefing', cortex:'ai-briefing',
  biohacker:'biohacker-report', bio:'biohacker-report',
  praxis:'praxis-brief',
  alpha:'trading-concept', trading:'trading-concept', 'trading-concept':'trading-concept',
  rabbit:'rabbit-hole', rabbithole:'rabbit-hole', 'rabbit-hole':'rabbit-hole',
};

function resolveType(arg) {
  if (!arg) return null;
  const a = arg.toLowerCase().replace(/\.html$/, '');
  if (BRIEFING_META[a]) return a;
  return ALIASES[a] || null;
}

function firstSentence(raw, cap) {
  let t = stripHtml(raw);
  const e = t.search(/\.\s+[A-Z]/);
  if (e > 15) t = t.slice(0, e + 1);
  if (t.length > cap) t = t.slice(0, t.lastIndexOf(' ', cap - 3)) + '...';
  return t;
}

function headlineOf(html, type) {
  const meta = readMeta(html);
  if (meta && meta.headline) return meta.headline;
  if (type === 'legal-brief') {
    const m = html.match(/story-title"[^>]*>([^<]+)/);
    if (m) return firstSentence(m[1], 90);
  }
  const tl = html.match(/class="tldr-text"[^>]*>([\s\S]*?)<\/(?:p|div)>/);
  if (tl) return firstSentence(tl[1], 90);
  const ti = html.match(/<title>([^<]+)<\/title>/);
  return ti ? stripHtml(ti[1]) : '(no headline found)';
}

function storyTitlesOf(html) {
  const re = /story-title"[^>]*>([^<]+)/g;
  const out = [];
  let m;
  while ((m = re.exec(html)) && out.length < 6) {
    let t = stripHtml(m[1]);
    const d = t.indexOf(' — ');
    if (d > 10 && d < 90) t = t.slice(0, d);
    if (t) out.push(t);
  }
  return out;
}

const type = resolveType(process.argv[2]);
const n = parseInt(process.argv[3], 10) > 0 ? parseInt(process.argv[3], 10) : 6;
if (!type) {
  console.error('Usage: node scripts/recent-coverage.js <type> [n]');
  console.error('  types: ' + Object.keys(BRIEFING_META).join(', '));
  process.exit(1);
}

const filename = BRIEFING_FILENAMES[type];
const label    = BRIEFING_META[type].typeLabel;

const dates = fs.existsSync(BRIEFINGS_DIR)
  ? fs.readdirSync(BRIEFINGS_DIR).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse()
  : [];

const issues = [];
for (const d of dates) {
  const fp = path.join(BRIEFINGS_DIR, d, filename);
  if (fs.existsSync(fp)) {
    const html = fs.readFileSync(fp, 'utf8');
    issues.push({ date: d, headline: headlineOf(html, type), tags: extractTags(html, type), html });
    if (issues.length >= n) break;
  }
}

if (!issues.length) {
  console.log(`No prior ${label} (${filename}) issues found — nothing to dedup against.`);
  process.exit(0);
}

console.log(`Recent ${label} coverage — last ${issues.length} issue(s), newest first:\n`);
for (const it of issues) {
  const tags = it.tags.length ? `  [${it.tags.join(', ')}]` : '';
  console.log(`  ${it.date} — ${it.headline}${tags}`);
  if (type === 'legal-brief') {
    const st = storyTitlesOf(it.html);
    if (st.length) console.log(`      stories: ${st.join(' · ')}`);
  }
}

const allTags = [...new Set(issues.flatMap(it => it.tags))];
if (allTags.length) console.log(`\nTopics covered recently: ${allTags.join(', ')}`);

console.log('');
if (type === 'market-briefing') {
  console.log(`Yesterday's thesis (${issues[0].date}): "${issues[0].headline}"`);
  if (fs.existsSync(TICKER_FILE)) {
    try {
      const q = (JSON.parse(fs.readFileSync(TICKER_FILE, 'utf8')).quotes) || {};
      const fmt = k => q[k] ? `${k.toUpperCase()} ${q[k].price} (${q[k].pct >= 0 ? '+' : ''}${q[k].pct.toFixed(1)}%)` : null;
      const line = ['spx', 'wti', 'gold', 'vix', 'dxy'].map(fmt).filter(Boolean).join(', ');
      if (line) console.log(`Current macro (data/ticker.json, 24h): ${line}`);
    } catch (e) { /* ignore */ }
  }
  console.log('→ Open with a since-yesterday delta: what moved, and whether yesterday’s thesis is playing out or reversing.');
} else if (type === 'legal-brief') {
  console.log('→ Thread any storyline that recurs in the stories above (e.g. "Day N of <bill/case>: today X, prior Y"). Don’t re-introduce ongoing sagas cold.');
} else {
  console.log('→ Do NOT repeat the topics above unless you have a genuinely new angle — if so, frame it explicitly as a follow-up. Otherwise rotate to fresh material.');
}
