'use strict';

// Unit tests for the shared build library. Run with: node --test scripts/lib/
// Zero dependencies — uses the Node built-in test runner (node:test).

const { test } = require('node:test');
const assert = require('node:assert');

const { escapeHtml, stripHtml } = require('./text');
const { formatDate, formatShortDate, formatDayLabel, todayAEST } = require('./dates');
const { BRIEFING_META, ORDER, BRIEFING_FILENAMES, extractTags, readMeta } = require('./briefings');

test('escapeHtml escapes the four HTML-significant characters', () => {
  assert.strictEqual(escapeHtml('a & b < c > d "e"'), 'a &amp; b &lt; c &gt; d &quot;e&quot;');
  assert.strictEqual(escapeHtml(42), '42');
});

test('stripHtml removes tags and decodes named entities', () => {
  assert.strictEqual(stripHtml('<p>Risk&nbsp;assets &mdash; up</p>'), 'Risk assets — up');
  assert.strictEqual(stripHtml('A&times;B&divide;C&minus;D'), 'A×B÷C−D');
  assert.strictEqual(stripHtml('History&nbsp;&middot;&nbsp;Biography'), 'History · Biography');
});

test('stripHtml decodes hex and decimal numeric entities', () => {
  assert.strictEqual(stripHtml('&#x2696;&#xFE0F;'), '⚖️');
  assert.strictEqual(stripHtml('&#8217;'), '’');
});

test('stripHtml collapses whitespace and trims', () => {
  assert.strictEqual(stripHtml('  a\n\t  b   c  '), 'a b c');
});

test('date helpers are timezone-stable (noon UTC anchor)', () => {
  assert.strictEqual(formatDate('2026-06-13'), 'Saturday, June 13, 2026');
  assert.strictEqual(formatShortDate('2026-06-13'), 'Jun 13');
  assert.strictEqual(formatDayLabel('2026-06-13'), 'Sat');
});

test('todayAEST returns a well-formed ISO date', () => {
  const { iso } = todayAEST();
  assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
});

test('briefing metadata is internally consistent', () => {
  assert.strictEqual(ORDER.length, Object.keys(BRIEFING_META).length);
  for (const key of ORDER) {
    assert.ok(BRIEFING_META[key], `ORDER key ${key} exists in BRIEFING_META`);
    assert.strictEqual(BRIEFING_FILENAMES[key], BRIEFING_META[key].filename);
  }
});

test('extractTags pulls ticker-style tags and caps at 3', () => {
  const html = '<p>BTC broke out while ETH lagged; SOL and DXY also moved, Gold too.</p>';
  const tags = extractTags(html, 'market-briefing');
  assert.deepStrictEqual(tags, ['BTC', 'ETH', 'SOL']);
});

test('extractTags is stable across repeated calls (no lastIndex leak)', () => {
  const html = '<p>SEC and CFTC weighed in on Ripple.</p>';
  const first = extractTags(html, 'legal-brief');
  const second = extractTags(html, 'legal-brief');
  assert.deepStrictEqual(first, second);
  assert.deepStrictEqual(first, ['SEC', 'CFTC', 'Ripple']);
});

test('extractTags splits middot-joined rabbit-hole categories', () => {
  const html = '<div class="header-category">History &middot; Biography</div>';
  assert.deepStrictEqual(extractTags(html, 'rabbit-hole'), ['History', 'Biography']);
});

test('extractTags returns [] for unknown types', () => {
  assert.deepStrictEqual(extractTags('<p>anything</p>', 'no-such-type'), []);
});

test('readMeta returns null when no gm-meta block is present', () => {
  assert.strictEqual(readMeta('<html><body><p>no meta here</p></body></html>'), null);
});

test('readMeta parses a valid gm-meta block and caps tags at 3', () => {
  const html = '<head><script type="application/json" id="gm-meta">{"headline":"Big thesis","preview":"the why","tags":["BTC","VIX","macro","extra"]}</script></head>';
  assert.deepStrictEqual(readMeta(html), { headline: 'Big thesis', preview: 'the why', tags: ['BTC', 'VIX', 'macro'] });
});

test('readMeta is defensive against malformed JSON and a missing headline', () => {
  assert.strictEqual(readMeta('<script id="gm-meta">{not json}</script>'), null);
  assert.strictEqual(readMeta('<script id="gm-meta">{"preview":"no headline"}</script>'), null);
});
