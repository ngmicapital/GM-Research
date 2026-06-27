'use strict';

// Tests for the deterministic briefing renderer (scripts/lib/render.js).
// The renderer takes a per-type content contract (JSON) + a render template and
// produces the final briefing HTML — the model never emits CSS/structure, only
// the content object. Validation failures (missing section, too few cards,
// too-shallow section, bad gm-meta) must throw, never silently degrade — that is
// the guard against the Codex-style fidelity collapse.

const { test } = require('node:test');
const assert   = require('node:assert');
const fs       = require('fs');
const path     = require('path');

const { renderBriefing, renderSectionBriefing } = require('./render');

const TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'skills-briefings-files', 'briefing-rabbit-hole', 'template.render.html'),
  'utf8'
);

const AI_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'skills-briefings-files', 'briefing-ai-cortex', 'template.render.html'),
  'utf8'
);

const PRAXIS_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'skills-briefings-files', 'briefing-praxis', 'template.render.html'),
  'utf8'
);

const TC_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'skills-briefings-files', 'briefing-alpha', 'trading-concept', 'template.render.html'),
  'utf8'
);

const BIO_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'skills-briefings-files', 'briefing-biohacker', 'template.render.html'),
  'utf8'
);

const LEGAL_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'skills-briefings-files', 'briefing-legal-precedent', 'template.render.html'),
  'utf8'
);

const MARKET_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'skills-briefings-files', 'briefing-morning-edge', 'template.render.html'),
  'utf8'
);

function validContent() {
  return {
    topic_title: 'The Smell Nobody Could <em>Name</em> Until 1964',
    date: '27 June 2026',
    primary_category: 'Nature',
    secondary_category: 'How Things Work',
    header_meta_summary: 'How two Australian scientists finally named the scent of rain.',
    tldr_text: 'The smell of rain has a name — petrichor — but nobody coined it until 1964. Two CSIRO mineralogists traced it to an oil that plants bleed into dry soil.',
    tldr_long: 'In 1964 two Australian scientists finally gave the smell of rain a name, and the mechanism behind it is stranger than the word.',
    stats: [
      { value: '1964', label: 'Year named' },
      { value: '2', label: 'Scientists' },
      { value: 'CSIRO', label: 'Institution' },
      { value: '5 ppt', label: 'Detection limit' },
    ],
    gm_meta: {
      headline: 'The smell of rain went unnamed until 1964',
      preview: 'Two CSIRO scientists coined "petrichor" and traced it to an oil plants bleed into soil.',
      tags: ['Nature', 'How Things Work'],
    },
    sections: [
      { number: 'Section 01', title: 'The Story', blocks: [
        { type: 'p', html: 'It rained, and someone finally asked what the smell <strong>actually was</strong>.' },
        { type: 'pull_quote', text: 'We propose the name petrichor for this oil.', attrib: 'Bear & Thomas, Nature, 1964' },
        { type: 'p', html: 'The second paragraph of narrative momentum.' },
        { type: 'p', html: 'A third paragraph that earns the surprise.' },
      ]},
      { number: 'Section 02', title: 'The Mechanism', blocks: [
        { type: 'p', html: 'The chemistry of how the scent is released.' },
        { type: 'data_callout', label: 'The molecule', html: 'Geosmin is detectable at five parts per trillion.' },
        { type: 'p', html: 'How the plant oil and the bacterial molecule combine.' },
        { type: 'p', html: 'How a raindrop aerosolises both into the air.' },
      ]},
      { number: 'Section 03', title: 'The Connections', blocks: [
        { type: 'p', html: '<strong>Evolution.</strong> Why the sensitivity may be adaptive.' },
        { type: 'p', html: '<strong>The contrarian read.</strong> Where the popular version overreaches.' },
        { type: 'p', html: '<strong>Markets.</strong> Signal hidden in noise.' },
        { type: 'p', html: '<strong>The live dimension.</strong> What modern instruments now detect.' },
      ]},
    ],
    cards: [
      { icon: '📖', title: 'The book', text: 'A reference worth reading.' },
      { icon: '🧪', title: 'Geosmin', text: 'The molecule behind the scent.' },
      { icon: '🌧️', title: 'Petrichor', text: 'The coined word itself.' },
      { icon: '🛰️', title: 'Remote sensing', text: 'How satellites detect soil moisture.' },
    ],
    sources: [
      { author_or_org: 'Bear & Thomas', title: 'Nature of Argillaceous Odour', url: 'https://example.com/1964' },
      { author_or_org: 'CSIRO', title: 'The petrichor write-up', url: 'https://example.com/csiro' },
      { author_or_org: 'MIT News', title: 'Raindrop aerosol mechanism', url: 'https://example.com/mit' },
    ],
  };
}

test('renders all sections, stats, cards and sources into the template', () => {
  const html = renderBriefing('rabbit-hole', TEMPLATE, validContent());

  assert.match(html, /Section 01/);
  assert.match(html, /<h2>The Mechanism<\/h2>/);
  assert.match(html, /<h2>The Connections<\/h2>/);
  assert.match(html, /1964/);
  assert.match(html, /Year named/);
  assert.match(html, /We propose the name petrichor/);
  assert.match(html, /class="data-callout"/);
  assert.match(html, /Geosmin is detectable/);
  assert.strictEqual((html.match(/<div class="card">/g) || []).length, 4);
  assert.match(html, /<li><a href="https:\/\/example\.com\/1964">Bear &amp; Thomas/);
});

test('embeds gm-meta as valid JSON in the gm-meta script block', () => {
  const html = renderBriefing('rabbit-hole', TEMPLATE, validContent());
  const m = html.match(/<script type="application\/json" id="gm-meta">([\s\S]*?)<\/script>/);
  assert.ok(m, 'gm-meta script block present');
  const meta = JSON.parse(m[1]);
  assert.strictEqual(meta.headline, 'The smell of rain went unnamed until 1964');
  assert.deepStrictEqual(meta.tags, ['Nature', 'How Things Work']);
});

test('topic title is plain text in <title> but keeps <em> in <h1>', () => {
  const html = renderBriefing('rabbit-hole', TEMPLATE, validContent());
  const title = html.match(/<title>([\s\S]*?)<\/title>/)[1];
  assert.ok(!/<em>/.test(title), '<title> must not contain element tags');
  assert.match(title, /The Smell Nobody Could Name Until 1964/);
  assert.match(html, /<h1>The Smell Nobody Could <em>Name<\/em> Until 1964<\/h1>/);
});

test('leaves no unfilled {{TOKENS}} in the output', () => {
  const html = renderBriefing('rabbit-hole', TEMPLATE, validContent());
  const leftover = html.match(/\{\{[A-Z0-9_]+\}\}/g);
  assert.strictEqual(leftover, null, `unfilled tokens: ${leftover && leftover.join(', ')}`);
});

test('throws when a required section is missing', () => {
  const c = validContent();
  c.sections = c.sections.slice(0, 2); // only 2 of 3
  assert.throws(() => renderBriefing('rabbit-hole', TEMPLATE, c), /3 section/);
});

test('throws when a section is too shallow (depth floor)', () => {
  const c = validContent();
  // Connections cut to 2 paragraphs — below the §03 minimum of 4.
  c.sections[2].blocks = [
    { type: 'p', html: '<strong>Markets.</strong> One thin paragraph.' },
    { type: 'p', html: '<strong>Coda.</strong> A second thin paragraph.' },
  ];
  assert.throws(() => renderBriefing('rabbit-hole', TEMPLATE, c), /paragraph/);
});

test('throws when there are too few cards', () => {
  const c = validContent();
  c.cards = c.cards.slice(0, 3); // 3 < min 4
  assert.throws(() => renderBriefing('rabbit-hole', TEMPLATE, c), /card/);
});

test('throws when gm_meta.headline is missing', () => {
  const c = validContent();
  delete c.gm_meta.headline;
  assert.throws(() => renderBriefing('rabbit-hole', TEMPLATE, c), /headline/);
});

test('throws when gm_meta contains HTML entities instead of real Unicode', () => {
  const c = validContent();
  c.gm_meta.headline = 'Petrichor &mdash; the smell of rain';
  assert.throws(() => renderBriefing('rabbit-hole', TEMPLATE, c), /entit/i);
});

test('throws when there are too few sources', () => {
  const c = validContent();
  c.sources = c.sources.slice(0, 2); // 2 < min 3
  assert.throws(() => renderBriefing('rabbit-hole', TEMPLATE, c), /source/);
});

test('throws when a source is missing its url', () => {
  const c = validContent();
  delete c.sources[0].url;
  assert.throws(() => renderBriefing('rabbit-hole', TEMPLATE, c), /source/);
});

// ── Section-fragment renderer (ai-briefing and the other rich briefings) ──────
// The writer supplies each section's inner HTML; the renderer locks the page
// chrome + gm-meta and enforces section presence + a per-section length floor.

function validAi() {
  const tokens = {
    ISSUE_NUMBER: '82', DATE: '27 June 2026', DAY_OF_WEEK: 'Saturday',
    TOP_HEADLINE_1: 'Decentralized AI', TOP_HEADLINE_2: 'Open models', TOP_HEADLINE_3: 'Agents',
    TLDR: 'The biggest move today is decentralized AI compute coming of age.',
  };
  for (let i = 1; i <= 8; i++) tokens[`SECTION_${i}_TITLE`] = `Section ${i} Title`;
  const sections = {};
  for (let i = 1; i <= 8; i++) {
    sections[`SECTION_${i}_BODY`] =
      '<p class="skim"><strong>One-sentence skim.</strong></p><p>' + 'analysis '.repeat(45) + '</p>';
  }
  return {
    tokens,
    gm_meta: {
      headline: 'Decentralized AI compute is the day\'s real move',
      preview: 'Venice/VVV, Bittensor and Akash all shipped — the spine of AI is decentralising.',
      tags: ['AI', 'Decentralized AI'],
    },
    raw: {
      TLDR_DETAIL: '<p>Two things to act on, three to monitor.</p>',
      FOOTER_SOURCES: '<h4>Sources</h4><ul><li><a href="https://venice.ai">Venice</a></li></ul>',
    },
    sections,
  };
}

test('renderSectionBriefing fills the ai-briefing chrome, gm-meta and all sections', () => {
  const html = renderSectionBriefing('ai-briefing', AI_TEMPLATE, validAi());
  assert.match(html, /<script type="application\/json" id="gm-meta">\{/);
  assert.match(html, /Issue 82/);
  assert.match(html, /class="skim tldr-text">The biggest move today/);
  assert.strictEqual(html.match(/\{\{[A-Z0-9_]+\}\}/g), null, 'no unfilled tokens');
});

test('renderSectionBriefing throws when a section body is missing', () => {
  const c = validAi();
  delete c.sections.SECTION_5_BODY;
  assert.throws(() => renderSectionBriefing('ai-briefing', AI_TEMPLATE, c), /SECTION_5_BODY/);
});

test('renderSectionBriefing throws when a section is below the length floor', () => {
  const c = validAi();
  c.sections.SECTION_2_BODY = '<p>too short</p>';
  assert.throws(() => renderSectionBriefing('ai-briefing', AI_TEMPLATE, c), /too short/);
});

test('renderSectionBriefing throws on malformed gm_meta', () => {
  const c = validAi();
  delete c.gm_meta.headline;
  assert.throws(() => renderSectionBriefing('ai-briefing', AI_TEMPLATE, c), /headline/);
});

// ── praxis-brief + trading-concept (section-fragment, more token shapes) ──────

function validPraxis() {
  const sections = {};
  for (let i = 1; i <= 4; i++) {
    sections[`SECTION_${i}_BODY`] = '<div class="card"><h3 class="card-title">Idea</h3><p>' + 'insight '.repeat(160) + '</p></div>';
  }
  return {
    tokens: { DATE: '27 June 2026', OG_DESCRIPTION: 'This week converges on internal leverage.', TLDR: 'The highest-leverage gains are internal.' },
    gm_meta: { headline: 'The leverage is internal', preview: 'Manson, Housel and Clear converge on one move.', tags: ['Mind', 'Finance'] },
    raw: { FOOTER_SOURCES: '<p class="footer-meta">Praxis · Sydney</p><ul><li><a href="https://collabfund.com">Housel</a></li></ul>' },
    sections,
  };
}

test('renderSectionBriefing renders praxis-brief with no leftover tokens', () => {
  const html = renderSectionBriefing('praxis-brief', PRAXIS_TEMPLATE, validPraxis());
  assert.match(html, /<script type="application\/json" id="gm-meta">\{/);
  assert.match(html, /The highest-leverage gains are internal/);
  assert.strictEqual(html.match(/\{\{[A-Z0-9_]+\}\}/g), null, 'no unfilled tokens');
});

function validTradingConcept() {
  const tokens = { CONCEPT_NAME: 'Order Flow', OG_DESCRIPTION: 'What order flow is and why it matters.', DATE: '27 June 2026', ISSUE_NUMBER: '40', READING_TIME: '6 min' };
  const raw = { TLDR: 'Order flow is the tape of <em>aggression</em> — who is hitting whom.', FOOTER_SOURCES: '<p>Alpha · Issue 40 · Sydney</p>' };
  for (let i = 1; i <= 8; i++) {
    const n = String(i).padStart(2, '0');
    tokens[`SECTION_TITLE_${n}`] = `Section ${n}`;
    tokens[`SECTION_SUB_${n}`] = `Subtitle ${n}`;
    raw[`SKIM_${n}`] = `<strong>Skim line ${i} with <em>accent</em>.</strong>`;
  }
  const sections = {};
  for (let i = 1; i <= 8; i++) sections[`SECTION_${i}_BODY`] = '<p>' + 'tape '.repeat(200) + '</p>';
  sections.SECTION_3_BODY = '<svg viewBox="0 0 800 420"><text x="10" y="20">CVD</text></svg><p>' + 'diagram '.repeat(150) + '</p>';
  return { tokens, gm_meta: { headline: 'Order flow, decoded', preview: 'How to read aggression on the tape.', tags: ['Orderflow', 'Microstructure'] }, raw, sections };
}

test('renderSectionBriefing renders trading-concept incl. the inline SVG, keeping skim markup', () => {
  const html = renderSectionBriefing('trading-concept', TC_TEMPLATE, validTradingConcept());
  assert.match(html, /<svg/);
  assert.match(html, /Skim line 1 with <em>accent<\/em>/); // SKIM tokens are raw, markup preserved
  assert.strictEqual(html.match(/\{\{[A-Z0-9_]+\}\}/g), null, 'no unfilled tokens');
});

test('renderSectionBriefing aborts a trading-concept whose §03 has no inline SVG', () => {
  const c = validTradingConcept();
  c.sections.SECTION_3_BODY = '<p>' + 'no diagram here '.repeat(70) + '</p>'; // long, but no <svg>
  assert.throws(() => renderSectionBriefing('trading-concept', TC_TEMPLATE, c), /svg/i);
});

function validBio() {
  const sections = {};
  for (let i = 0; i <= 5; i++) sections[`SECTION_${i}_BODY`] = '<p>' + 'evidence '.repeat(70) + '</p>';
  return {
    tokens: { ISSUE_NUMBER: 'BIO-120', DATE: '27 June 2026', EDITION_LABEL: 'Biohacker Report', TLDR: 'The strongest signal this cycle is metabolic flexibility.' },
    gm_meta: { headline: 'Biohacker — the real signal this cycle', preview: 'Longevity, training and supplement evidence, rated and sourced.', tags: ['Longevity', 'Training'] },
    raw: { TLDR_DETAIL: '<p>Three things to try this cycle.</p>', FOOTER_SOURCES: '<p>Biohacker · Sydney</p><ul><li><a href="https://x">x</a></li></ul>' },
    sections,
  };
}

test('renderSectionBriefing renders biohacker-report with 0-indexed sections', () => {
  const html = renderSectionBriefing('biohacker-report', BIO_TEMPLATE, validBio());
  assert.match(html, /<script type="application\/json" id="gm-meta">\{/);
  assert.match(html, /metabolic flexibility/);
  assert.strictEqual(html.match(/\{\{[A-Z0-9_]+\}\}/g), null, 'no unfilled tokens');
});

// legal-brief: repeating story cards live in one raw fragment (raw.STORIES), so the
// rawToken needs its OWN length floor + marker guard (sections[] is empty here).

function validLegal() {
  const story = '<article class="story-card tier-high"><h2 class="story-title">A regulatory development with real substance</h2><div class="quote">"A verbatim official quote here."</div><p>' + 'practitioner analysis '.repeat(60) + '</p></article>';
  return {
    tokens: { DATE: '27 June 2026', DATE_LINE: 'Saturday, 27 June 2026', OG_DESCRIPTION: 'ASIC sharpens crypto licensing.', STORY_COUNT: '4', SOURCE_COUNT: '12', PERIOD: 'Past 24 Hours' },
    gm_meta: { headline: 'ASIC turns crypto compliance into a deadline', preview: 'A 30 June licensing deadline and a High Court win sharpen the message.', tags: ['ASIC', 'Licensing'] },
    raw: {
      SIDEBAR_NAV: '<a href="#story-1">Story 1</a><a href="#story-2">Story 2</a>',
      STORIES: story.repeat(4),
      BRIEF_NOTES_BODY: '<p>A couple of lower-tier notes.</p>',
      COUNTDOWN_BODY: '<tr><td>A named regulatory deadline</td><td>2026-07-30</td><td>33 days</td></tr>'.repeat(8),
      PIPELINE_BODY: '<tr><td>CLARITY Act</td><td>US</td><td>Committee</td><td>Advanced</td></tr>'.repeat(8),
      CONSULTATIONS_BODY: '<tr><td>Treasury consultation on digital assets</td><td>AU</td><td>OPEN</td></tr>'.repeat(8),
      FOOTER_SOURCES: '<h4>Tier 1 — Regulators</h4><p>SEC, CFTC, FDIC, OCC, Federal Reserve, FinCEN, FCA, ESMA, ASIC, MAS</p><h4>Tier 5 — Media</h4><p>CoinDesk, The Block</p>',
    },
    sections: {},
  };
}

test('renderSectionBriefing renders legal-brief (empty sections, raw STORIES blob)', () => {
  const html = renderSectionBriefing('legal-brief', LEGAL_TEMPLATE, validLegal());
  assert.match(html, /class="story-title"/);
  assert.match(html, /<script type="application\/json" id="gm-meta">\{/);
  assert.strictEqual(html.match(/\{\{[A-Z0-9_]+\}\}/g), null, 'no unfilled tokens');
});

test('renderSectionBriefing enforces a length floor on the raw STORIES fragment', () => {
  const c = validLegal();
  c.raw.STORIES = '<article class="story-card"><h2 class="story-title">One thin story</h2></article>'; // valid markup but far too short
  assert.throws(() => renderSectionBriefing('legal-brief', LEGAL_TEMPLATE, c), /STORIES.*short|too short/i);
});

test('renderSectionBriefing enforces the story-card marker on STORIES', () => {
  const c = validLegal();
  c.raw.STORIES = '<p>' + 'lots of words but no story cards '.repeat(150) + '</p>'; // long but no story-title
  assert.throws(() => renderSectionBriefing('legal-brief', LEGAL_TEMPLATE, c), /STORIES/);
});

// market-briefing: section-fragment with table `requires` guards + OPTIONAL tokens
// (catalyst banner / since-yesterday strip omitted on quiet days).

function validMarket() {
  const tokens = { DATE: '27 June 2026', OG_DESCRIPTION: 'Pre-market read.', READING_TIME: '8 min', CONVICTION: 'Medium' };
  const raw = { CONVICTION_COLOR: '#f0a030', TLDR_THESIS: '<p>The dominant variable today is the Fed path.</p>', FOOTER_SOURCES: '<p>Sources: CoinGecko, TrueNorth, Yahoo</p>' };
  for (let i = 1; i <= 8; i++) raw[`SECTION_${i}_TITLE`] = `&#127757; Section ${i}`;
  // CATALYST_BANNER and DELTA_STRIP deliberately omitted — they are optional.
  const sections = {};
  for (let i = 1; i <= 8; i++) sections[`SECTION_${i}_BODY`] = '<p>' + 'macro analysis '.repeat(200) + '</p>';
  for (const i of [1, 2, 3, 6]) sections[`SECTION_${i}_BODY`] = '<table><tr><td>SPX</td><td>5800</td></tr></table><p>' + 'analysis '.repeat(400) + '</p>';
  return { tokens, gm_meta: { headline: 'Fed path is the dominant variable today', preview: 'Macro, crypto and prediction markets converge.', tags: ['Macro', 'Crypto'] }, raw, sections };
}

test('renderSectionBriefing renders market-briefing, omitting absent optional tokens', () => {
  const html = renderSectionBriefing('market-briefing', MARKET_TEMPLATE, validMarket());
  assert.match(html, /<script type="application\/json" id="gm-meta">\{/);
  assert.match(html, /<table>/);
  assert.strictEqual(html.match(/\{\{[A-Z0-9_]+\}\}/g), null, 'optional tokens fill empty, none left over');
});

test('renderSectionBriefing enforces the data-table requirement on market §3', () => {
  const c = validMarket();
  c.sections.SECTION_3_BODY = '<p>' + 'no data table here '.repeat(300) + '</p>'; // long but no <table>
  assert.throws(() => renderSectionBriefing('market-briefing', MARKET_TEMPLATE, c), /table|SECTION_3/i);
});
