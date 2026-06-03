#!/usr/bin/env node
'use strict';

/**
 * Weekly Site Health Check
 * Saves report to health-reports/YYYY-MM-DD.json
 *
 * Checks:
 *  1. Tag extraction — flags zero-tag briefings
 *  2. Title presence
 *  3. Meta description presence (og:description)
 *  4. Table overflow wrappers (auto-fixed)
 *  5. Image max-width (auto-fixed)
 *  6. Back-links to index
 *  7. Transcript manifest integrity
 *  8. generate-index.js and generate-visualizations.js run successfully
 *  9. deploy.yml references correct scripts
 */

const fs   = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT            = path.join(__dirname, '..');
const BRIEFINGS_DIR   = path.join(ROOT, 'briefings');
const TRANSCRIPTS_DIR = path.join(ROOT, 'transcripts');
const MANIFEST_FILE   = path.join(TRANSCRIPTS_DIR, 'manifest.json');
const REPORTS_DIR     = path.join(ROOT, 'health-reports');
const DEPLOY_YML      = path.join(ROOT, '.github', 'workflows', 'deploy.yml');

const TODAY = new Date().toISOString().slice(0, 10);
const REPORT_FILE = path.join(REPORTS_DIR, `${TODAY}.json`);

// ─── Minimal HTML entity decoder (for raw-HTML tag text) ─────────────────────
function decodeEntities(s) {
  return s
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&middot;/g, '·')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&hellip;/g, '…').replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, '‘').replace(/&rsquo;/g, '’')
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

// ─── Tag extraction (mirrors generate-index.js logic) ─────────────────────────

const TAG_PATTERNS = {
  'market-briefing':  /\b(BTC|ETH|SOL|Gold|SPX|VIX|WTI|Brent|DXY|NVDA|TSLA)\b/g,
  'legal-brief':      /\b(SEC|CFTC|ESMA|FCA|MAS|ASIC|OCC|MiCA|GENIUS|CLARITY|FIT21|Ripple|Coinbase|Binance)\b/g,
  'ai-briefing':      /\b(Claude|GPT|Gemini|DeepSeek|Mistral|NVIDIA|Llama|Anthropic|OpenAI|Google)\b/g,
  'biohacker-report': /\b(Creatine|GLP-1|VO2max|Huberman|Zone 2|Sleep|HRV|Cortisol|Testosterone|ergothioneine|mTOR|NAD|rapamycin|semaglutide|tirzepatide|longevity|fasting|autophagy)\b/gi,
  // Rabbit hole: header-category (new format: "History · Biography"), then further-card-pill (old format)
  'rabbit-hole':      /class="header-category">([^<]+)<\/div>|<span class="further-card-pill">([^<]+)<\/span>/g,
  'praxis-brief':     /\b(Stoic|Stoicism|Farnam|Manson|Philosophy|Strategy|CBT|Second Brain|Obsidian)\b/g,
  'trading-concept':  /\b(Wyckoff|Accumulation|Distribution|Markup|Markdown|Spring|Upthrust|Upwave|Creek|Composite Man|Phase [ABCDE]|Support|Resistance|Breakout|Retest|Volume|BTC|ETH|SOL)\b/gi,
};

const BRIEFING_FILENAMES = {
  'market-briefing':  'market-briefing.html',
  'legal-brief':      'legal-brief.html',
  'ai-briefing':      'ai-briefing.html',
  'biohacker-report': 'biohacker-report.html',
  'rabbit-hole':      'rabbit-hole.html',
  'praxis-brief':     'praxis-brief.html',
  'trading-concept':  'trading-concept.html',
};

function extractTags(html, key) {
  const tagRe = TAG_PATTERNS[key];
  if (!tagRe) return [];
  tagRe.lastIndex = 0;
  const found = new Set();
  let m;
  while ((m = tagRe.exec(html))) {
    const val = decodeEntities((m[1] || m[2] || '').trim());
    if (!val) continue;
    // header-category may be "History · Biography" — split into individual tags
    if (val.includes('·')) {
      val.split('·').map(s => s.trim()).filter(Boolean).forEach(t => found.add(t));
    } else {
      found.add(val);
    }
  }
  let tags = [...found].slice(0, 3);
  // Rabbit-hole fallback: extract capitalised words from <strong> blocks
  if (key === 'rabbit-hole' && tags.length === 0) {
    const fallbackRe = /<strong>([A-Z][A-Za-zÀ-ɏ]{2,}(?:\s[A-Z][A-Za-zÀ-ɏ]{2,})?)/g;
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
  return tags;
}

function extractStrongCandidates(html) {
  // Extract words from <strong> elements for rabbit-hole fallback
  const re = /<strong>([^<]{3,60})<\/strong>/g;
  const candidates = [];
  let m;
  while ((m = re.exec(html)) && candidates.length < 20) {
    const text = m[1].trim();
    if (text && !text.includes('{')) candidates.push(text);
  }
  return candidates;
}

// ─── Auto-fix helpers ─────────────────────────────────────────────────────────

/**
 * Wrap bare <table> elements that are not already inside an overflow container.
 * Returns { html, count } where count is the number of tables wrapped.
 */
function wrapTables(html) {
  let count = 0;
  // Match <table ...> that is NOT immediately preceded by an overflow wrapper
  // Strategy: find all <table occurrences, walk backwards to check for overflow
  const lines = html.split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/<table[\s>]/i.test(line)) {
      // Check if any of the 3 preceding non-empty lines have overflow-x or table-wrap
      let alreadyWrapped = false;
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prev = lines[j].trim();
        if (prev && (prev.includes('overflow-x') || prev.includes('overflow: auto') || prev.includes('table-wrap') || prev.includes('table-container'))) {
          alreadyWrapped = true;
          break;
        }
        // Also check inline style on wrapper divs
        if (prev.includes('<div') && (prev.includes('overflow') || prev.includes('scroll'))) {
          alreadyWrapped = true;
          break;
        }
      }
      if (!alreadyWrapped) {
        // Find the matching </table>
        // Simple approach: collect lines until we find </table>
        const tableLines = [line];
        let j = i + 1;
        while (j < lines.length && !/<\/table>/i.test(lines[j])) {
          tableLines.push(lines[j]);
          j++;
        }
        if (j < lines.length) {
          tableLines.push(lines[j]); // include </table>
          // Replace with wrapped version
          const indent = line.match(/^(\s*)/)[1];
          result.push(`${indent}<div style="overflow-x:auto">`);
          result.push(...tableLines);
          result.push(`${indent}</div>`);
          count++;
          i = j; // skip consumed lines
          continue;
        }
      }
    }
    result.push(line);
  }
  return { html: result.join('\n'), count };
}

/**
 * Add max-width:100%;height:auto to <img> tags that lack it.
 * Returns { html, count }.
 */
function fixImageMaxWidth(html) {
  let count = 0;
  const fixed = html.replace(/<img\b([^>]*?)>/gi, (match, attrs) => {
    // Skip if already has max-width or width:100%
    if (/max-width/i.test(attrs) || /width\s*:\s*100%/i.test(attrs)) return match;
    // Skip if width and height are set as attributes (likely decorative/icon)
    if (/\bwidth\s*=\s*["']?\d/i.test(attrs) && /\bheight\s*=\s*["']?\d/i.test(attrs)) return match;
    count++;
    if (/\bstyle\s*=/i.test(attrs)) {
      // Append to existing style
      return match.replace(/(\bstyle\s*=\s*["'])([^"']*?)(["'])/i, (_, open, val, close) => {
        const semi = val.trimEnd().endsWith(';') ? '' : ';';
        return `${open}${val}${semi}max-width:100%;height:auto${close}`;
      });
    } else {
      return `<img style="max-width:100%;height:auto"${attrs}>`;
    }
  });
  return { html: fixed, count };
}

// ─── Main health check ────────────────────────────────────────────────────────

const report = {
  date: TODAY,
  generated_at: new Date().toISOString(),
  checks_passed: [],
  auto_fixed: [],
  needs_ai: [],
  needs_human: [],
  errors: [],
};

function pass(check) { report.checks_passed.push(check); }
function fixed(what) { report.auto_fixed.push(what); }
function needsAI(item) { report.needs_ai.push(item); }
function needsHuman(item) { report.needs_human.push(item); }
function error(msg) { report.errors.push(msg); console.error('ERROR:', msg); }

// ── 1. deploy.yml references correct scripts ──────────────────────────────────
console.log('Checking deploy.yml...');
try {
  const yml = fs.readFileSync(DEPLOY_YML, 'utf8');
  const hasIndex = yml.includes('scripts/generate-index.js');
  const hasViz   = yml.includes('scripts/generate-visualizations.js');
  if (hasIndex && hasViz) {
    pass('deploy.yml references generate-index.js and generate-visualizations.js');
  } else {
    if (!hasIndex) needsHuman({ type: 'deploy-yml-missing-script', script: 'generate-index.js', file: '.github/workflows/deploy.yml' });
    if (!hasViz)   needsHuman({ type: 'deploy-yml-missing-script', script: 'generate-visualizations.js', file: '.github/workflows/deploy.yml' });
  }
} catch (e) {
  error(`Could not read deploy.yml: ${e.message}`);
}

// ── 2. Transcript manifest integrity ─────────────────────────────────────────
console.log('Checking transcript manifest...');
try {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  let manifestOk = true;
  for (const entry of manifest) {
    const slug = entry.slug;
    if (!slug) { needsHuman({ type: 'manifest-entry-missing-slug', entry }); manifestOk = false; continue; }
    const indexFile = path.join(TRANSCRIPTS_DIR, slug, 'index.html');
    if (!fs.existsSync(indexFile)) {
      needsHuman({ type: 'transcript-missing-index', slug, expected: `transcripts/${slug}/index.html` });
      manifestOk = false;
    }
    // Check for echo/spark if flagged
    if (entry.has_echo) {
      const echoFile = path.join(TRANSCRIPTS_DIR, slug, 'echo.html');
      if (!fs.existsSync(echoFile)) {
        needsHuman({ type: 'transcript-missing-echo', slug, expected: `transcripts/${slug}/echo.html` });
        manifestOk = false;
      }
    }
    if (entry.has_spark) {
      const sparkFiles = fs.readdirSync(path.join(TRANSCRIPTS_DIR, slug)).filter(f => f.startsWith('spark'));
      if (sparkFiles.length === 0) {
        needsHuman({ type: 'transcript-missing-spark', slug, expected: `transcripts/${slug}/spark_*.html` });
        manifestOk = false;
      }
    }
  }
  if (manifestOk) pass(`Transcript manifest OK — ${manifest.length} entries verified`);
} catch (e) {
  error(`Transcript manifest check failed: ${e.message}`);
}

// ── 3. Per-briefing checks ────────────────────────────────────────────────────
console.log('Scanning briefing files...');

const dateDirs = fs.readdirSync(BRIEFINGS_DIR)
  .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
  .sort();

let totalBriefings = 0;
let zeroTagCount = 0;
let missingTitleCount = 0;
let missingDescCount = 0;
let missingBacklinkCount = 0;
let tablesFixed = 0;
let imgsFixed = 0;

for (const dateDir of dateDirs) {
  const dirPath = path.join(BRIEFINGS_DIR, dateDir);
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.html'));

  for (const filename of files) {
    const filePath = path.join(dirPath, filename);
    // Determine briefing key from filename
    const key = Object.keys(BRIEFING_FILENAMES).find(k => BRIEFING_FILENAMES[k] === filename)
      || filename.replace('.html', '');

    let html;
    try {
      html = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      error(`Could not read ${dateDir}/${filename}: ${e.message}`);
      continue;
    }

    totalBriefings++;

    // ── Title presence ────────────────────────────────────────────────────────
    if (!/<title[^>]*>[^<]+<\/title>/i.test(html)) {
      missingTitleCount++;
      needsHuman({ type: 'missing-title', file: `briefings/${dateDir}/${filename}`, date: dateDir });
    }

    // ── Meta description presence ─────────────────────────────────────────────
    const hasOgDesc = /og:description/i.test(html);
    const hasMetaDesc = /<meta\s+name=["']description["']/i.test(html);
    if (!hasOgDesc && !hasMetaDesc) {
      missingDescCount++;
      // Only flag for needs_human for most recent 7 days to avoid noise
      const sevenDaysAgo = new Date(TODAY);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fileDate = new Date(dateDir + 'T12:00:00Z');
      if (fileDate >= sevenDaysAgo) {
        needsHuman({ type: 'missing-og-description', file: `briefings/${dateDir}/${filename}`, date: dateDir });
      }
    }

    // ── Back-link to index ────────────────────────────────────────────────────
    const hasBacklink = /href=["'](?:\.\.\/\.\.\/index\.html|\/(?:index\.html)?["']|\.\.\/\.\.\/["'])/.test(html)
      || /href=["'][^"']*index\.html["']/.test(html);
    if (!hasBacklink) {
      missingBacklinkCount++;
      // Only flag recent files to avoid noise
      const fourteenDaysAgo = new Date(TODAY);
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const fileDate = new Date(dateDir + 'T12:00:00Z');
      if (fileDate >= fourteenDaysAgo) {
        needsHuman({ type: 'missing-backlink', file: `briefings/${dateDir}/${filename}`, date: dateDir });
      }
    }

    // ── Tag extraction ────────────────────────────────────────────────────────
    const tags = extractTags(html, key);
    if (tags.length === 0 && TAG_PATTERNS[key]) {
      zeroTagCount++;
      if (key === 'rabbit-hole') {
        const candidates = extractStrongCandidates(html);
        needsAI({
          type: 'rabbit-hole-tags',
          file: `briefings/${dateDir}/${filename}`,
          date: dateDir,
          candidates: candidates.slice(0, 15),
        });
      } else {
        needsHuman({
          type: 'zero-tags',
          file: `briefings/${dateDir}/${filename}`,
          date: dateDir,
          key,
          message: `No tag-pattern matches found for ${key}`,
        });
      }
    }

    // ── Table overflow wrappers (auto-fix) ─────────────────────────────────────
    if (/<table[\s>]/i.test(html)) {
      const { html: fixedHtml, count } = wrapTables(html);
      if (count > 0) {
        fs.writeFileSync(filePath, fixedHtml, 'utf8');
        html = fixedHtml;
        tablesFixed += count;
        fixed({ type: 'table-overflow-wrap', file: `briefings/${dateDir}/${filename}`, count });
      }
    }

    // ── Image max-width (auto-fix) ─────────────────────────────────────────────
    if (/<img\b/i.test(html)) {
      const { html: fixedHtml, count } = fixImageMaxWidth(html);
      if (count > 0) {
        fs.writeFileSync(filePath, fixedHtml, 'utf8');
        html = fixedHtml;
        imgsFixed += count;
        fixed({ type: 'image-max-width', file: `briefings/${dateDir}/${filename}`, count });
      }
    }
  }
}

// ── 3b. Missing briefing detection ───────────────────────────────────────────
// Hardcoded expected types — never inferred from recent history.
// Previous logic used a REQUIRED_APPEARANCES threshold which meant a briefing
// missing long enough would fall below the threshold and stop being flagged
// (survivorship bias). This version always checks for expected types.
{
  const RECENT_DAYS = 7;  // flag missing items within the last 7 date dirs

  // Expected daily briefings (always checked regardless of recent history)
  const EXPECTED_DAILY = [
    'market-briefing',
    'legal-brief',
    'ai-briefing',
    'rabbit-hole',
    'trading-concept',
  ];

  // Briefings on alternating schedules
  const EXPECTED_ODD_DAY  = ['praxis-brief'];    // odd day-of-month
  const EXPECTED_EVEN_DAY = ['biohacker-report']; // even day-of-month

  const flagDirs = dateDirs.slice(-RECENT_DAYS);

  for (const d of flagDirs) {
    const dayOfMonth = parseInt(d.split('-')[2], 10);
    const expected = [
      ...EXPECTED_DAILY,
      ...(dayOfMonth % 2 !== 0 ? EXPECTED_ODD_DAY : EXPECTED_EVEN_DAY),
    ];

    const files = fs.readdirSync(path.join(BRIEFINGS_DIR, d)).filter(f => f.endsWith('.html'));
    const present = new Set(files.map(f => f.replace('.html', '')));

    for (const t of expected) {
      if (!present.has(t)) {
        needsHuman({
          type: 'missing-briefing',
          date: d,
          briefing: `${t}.html`,
          file: `briefings/${d}/${t}.html`,
          message: `${t}.html absent for ${d} (expected daily type)`,
        });
      }
    }
  }
}

// Summary stats
if (zeroTagCount === 0) pass(`Tag extraction OK — all ${totalBriefings} briefings have tags`);
else console.log(`  ⚠ ${zeroTagCount} zero-tag briefing(s) found`);

if (missingTitleCount === 0) pass(`Title presence OK — all ${totalBriefings} briefings have <title>`);
if (tablesFixed > 0) pass(`Auto-fixed table overflow wrappers: ${tablesFixed} table(s) across affected files`);
else pass('Table overflow wrappers OK — no bare tables found');
if (imgsFixed > 0) pass(`Auto-fixed image max-width: ${imgsFixed} image(s) across affected files`);
else pass('Image max-width OK — no unbound images found');

// Systemic summary for back-links and meta descriptions
if (missingBacklinkCount === 0) {
  pass(`Back-link check OK — all ${totalBriefings} briefings have back-link`);
} else {
  report.checks_passed.push(`Back-link check: ${totalBriefings - missingBacklinkCount}/${totalBriefings} have back-link (${missingBacklinkCount} missing — recent files flagged above)`);
}
if (missingDescCount === 0) {
  pass(`Meta description check OK — all ${totalBriefings} briefings have og:description`);
} else {
  report.checks_passed.push(`Meta description check: ${totalBriefings - missingDescCount}/${totalBriefings} have og:description (${missingDescCount} missing — recent files flagged above)`);
}

// ── 4. Generate scripts run successfully ──────────────────────────────────────
console.log('Running generate-index.js...');
{
  // Use spawnSync so stderr is always accessible (execSync only surfaces stderr on non-zero exit)
  const indexResult = spawnSync('node', ['scripts/generate-index.js'], { cwd: ROOT, encoding: 'utf8' });
  const indexStderr = indexResult.stderr || '';
  if (indexResult.status !== 0) {
    error(`generate-index.js failed: ${indexStderr || (indexResult.error && indexResult.error.message) || 'unknown error'}`);
  } else {
    pass('generate-index.js ran successfully');
  }
  // Parse [validator] warnings — generate-index.js emits these for generic/fallback headlines
  // e.g. "⚠  [validator] market-briefing @ briefings/2026-04-26/market-briefing.html: headline looks like a section header"
  const validatorRe = /\[validator\]\s+(\S+)\s+@\s+([^:]+):\s+(.+)/g;
  let vm;
  while ((vm = validatorRe.exec(indexStderr))) {
    needsAI({ type: 'index-headline-quality', key: vm[1], file: vm[2].trim(), message: vm[3].trim() });
  }
}

console.log('Running generate-visualizations.js...');
try {
  execSync('node scripts/generate-visualizations.js', { cwd: ROOT, stdio: 'pipe' });
  pass('generate-visualizations.js ran successfully');
} catch (e) {
  error(`generate-visualizations.js failed: ${e.stderr ? e.stderr.toString() : e.message}`);
}

// ── Write report ──────────────────────────────────────────────────────────────
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

console.log('\n── Health Check Complete ──────────────────────────────────────────');
console.log(`Passed:     ${report.checks_passed.length} checks`);
console.log(`Auto-fixed: ${report.auto_fixed.length} items`);
console.log(`Needs AI:   ${report.needs_ai.length} items`);
console.log(`Needs human:${report.needs_human.length} items`);
console.log(`Errors:     ${report.errors.length}`);
console.log(`Report:     health-reports/${TODAY}.json`);
