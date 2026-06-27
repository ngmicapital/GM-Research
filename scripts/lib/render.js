'use strict';

// render.js — deterministic briefing renderer.
//
// Takes a per-type *content contract* (a plain JSON object the authoring model
// returns) plus a render template (template.render.html) and produces the final
// briefing HTML. The model supplies ONLY content; this module owns all
// structure and markup. Validation failures throw — they never silently degrade
// — which is what makes a cheaper model safe: a missing section or malformed
// gm-meta aborts the render instead of publishing a stunted page.
//
// Pure module (no IO) so it is unit-testable; the CLI wrapper lives in
// scripts/render-briefing.js.

const { escapeHtml, stripHtml } = require('./text');

const SCHEMAS = {
  'rabbit-hole': {
    statsCount: 4, cardsMin: 4, cardsMax: 5, sourcesMin: 3,
    // Per-section paragraph floor — a cheaper model under-delivering depth (the
    // Codex failure mode, and dc's "connections too shallow" note) aborts the
    // render instead of publishing a thin page.
    sections: [
      { minParagraphs: 3 }, // §01 The Story
      { minParagraphs: 3 }, // §02 The Mechanism
      { minParagraphs: 4 }, // §03 The Connections — deepest section
    ],
  },
};

// Section-fragment briefings: the writer supplies each section's inner HTML; the
// renderer locks the page chrome + gm-meta and enforces section presence + a
// per-section length floor (depth). Used for the rich 8-section briefings where a
// full per-block JSON schema would be heavy. minChars is a deliberate floor that
// rejects a stunted section (the Codex failure mode) without over-constraining.
const FRAGMENT_SCHEMAS = {
  'ai-briefing': {
    stringTokens: ['ISSUE_NUMBER', 'DATE', 'DAY_OF_WEEK',
      'TOP_HEADLINE_1', 'TOP_HEADLINE_2', 'TOP_HEADLINE_3', 'TLDR',
      'SECTION_1_TITLE', 'SECTION_2_TITLE', 'SECTION_3_TITLE', 'SECTION_4_TITLE',
      'SECTION_5_TITLE', 'SECTION_6_TITLE', 'SECTION_7_TITLE', 'SECTION_8_TITLE'],
    rawTokens: ['TLDR_DETAIL', 'FOOTER_SOURCES'],
    sections: [
      { token: 'SECTION_1_BODY', minChars: 300 },
      { token: 'SECTION_2_BODY', minChars: 300 },
      { token: 'SECTION_3_BODY', minChars: 200 },
      { token: 'SECTION_4_BODY', minChars: 200 },
      { token: 'SECTION_5_BODY', minChars: 200 },
      { token: 'SECTION_6_BODY', minChars: 200 },
      { token: 'SECTION_7_BODY', minChars: 150 },
      { token: 'SECTION_8_BODY', minChars: 120 },
    ],
  },
};

function fail(msg) { throw new Error(`render: ${msg}`); }
function nonEmptyStr(v) { return typeof v === 'string' && v.trim().length > 0; }
function hasEntities(s) { return /&[a-zA-Z]+;|&#\d+;/.test(s); }

// ── Validation ────────────────────────────────────────────────────────────────
// All structural + field checks happen here, up front, before any rendering.

function validate(type, c) {
  const schema = SCHEMAS[type];
  if (!schema) fail(`unknown briefing type "${type}"`);
  if (!c || typeof c !== 'object') fail('content must be an object');

  for (const f of ['topic_title', 'date', 'primary_category', 'secondary_category',
                   'header_meta_summary', 'tldr_text', 'tldr_long']) {
    if (!nonEmptyStr(c[f])) fail(`missing/empty field: ${f}`);
  }

  if (!Array.isArray(c.stats) || c.stats.length !== schema.statsCount) {
    fail(`need exactly ${schema.statsCount} stats`);
  }
  c.stats.forEach((s, i) => {
    if (!s || (!nonEmptyStr(String(s.value ?? '')) || !nonEmptyStr(String(s.label ?? '')))) {
      fail(`stat ${i + 1} needs value and label`);
    }
  });

  validateGmMeta(c.gm_meta);

  if (!Array.isArray(c.sections) || c.sections.length !== schema.sections.length) {
    fail(`need exactly ${schema.sections.length} sections`);
  }
  c.sections.forEach((sec, i) => {
    if (!nonEmptyStr(sec.number)) fail(`section ${i + 1} needs a number`);
    if (!nonEmptyStr(sec.title)) fail(`section ${i + 1} needs a title`);
    if (!Array.isArray(sec.blocks) || sec.blocks.length === 0) fail(`section ${i + 1} needs blocks`);
    sec.blocks.forEach((b, j) => validateBlock(b, i + 1, j + 1));
    const paras = sec.blocks.filter(b => b && b.type === 'p').length;
    const min = schema.sections[i].minParagraphs;
    if (paras < min) fail(`section ${i + 1} is too shallow — needs at least ${min} paragraphs (has ${paras})`);
  });

  if (!Array.isArray(c.cards) || c.cards.length < schema.cardsMin || c.cards.length > schema.cardsMax) {
    fail(`need ${schema.cardsMin}-${schema.cardsMax} cards`);
  }
  c.cards.forEach((card, i) => {
    if (!nonEmptyStr(card.icon) || !nonEmptyStr(card.title) || !nonEmptyStr(card.text)) {
      fail(`card ${i + 1} needs icon, title and text`);
    }
  });

  if (!Array.isArray(c.sources) || c.sources.length < schema.sourcesMin) {
    fail(`need at least ${schema.sourcesMin} source(s)`);
  }
  c.sources.forEach((s, i) => {
    if (!nonEmptyStr(s.author_or_org) || !nonEmptyStr(s.title) || !nonEmptyStr(s.url)) {
      fail(`source ${i + 1} needs author_or_org, title and url`);
    }
  });
}

function validateBlock(b, sec, idx) {
  if (!b || typeof b !== 'object') fail(`section ${sec} block ${idx} is invalid`);
  switch (b.type) {
    case 'p':
      if (!nonEmptyStr(b.html)) fail(`section ${sec} block ${idx} (p) needs html`);
      break;
    case 'pull_quote':
      if (!nonEmptyStr(b.text)) fail(`section ${sec} block ${idx} (pull_quote) needs text`);
      break;
    case 'data_callout':
      if (!nonEmptyStr(b.html)) fail(`section ${sec} block ${idx} (data_callout) needs html`);
      break;
    default:
      fail(`section ${sec} block ${idx} has unknown type "${b.type}"`);
  }
}

// ── Block / list rendering ──────────────────────────────────────────────────
// `html`/`text` fields carry intentional inline markup (<strong>/<em>/<a>) and
// are trusted; plain-text fields (labels, card text, sources) are escaped.

function renderBlock(b) {
  if (b.type === 'p') return `    <p>${b.html}</p>`;
  if (b.type === 'pull_quote') {
    const attrib = b.attrib ? `<br><em>&mdash; ${escapeHtml(b.attrib)}</em>` : '';
    return `    <div class="pull-quote">${b.text}${attrib}</div>`;
  }
  // data_callout
  const label = b.label ? `<div class="dc-label">${escapeHtml(b.label)}</div>` : '';
  return `    <div class="data-callout">${label}<p>${b.html}</p></div>`;
}

function renderSectionBody(sec) {
  return sec.blocks.map(renderBlock).join('\n');
}

function renderCards(cards) {
  return cards.map(c =>
    `      <div class="card">\n` +
    `        <div class="card-icon">${escapeHtml(c.icon)}</div>\n` +
    `        <div class="card-title">${escapeHtml(c.title)}</div>\n` +
    `        <p class="card-text">${escapeHtml(c.text)}</p>\n` +
    `      </div>`
  ).join('\n');
}

function renderSources(sources) {
  return sources.map(s =>
    `      <li><a href="${escapeHtml(s.url)}">${escapeHtml(s.author_or_org)} &mdash; &ldquo;${escapeHtml(s.title)}&rdquo;</a></li>`
  ).join('\n');
}

// ── Main render ───────────────────────────────────────────────────────────────

function renderBriefing(type, template, content) {
  validate(type, content);

  const repl = {
    '{{DATE}}': escapeHtml(content.date),
    '{{TOPIC_TITLE}}': escapeHtml(stripHtml(content.topic_title)), // plain text for <title>/og
    '{{TOPIC_TITLE_HTML}}': content.topic_title,                   // may carry <em> for <h1>
    '{{PRIMARY_CATEGORY}}': escapeHtml(content.primary_category),
    '{{SECONDARY_CATEGORY}}': escapeHtml(content.secondary_category),
    '{{HEADER_META_SUMMARY}}': escapeHtml(content.header_meta_summary),
    '{{TLDR}}': escapeHtml(content.tldr_text),
    '{{TLDR_LONG}}': content.tldr_long,
    '{{GM_META}}': gmMetaJson(content.gm_meta),
    '{{CARDS}}': renderCards(content.cards),
    '{{SOURCES}}': renderSources(content.sources),
  };

  content.stats.forEach((s, i) => {
    repl[`{{STAT_${i + 1}_VALUE}}`] = escapeHtml(String(s.value));
    repl[`{{STAT_${i + 1}_LABEL}}`] = escapeHtml(String(s.label));
  });

  content.sections.forEach((sec, i) => {
    repl[`{{SECTION_${i + 1}_NUMBER}}`] = escapeHtml(sec.number);
    repl[`{{SECTION_${i + 1}_TITLE}}`]  = sec.title;
    repl[`{{SECTION_${i + 1}_BODY}}`]   = renderSectionBody(sec);
  });

  let html = template;
  for (const [token, value] of Object.entries(repl)) {
    html = html.split(token).join(value);
  }

  const leftover = html.match(/\{\{[A-Z0-9_]+\}\}/g);
  if (leftover) fail(`unfilled template tokens: ${[...new Set(leftover)].join(', ')}`);

  return html;
}

// ── gm-meta (shared by both renderers) ───────────────────────────────────────

function validateGmMeta(m) {
  if (!m || typeof m !== 'object') fail('missing gm_meta');
  if (!nonEmptyStr(m.headline)) fail('gm_meta.headline required');
  if (m.headline.length > 90) fail('gm_meta.headline must be <=90 chars');
  if (!nonEmptyStr(m.preview)) fail('gm_meta.preview required');
  if (m.preview.length > 180) fail('gm_meta.preview must be <=180 chars');
  if (hasEntities(m.headline) || hasEntities(m.preview)) {
    fail('gm_meta headline/preview must use real Unicode, not HTML entities');
  }
  if (!Array.isArray(m.tags) || m.tags.length < 1 || m.tags.length > 3) {
    fail('gm_meta.tags must be 1-3 tags');
  }
}

function gmMetaJson(m) {
  // Escape "<" so a stray "</script>" inside a value can't break out of the block.
  return JSON.stringify(m).replace(/</g, '\\u003c');
}

// ── Section-fragment renderer ─────────────────────────────────────────────────

function renderSectionBriefing(type, template, content) {
  const schema = FRAGMENT_SCHEMAS[type];
  if (!schema) fail(`unknown section-fragment type "${type}"`);
  if (!content || typeof content !== 'object') fail('content must be an object');
  validateGmMeta(content.gm_meta);

  const repl = { '{{GM_META}}': gmMetaJson(content.gm_meta) };

  for (const t of schema.stringTokens) {
    const v = content.tokens && content.tokens[t];
    if (!nonEmptyStr(v)) fail(`missing token: ${t}`);
    repl[`{{${t}}}`] = escapeHtml(String(v));
  }
  for (const t of schema.rawTokens) {
    const v = content.raw && content.raw[t];
    if (!nonEmptyStr(v)) fail(`missing fragment: ${t}`);
    repl[`{{${t}}}`] = v; // trusted inner HTML
  }
  for (const s of schema.sections) {
    const v = content.sections && content.sections[s.token];
    if (!nonEmptyStr(v)) fail(`missing section: ${s.token}`);
    if (v.length < s.minChars) {
      fail(`section ${s.token} too short — needs >=${s.minChars} chars (has ${v.length})`);
    }
    repl[`{{${s.token}}}`] = v; // trusted inner HTML
  }

  let html = template;
  for (const [token, value] of Object.entries(repl)) {
    html = html.split(token).join(value);
  }
  const leftover = html.match(/\{\{[A-Z0-9_]+\}\}/g);
  if (leftover) fail(`unfilled template tokens: ${[...new Set(leftover)].join(', ')}`);
  return html;
}

module.exports = {
  renderBriefing, renderSectionBriefing,
  validate, validateGmMeta,
  SCHEMAS, FRAGMENT_SCHEMAS,
};
