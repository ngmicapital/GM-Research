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
const { SCHEMAS, FRAGMENT_SCHEMAS } = require('./lib/render');

// Section depth floors, straight from the renderer, so the prompt and the gate agree.
function floorSpecs(type) {
  const sch = FRAGMENT_SCHEMAS[type] || SCHEMAS[type];
  const s = (sch && sch.sections) || [];
  if (!s.length) throw new Error(`no section floors found for ${type} in render.js`);
  return s;
}
function floorsText(type) {
  return floorSpecs(type).map((x) => `${x.token} >= ${x.minChars} chars${x.requires ? ' and must contain a <table>' : ''}`).join('; ');
}
function shortSections(type, content) {
  const s = floorSpecs(type);
  return s.filter((x) => {
    const v = (content.sections || {})[x.token] || '';
    return (x.minChars && v.length < x.minChars) || (x.requires || []).some((re) => !re.test(v));
  });
}

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

// raw=true returns the body text (batch results are JSONL, not JSON).
function api(key, method, urlPath, body, raw = false) {
  const data = body ? JSON.stringify(body) : null;
  const u = new URL(urlPath, 'https://api.anthropic.com');
  return new Promise((resolve, reject) => {
    const headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    if (data) { headers['content-type'] = 'application/json'; headers['content-length'] = Buffer.byteLength(data); }
    const req = https.request({ host: u.host, path: u.pathname + u.search, method, headers }, (res) => {
      let b = ''; res.on('data', (d) => (b += d));
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${b.slice(0, 800)}`));
        if (raw) return resolve(b);
        try { resolve(JSON.parse(b)); } catch { reject(new Error(`HTTP ${res.statusCode}: ${b.slice(0, 500)}`)); }
      });
    });
    req.setTimeout(20 * 60 * 1000, () => req.destroy(new Error('timeout after 20 min')));
    req.on('error', reject);
    req.end(data || undefined);
  });
}
const post = (key, body) => api(key, 'POST', '/v1/messages', body);

// Message Batches API: 50% off tokens; results within 24 h (usually minutes).
// Read-only GETs retry through transient network errors (DNS blips, resets).
async function apiGet(key, urlPath, raw = false) {
  for (let i = 0; ; i++) {
    try { return await api(key, 'GET', urlPath, null, raw); }
    catch (e) {
      if (i >= 20 || /HTTP 4\d\d/.test(e.message)) throw e;
      console.error(`[api-brief] GET retry ${i + 1}: ${e.message.split('\n')[0]}`);
      await new Promise((r) => setTimeout(r, 15000));
    }
  }
}

// resumeId: poll an already-submitted batch instead of paying for a new one.
async function runBatch(key, params, customId, resumeId) {
  let id = resumeId;
  if (!id) {
    const b = await api(key, 'POST', '/v1/messages/batches', { requests: [{ custom_id: customId, params }] });
    id = b.id;
    console.error(`[api-brief] batch ${id} submitted (resume with --resume-batch ${id})`);
  }
  let s = await apiGet(key, `/v1/messages/batches/${id}`);
  const deadline = Date.now() + 24 * 3600 * 1000;
  while (s.processing_status !== 'ended') {
    if (Date.now() > deadline) throw new Error(`batch ${id} not ended after 24 h`);
    await new Promise((r) => setTimeout(r, 30000));
    s = await apiGet(key, `/v1/messages/batches/${id}`);
    console.error(`[api-brief] batch ${id}: ${s.processing_status} ${JSON.stringify(s.request_counts)}`);
  }
  const lines = (await apiGet(key, s.results_url, true)).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const r = resumeId ? lines[0] : lines.find((l) => l.custom_id === customId);
  if (!r || r.result.type !== 'succeeded') throw new Error(`batch result: ${JSON.stringify(r && r.result).slice(0, 800)}`);
  return r.result.message;
}

function addUsage(t, u) {
  t.input += u.input_tokens || 0; t.output += u.output_tokens || 0;
  t.cacheWrite += u.cache_creation_input_tokens || 0; t.cacheRead += u.cache_read_input_tokens || 0;
  t.searches += (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
  t.fetches += (u.server_tool_use && u.server_tool_use.web_fetch_requests) || 0;
}

function cost(t, model, batch = false) {
  const p = PRICES[model];
  const tok = (batch ? 0.5 : 1) * (t.input * p.in + t.output * p.out + t.cacheWrite * p.cw5m + t.cacheRead * p.cr) / 1e6;
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
- Do NOT write files or run the renderer. Your FINAL message must be ONLY the content JSON object (no prose before or after; a single \`\`\`json fence is acceptable). It must have exactly the top-level keys tokens, gm_meta, raw, sections used by the renderer, with every section body meeting the guide's depth floors.
- Hard depth floors enforced by the renderer (HTML characters, markup included). A page that misses any is rejected, so aim about 25% above each: ${floorsText(type)}.` },
  ];
  const user = `Today's date (Australia/Sydney): ${sydneyDate}\n\n## recent-coverage output\n${coverage}\nNote: if the newest issue is weeks old, the delta strip should say this is the first issue since that date and compare against current levels instead of "yesterday".\n\n## Live data block (fetched by script, treat as LIVE)\n\`\`\`json\n${JSON.stringify(live, null, 1)}\n\`\`\`\n\nWrite today's ${type} content JSON.`;

  const tools = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8 },
  ];
  const messages = [{ role: 'user', content: user }];
  const tally = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0, fetches: 0, calls: 0 };
  const t0 = Date.now();
  const batch = args.includes('--batch');
  let res;
  for (let turn = 0; turn < 6; turn++) {
    const params = { model, max_tokens: 32000, system, tools, messages };
    // Effort controls hidden thinking, billed as output (~65% of output at Sonnet's default "high").
    const effort = opt('--effort', null);
    if (effort) params.output_config = { effort };
    const resumeId = turn === 0 ? opt('--resume-batch', null) : null;
    res = batch ? await runBatch(key, params, `${type}-${sydneyDate}-t${turn}`, resumeId) : await post(key, params);
    tally.calls++; addUsage(tally, res.usage || {});
    console.error(`[api-brief] call ${tally.calls}: stop=${res.stop_reason} out=${res.usage && res.usage.output_tokens}`);
    if (res.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: res.content });
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const effortTag = opt('--effort', null);
  const stamp = `${type}-${sydneyDate}-${model}${batch ? '-batch' : ''}${effortTag ? `-${effortTag}` : ''}`;
  fs.writeFileSync(path.join(outDir, `${stamp}.raw.txt`), text);
  const report = { type, model, batch, date: sydneyDate, seconds: secs, stop_reason: res.stop_reason, usage: tally, ...cost(tally, model, batch) };

  let content;
  try { content = extractJson(text); }
  catch (e) { report.error = `content JSON parse failed: ${e.message}`; console.log(JSON.stringify(report, null, 2)); process.exit(1); }
  // Repair pass: expand only the sections under their floor, with a small
  // standard (non-batch) call each, instead of regenerating the whole brief.
  const repair = { calls: 0, input: 0, output: 0, sections: [] };
  for (const sec of shortSections(type, content)) {
    const cur = content.sections[sec.token] || '';
    const r = await post(key, {
      model, max_tokens: 4000,
      messages: [{ role: 'user', content:
`This is one section body (HTML) of today's ${type}. It is ${cur.length} characters; the renderer requires at least ${sec.minChars}${sec.requires ? ' and a <table>' : ''}. Expand it to about ${Math.round(sec.minChars * 1.3)} characters of real substance in the same voice, keeping all existing facts, numbers, badges and HTML classes. Add no new facts that are not already in the section or the TL;DR below. Return ONLY the HTML.

TL;DR context: ${content.raw && content.raw.TLDR_THESIS}

SECTION HTML:
${cur}` }],
    });
    const html = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').replace(/^```(?:html)?\s*|```\s*$/g, '').trim();
    content.sections[sec.token] = html;
    repair.calls++; repair.input += r.usage.input_tokens; repair.output += r.usage.output_tokens;
    repair.sections.push(`${sec.token} ${cur.length}->${html.length}`);
  }
  if (repair.calls) {
    const p = PRICES[model];
    repair.usd = +((repair.input * p.in + repair.output * p.out) / 1e6).toFixed(4);
    report.repair = repair;
    report.total_usd = +(report.total_usd + repair.usd).toFixed(4);
  }
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
