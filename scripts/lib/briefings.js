'use strict';

// Canonical briefing metadata + tag extraction shared by generate-index.js,
// health-check.js and generate-visualizations.js. These patterns drive the
// PUBLISHED index tags, so they are the single source of truth; health-check
// mirrors them exactly rather than keeping its own (previously diverging) copy.

const { stripHtml } = require('./text');

const BRIEFING_META = {
  'market-briefing':   { title:'The Morning Edge', subtitle:'Market Intelligence',   icon:'&#x1F4C8;',         accent:'#22c55e', accentDim:'#22c55e18', typeLabel:'Morning Edge', filename:'market-briefing.html', preview:'BTC, equities, macro, crypto derivatives & prediction markets', slug:'MKT', cat:'market' },
  'legal-brief':       { title:'The Brief',        subtitle:'Legal Intelligence',    icon:'&#x2696;&#xFE0F;',  accent:'#60a5fa', accentDim:'#60a5fa18', typeLabel:'Precedent',    filename:'legal-brief.html', preview:'Crypto regulation, enforcement actions & legislative tracker', slug:'LAW', cat:'legal' },
  'ai-briefing':       { title:'AI Intelligence',   subtitle:'Models & Strategy',     icon:'&#x1F916;',         accent:'#a78bfa', accentDim:'#a78bfa18', typeLabel:'Cortex',    filename:'ai-briefing.html', preview:'Model releases, benchmarks, AI x Crypto & research papers', slug:'AI',  cat:'ai' },
  'biohacker-report':  { title:'Biohacker Report',  subtitle:'Health & Longevity',    icon:'&#x1F9EC;',         accent:'#2dd4bf', accentDim:'#2dd4bf18', typeLabel:'Biohacker',    filename:'biohacker-report.html', preview:'Longevity science, training protocols & daily wisdom', slug:'BIO', cat:'bio' },
  'rabbit-hole':       { title:'Rabbit Hole',        subtitle:'Deep Dive',             icon:'&#x1F573;&#xFE0F;', accent:'#eab308', accentDim:'#eab30818', typeLabel:'Rabbit Hole',  filename:'rabbit-hole.html', preview:'One topic, explored with depth and narrative momentum', slug:'RH',  cat:'rh' },
  'praxis-brief':      { title:'Praxis',              subtitle:'Ideas In Practice',      icon:'&#x1F4A1;',         accent:'#DC3545', accentDim:'#DC354518', typeLabel:'Praxis',        filename:'praxis-brief.html', preview:'Philosophy, strategy, tools & emerging ideas', slug:'PRX', cat:'prx' },
  'trading-concept':   { title:'Alpha',               subtitle:'Trading Mechanics',      icon:'&#x1F3AF;',         accent:'#a3e635', accentDim:'#a3e63518', typeLabel:'Alpha',         filename:'trading-concept.html', preview:'One trading concept per day — with visuals, quotes & live examples', slug:'ALF', cat:'trade' },
};

const ORDER = ['market-briefing', 'legal-brief', 'ai-briefing', 'biohacker-report', 'praxis-brief', 'trading-concept', 'rabbit-hole'];

const BRIEFING_FILENAMES = Object.fromEntries(
  Object.entries(BRIEFING_META).map(([k, v]) => [k, v.filename])
);

// Per-type tag patterns. Module-scoped, so callers MUST NOT rely on lastIndex
// state — extractTags resets it before every scan.
const TAG_PATTERNS = {
  'market-briefing':  /\b(BTC|ETH|SOL|Gold|SPX|VIX|WTI|Brent|DXY|NVDA|TSLA)\b/g,
  'legal-brief':      /\b(SEC|CFTC|ESMA|FCA|MAS|ASIC|OCC|MiCA|GENIUS|CLARITY|FIT21|Ripple|Coinbase|Binance)\b/g,
  'ai-briefing':      /\b(Claude|GPT|Gemini|DeepSeek|Mistral|NVIDIA|Llama|Anthropic|OpenAI|Google)\b/g,
  'biohacker-report': /\b(Creatine|GLP-1|VO2max|Huberman|Zone 2|Sleep|HRV|Cortisol|Testosterone)\b/g,
  // Rabbit hole: header-category first (new format: "History · Biography"), then further-card-pill (old format)
  'rabbit-hole':      /class="header-category">([^<]+)<\/div>|<span class="further-card-pill">([^<]+)<\/span>/g,
  'praxis-brief':     /\b(Stoic|Stoicism|Farnam|Manson|Philosophy|Strategy|CBT|Second Brain|Obsidian)\b/g,
  'trading-concept':  /\b(Order Flow|Liquidations|CVD|Funding|Absorption|Wyckoff|FVG|Order Block|Liquidity|Open Interest|Spring|Upthrust|Accumulation|Distribution|Squeeze|Sweep|MSS|CHoCH|POC|Volume Profile|Delta|Gamma|GEX|Basis|MVRV|SOPR)\b/g,
};

const RH_SKIP_WORDS = new Set(['The','This','That','These','Those','When','What','Why','How','Who','Where','More','Less','Most','Just','Also','Only','Even','Very','Much','Many','Some','Other','Such','Each','Both','Then','They','With','From','Into','About','After','Before','During','Through','While','Which','Their','There']);

// Extract up to 3 tags from a briefing's HTML for the given type key.
// Mirrors the extraction that produces the published index cards.
function extractTags(html, key) {
  const tagRe = TAG_PATTERNS[key];
  let tags = [];
  if (tagRe) {
    tagRe.lastIndex = 0;
    const found = new Set();
    let m;
    while ((m = tagRe.exec(html))) {
      const val = stripHtml((m[1] || m[2] || '').trim());
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
  // Rabbit-hole fallback: if strict pattern found nothing, extract capitalised
  // words from <strong> blocks.
  if (key === 'rabbit-hole' && tags.length === 0) {
    const fallbackRe = /<strong>([A-Z][A-Za-zÀ-ɏ]{2,}(?:\s[A-Z][A-Za-zÀ-ɏ]{2,})?)/g;
    const fb = new Set();
    let fm;
    while ((fm = fallbackRe.exec(html)) && fb.size < 10) {
      const word = fm[1].split(/[\s:,–—]/)[0];
      if (!RH_SKIP_WORDS.has(word) && word.length >= 3) fb.add(word);
    }
    tags = [...fb].slice(0, 3);
  }
  return tags;
}

// Read an explicit <script type="application/json" id="gm-meta"> block if the
// briefing emits one (the forward-looking metadata contract). Returns
// { headline, preview, tags } or null. Defensive — any parse/shape error
// returns null so callers fall back to regex extraction for legacy briefings.
function readMeta(html) {
  const m = String(html).match(/<script[^>]*\bid=["']gm-meta["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  let o;
  try { o = JSON.parse(m[1].trim()); } catch (e) { return null; }
  if (!o || typeof o !== 'object') return null;
  const headline = typeof o.headline === 'string' ? o.headline.trim() : '';
  if (!headline) return null;            // headline is the minimum useful signal
  const preview = typeof o.preview === 'string' ? o.preview.trim() : '';
  const tags = Array.isArray(o.tags)
    ? o.tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim()).slice(0, 3)
    : [];
  return { headline, preview, tags };
}

module.exports = { BRIEFING_META, ORDER, BRIEFING_FILENAMES, TAG_PATTERNS, extractTags, readMeta };
