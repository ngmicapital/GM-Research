#!/usr/bin/env node
'use strict';

// daily-briefs.js — write and publish today's briefings through the Claude API
// (Haiku 5.5, paid from the Max-plan API credit). Run by
// .github/workflows/daily-briefs.yml each morning, or by hand.
//
//   node scripts/daily-briefs.js                 # today's due types, publish
//   node scripts/daily-briefs.js --types a,b     # only these
//   node scripts/daily-briefs.js --dry-run       # write + render, no publish
//
// Schedule (Sydney date): market, legal, ai, trading-concept daily;
// rabbit-hole Mon–Fri; praxis odd day-of-month; biohacker even.
// One failed type never blocks the others; exit 1 if any failed.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { BRIEFING_FILENAMES } = require('./lib/briefings');

const ROOT = path.join(__dirname, '..');

function sydneyParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, day: +p.day, weekday: p.weekday };
}

function dueTypes({ day, weekday }) {
  const t = ['market-briefing', 'legal-brief', 'ai-briefing', 'trading-concept'];
  if (!['Sat', 'Sun'].includes(weekday)) t.push('rabbit-hole');
  t.push(day % 2 ? 'praxis-brief' : 'biohacker-report');
  return t;
}

function run(args) {
  const r = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8', timeout: 25 * 60 * 1000 });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

function main() {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const dry = args.includes('--dry-run');
  const now = sydneyParts();
  const types = opt('--types') ? opt('--types').split(',') : dueTypes(now);
  const outDir = path.join(ROOT, '.api-brief-out'); // gitignored scratch
  const results = [];

  for (const type of types) {
    const filename = BRIEFING_FILENAMES[type];
    if (!filename) { results.push({ type, status: 'unknown type' }); continue; }
    const w = run(['scripts/api-brief.js', type, '--max-searches', '6', '--out', outDir]);
    const m = w.out.match(/\{[\s\S]*\}\s*$/);
    let rep = {}; try { rep = m ? JSON.parse(m[0]) : {}; } catch { /* keep {} */ }
    if (!w.ok || !rep.files || !rep.files.html) {
      results.push({ type, status: 'write failed', cost: rep.total_usd, detail: (rep.render || rep.error || w.out.slice(-400)) });
      continue;
    }
    const dest = path.join(ROOT, 'briefings', now.date, filename);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(rep.files.html, dest);
    if (dry) { results.push({ type, status: 'written (dry run)', cost: rep.total_usd, file: dest }); continue; }
    const p = run(['scripts/publish-briefing.js', '--type', type, '--date', now.date]);
    results.push({ type, status: p.ok ? 'published' : 'publish failed', cost: rep.total_usd, detail: p.ok ? undefined : p.out.slice(-600) });
  }

  const total = results.reduce((s, r) => s + (r.cost || 0), 0);
  console.log(JSON.stringify({ date: now.date, types, total_usd: +total.toFixed(4), results }, null, 2));
  process.exit(results.every((r) => r.status === 'published' || r.status === 'written (dry run)') ? 0 : 1);
}

main();
