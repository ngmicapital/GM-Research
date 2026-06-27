#!/usr/bin/env node
'use strict';

// render-briefing.js — CLI wrapper around scripts/lib/render.js (Stage C of the
// briefing pipeline). The authoring model writes a content JSON; this turns it
// into the final styled HTML using the canonical render template.
//
//   node scripts/render-briefing.js <type> <content.json> <out.html>
//
// Exit codes: 0 ok · 1 validation/render failure · 2 bad usage.

const fs   = require('fs');
const path = require('path');
const { renderBriefing, renderSectionBriefing, SCHEMAS, FRAGMENT_SCHEMAS } = require('./lib/render');

const TEMPLATES = {
  'rabbit-hole': path.join(__dirname, '..', 'skills-briefings-files', 'briefing-rabbit-hole', 'template.render.html'),
  'ai-briefing': path.join(__dirname, '..', 'skills-briefings-files', 'briefing-ai-cortex', 'template.render.html'),
  'praxis-brief': path.join(__dirname, '..', 'skills-briefings-files', 'briefing-praxis', 'template.render.html'),
  'trading-concept': path.join(__dirname, '..', 'skills-briefings-files', 'briefing-alpha', 'trading-concept', 'template.render.html'),
  'biohacker-report': path.join(__dirname, '..', 'skills-briefings-files', 'briefing-biohacker', 'template.render.html'),
};

function main() {
  const [type, contentPath, outPath] = process.argv.slice(2);
  if (!type || !contentPath || !outPath) {
    console.error('Usage: node scripts/render-briefing.js <type> <content.json> <out.html>');
    process.exit(2);
  }
  const tplPath = TEMPLATES[type];
  if (!tplPath) {
    console.error(`Unknown type "${type}". Known: ${Object.keys(TEMPLATES).join(', ')}`);
    process.exit(2);
  }

  let template, content;
  try {
    template = fs.readFileSync(tplPath, 'utf8');
  } catch (e) {
    console.error(`✗ cannot read template ${tplPath}: ${e.message}`);
    process.exit(1);
  }
  try {
    content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  } catch (e) {
    console.error(`✗ cannot read/parse content ${contentPath}: ${e.message}`);
    process.exit(1);
  }

  let html;
  try {
    html = SCHEMAS[type]
      ? renderBriefing(type, template, content)          // strict per-block contract (rabbit-hole)
      : renderSectionBriefing(type, template, content);  // section-fragment contract (rich briefings)
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`✓ Rendered ${type} → ${outPath} (${html.length} bytes)`);
}

main();
