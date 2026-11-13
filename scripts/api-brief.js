#!/usr/bin/env node
'use strict';

// api-brief.js — author one briefing through the Claude API (paid from the
// Max-plan API credit), instead of a Claude Code scheduled task.
//
//   node scripts/api-brief.js market-briefing [--model claude-sonnet-5-5] [--out <dir>]
//
// Flow: gather free context (recent coverage, ticker, CoinGecko) → ONE Messages
// API conversation with server-side web_search/web_fetch → content JSON →
// scripts/render-briefing.js (depth floors) → HTML in --out. It never publishes;
// publishing stays with scripts/publish-briefing.js.
//
// API key: env ANTHROPIC_API_KEY, else ~/.config/gm-research/anthropic.env
// (a line ANTHROPIC_API_KEY=...). Never put the key in this repo.

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// USD per million tokens (platform.claude.com pricing, read 2026-11-13).
const PRICES = {
  'claude-sonnet-5-5': { in: 2, out: 10, cw5m: 2.5, cr: 0.10 },
  'claude-opus-5-5':   { in: 4, out: 20, cw5m: 5,   cr: 0.20 },
  'claude-haiku-5-5':  { in: 0.10, out: 0.50, cw5m: 0.125, cr: 0.01 },
};
const SEARCH_PRICE = 10 / 1000; // $ per web search

const TYPES = {
  'market-briefing': 'briefing-morning-edge',
};

function loadKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY.trim();
  const f = path.join(os.homedir(), '.config', 'gm-research', 'anthropic.env');
  if (fs.existsSync(f)) {
    const m = fs.readFileSync(f, 'utf8').match(/^\s*ANTHROPIC_API_KEY\s*=\s*(\S+)/m);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  throw new Error(`No API key: set ANTHROPIC_API_KEY or create ${f}`);
}

function sh(cmd, args) {
  try { return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { return `(failed: ${cmd} ${args.join(' ')}: ${e.message.split('\n')[0]})`; }
}

function getJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'user-agent': 'gm-research-brief/1.0', accept: 'application/json' } }, (res) => {
      let b = ''; res.on('data', (d) => (b += d));
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

async function liveData() {
  const ids = 'bitcoin,ethereum,solana,ripple,hyperliquid,dogecoin';
  const mk = await getJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h,7d`);
  const gl = await getJson('https://api.coingecko.com/api/v3/global');
  const fng = await getJson('https://api.alternative.me/fng/?limit=2');
  const coins = Array.isArray(mk) ? mk.map((c) => ({
    sym: c.symbol.toUpperCase(), price: c.current_price, chg24h: c.price_change_percentage_24h_in_currency,
    chg7d: c.price_change_percentage_7d_in_currency, vol24h: c.total_volume, mcap: c.market_cap,
  })) : 'unavailable';
  const g = gl && gl.data ? {
    total_mcap_usd: gl.data.total_market_cap.usd, total_vol_usd: gl.data.total_volume.usd,
    btc_dominance: gl.data.market_cap_percentage.btc, eth_dominance: gl.data.market_cap_percentage.eth,
    mcap_chg24h: gl.data.market_cap_change_percentage_24h_usd,
  } : 'unavailable';
  const f = fng && fng.data ? fng.data.map((d) => ({ value: d.value, label: d.value_classification })) : 'unavailable';
  let ticker = sh('git', ['show', 'origin/ticker-data:data/ticker.json']);
  if (ticker.length > 6000) ticker = ticker.slice(0, 6000) + '…';
  return { fetched_at_utc: new Date().toISOString(), coingecko_markets: coins, coingecko_global: g, fear_greed: f, ticker_json: ticker };
}

function post(key, body) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json',
        'content-length': Buffer.byteLength(data),
      },
    }, (res) => {
      let b = ''; res.on('data', (d) => (b += d));
      res.on('end', () => {
        let j; try { j = JSON.parse(b); } catch { return reject(new Error(`HTTP ${res.statusCode}: ${b.slice(0, 500)}`)); }
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(j.error || j).slice(0, 800)}`));
        resolve(j);
      });
    });
    req.setTimeout(20 * 60 * 1000, () => req.destroy(new Error('timeout after 20 min')));
    req.on('error', reject);
    req.end(data);
  });
}

function addUsage(t, u) {
  t.input += u.input_tokens || 0; t.output += u.output_tokens || 0;
  t.cacheWrite += u.cache_creation_input_tokens || 0; t.cacheRead += u.cache_read_input_tokens || 0;
  t.searches += (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
  t.fetches += (u.server_tool_use && u.server_tool_use.web_fetch_requests) || 0;
}

function cost(t, model) {
  const p = PRICES[model];
  const tok = (t.input * p.in + t.output * p.out + t.cacheWrite * p.cw5m + t.cacheRead * p.cr) / 1e6;
  return { tokens_usd: +tok.toFixed(4), search_usd: +(t.searches * SEARCH_PRICE).toFixed(4), total_usd: +(tok + t.searches * SEARCH_PRICE).toFixed(4) };
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const s = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(s);
}

async function main() {
  const args = process.argv.slice(2);
  const type = args[0];
  if (!TYPES[type]) { console.error(`Usage: api-brief.js <${Object.keys(TYPES).join('|')}> [--model m] [--out dir]`); process.exit(2); }
  const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
  const model = opt('--model', 'claude-sonnet-5-5');
  const outDir = path.resolve(opt('--out', path.join(os.tmpdir(), 'gm-api-brief')));
  const maxSearches = +opt('--max-searches', 12);
  if (!PRICES[model]) throw new Error(`no price for ${model}`);
  fs.mkdirSync(outDir, { recursive: true });
  const key = loadKey();

  const dir = path.join(ROOT, 'skills-briefings-files', TYPES[type]);
  const skill = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
  const guide = fs.readFileSync(path.join(dir, 'content-guide.md'), 'utf8');
  const sydneyDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date());
  const coverage = sh('node', ['scripts/recent-coverage.js', type]);
  const live = await liveData();

  const system = [
    { type: 'text', text: `${guide}\n\n---\n\n# Voice and section spec (SKILL.md)\n\n${skill}` },
    { type: 'text', cache_control: { type: 'ephemeral' }, text:
`# API-run overrides (these win over the guide where they conflict)
- You are running through the Claude API, not Claude Code. MCP tools (CoinGecko, TrueNorth, Polymarket MCP, etc.), shell commands and file access are NOT available.
- The user message already contains: the Sydney date, the recent-coverage output, and a live-data block fetched by script seconds ago. Treat that block as LIVE (live-badge). Use web_search / web_fetch for everything else (equities, derivatives, regulatory, AI & semis, prediction markets, geopolitics), and badge anything you could not confirm as EST per the guide.
- Be economical: at most ${maxSearches} web searches. Prefer one search that covers several facts.
- Do NOT write files or run the renderer. Your FINAL message must be ONLY the content JSON object (no prose before or after; a single \`\`\`json fence is acceptable). It must have exactly the top-level keys tokens, gm_meta, raw, sections used by the renderer, with every section body meeting the guide's depth floors.` },
  ];
  const user = `Today's date (Australia/Sydney): ${sydneyDate}\n\n## recent-coverage output\n${coverage}\nNote: if the newest issue is weeks old, the delta strip should say this is the first issue since that date and compare against current levels instead of "yesterday".\n\n## Live data block (fetched by script, treat as LIVE)\n\`\`\`json\n${JSON.stringify(live, null, 1)}\n\`\`\`\n\nWrite today's ${type} content JSON.`;

  const tools = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8 },
  ];
  const messages = [{ role: 'user', content: user }];
  const tally = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0, fetches: 0, calls: 0 };
  const t0 = Date.now();
  let res;
  for (let turn = 0; turn < 6; turn++) {
    res = await post(key, { model, max_tokens: 32000, system, tools, messages });
    tally.calls++; addUsage(tally, res.usage || {});
    console.error(`[api-brief] call ${tally.calls}: stop=${res.stop_reason} out=${res.usage && res.usage.output_tokens}`);
    if (res.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: res.content });
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const stamp = `${type}-${sydneyDate}-${model}`;
  fs.writeFileSync(path.join(outDir, `${stamp}.raw.txt`), text);
  const report = { type, model, date: sydneyDate, seconds: secs, stop_reason: res.stop_reason, usage: tally, ...cost(tally, model) };

  let content;
  try { content = extractJson(text); }
  catch (e) { report.error = `content JSON parse failed: ${e.message}`; console.log(JSON.stringify(report, null, 2)); process.exit(1); }
  const jsonPath = path.join(outDir, `${stamp}.json`);
  const htmlPath = path.join(outDir, `${stamp}.html`);
  fs.writeFileSync(jsonPath, JSON.stringify(content, null, 2));
  try {
    execFileSync('node', ['scripts/render-briefing.js', type, jsonPath, htmlPath], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    report.render = 'ok';
  } catch (e) {
    report.render = `FAILED: ${(e.stderr || e.message).toString().trim().slice(0, 1500)}`;
  }
  report.files = { json: jsonPath, html: fs.existsSync(htmlPath) ? htmlPath : null };
  fs.writeFileSync(path.join(outDir, `${stamp}.report.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.render === 'ok' ? 0 : 1);
}

main().catch((e) => { console.error(`[api-brief] ${e.message}`); process.exit(1); });
