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
const { execSync } = require('child_process');

const ROOT            = path.join(__dirname, '..');
const BRIEFINGS_DIR   = path.join(ROOT, 'briefings');
const TRANSCRIPTS_DIR = path.join(ROOT, 'transcripts');
const MANIFEST_FILE   = path.join(TRANSCRIPTS_DIR, 'manifest.json');
const REPORTS_DIR     = path.join(ROOT, 'health-reports');
const DEPLOY_YML      = path.join(ROOT, '.github', 'workflows', 'deploy.yml');

const TODAY = new Date().toISOString().slice(0, 10);
const REPORT_FILE = path.join(REPORTS_DIR, `${TODAY}.json`);

// ─── Tag extraction (mirrors generate-index.js logic) ─────────────────────────

const TAG_PATTERNS = {
  'market-briefing':  /\b(BTC|ETH|SOL|Gold|SPX|VIX|WTI|Brent|DXY|NVDA|TSLA)\b/g,
  'legal-brief':      /\b(SEC|CFTC|ESMA|FCA|MAS|ASIC|OCC|MiCA|GENIUS|CLARITY|FIT21|Ripple|Coinbase|Binance)\b/g,
  'ai-briefing':      /\b(Claude|GPT|Gemini|DeepSeek|Mistral|NVIDIA|Llama|Anthropic|OpenAI|Google)\b/g,
  'biohacker-report': /\b(Creatine|GLP-1|VO2max|Huberman|Zone 2|Sleep|HRV|Cortisol|Testosterone)\b/g,
  'rabbit-hole':      /<span class="further-card-pill">([^<]+)<\/span>/g,
  'praxis-brief':     /\b(Stoic|Stoicism|Farnam|Manson|Philosophy|Strategy|CBT|Second Brain|Obsidian)\b/g,
};

const BRIEFING_FILENAMES = {
  'market-briefing':  'market-briefing.html',
  'legal-brief':      'legal-brief.html',
  'ai-briefing':      'ai-briefing.html',
  'biohacker-report': 'biohacker-report.html',
  'rabbit-hole':      'rabbit-hole.html',
  'praxis-brief':     'praxis-brief.html',
};

function extractTags(html, key) {
  const tagRe = TAG_PATTERNS[key];
  if (!tagRe) return [];
  tagRe.lastIndex = 0;
  const found = new Set();
  let m;
  while ((m = tagRe.exec(html))) found.add(m[1]);
  return [...found].slice(0, 3);
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
      return match.replace(/(\bstyle\s*=\s*["'])([^"']*)(["'])/i, (_, open, val, close) => {
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

// Summary stats
if (zeroTagCount === 0) pass(`Tag extraction OK — all ${totalBriefings} briefings have tags`);
else console.log(`  ⚠ ${zeroTagCount} zero-tag briefing(s) found`);

if (missingTitleCount === 0) pass(`Title presence OK — all ${totalBriefings} briefings have <title>`);
if (tablesFixed > 0) pass(`Auto-fixed table overflow wrappers: ${tablesFixed} table(s) across affected files`);
else pass('Table overflow wrappers OK — no bare tables found');
if (imgsFixed > 0) pass(`Auto-fixed image max-width: ${imgsFixed} image(s) across affected files`);
else pass('Image max-width OK — no unbound images found');

// Systemic summary for back-links and meta descriptions (not per-file noise for old content)
if (missingBacklinkCount > 0) {
  report.checks_passed.push(`Back-link check: ${totalBriefings - missingBacklinkCount}/${totalBriefings} have back-link (${missingBacklinkCount} missing — recent files flagged above)`);
}
if (missingDescCount > 0) {
  report.checks_passed.push(`Meta description check: ${totalBriefings - missingDescCount}/${totalBriefings} have og:description (${missingDescCount} missing — recent files flagged above)`);
}

// ── 4. Generate scripts run successfully ──────────────────────────────────────
console.log('Running generate-index.js...');
try {
  execSync('node scripts/generate-index.js', { cwd: ROOT, stdio: 'pipe' });
  pass('generate-index.js ran successfully');
} catch (e) {
  error(`generate-index.js failed: ${e.stderr ? e.stderr.toString() : e.message}`);
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
