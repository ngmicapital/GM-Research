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

const { renderBriefing } = require('./render');

const TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'skills-briefings-files', 'briefing-rabbit-hole', 'template.render.html'),
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
