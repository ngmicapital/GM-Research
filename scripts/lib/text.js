'use strict';

// Shared HTML text utilities for the GM-Research build scripts.
// Canonical source of truth — do not re-implement stripHtml/escapeHtml in
// individual scripts. (Previously duplicated 3+ ways with diverging entity
// coverage; consolidated here so every script decodes entities identically.)

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Strip tags + decode the named/numeric HTML entities that show up in briefing
// prose, collapse whitespace, and trim. The named-entity list is the union of
// every entity previously handled by any script.
function stripHtml(s) {
  return String(s)
    .replace(/<[^>]*>/g, '')
    // Named entities
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&hellip;/g, '…')
    .replace(/&minus;/g, '−').replace(/&plus;/g, '+').replace(/&times;/g, '×').replace(/&divide;/g, '÷')
    .replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lsquo;/g, '‘').replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/&apos;/g, "'").replace(/&copy;/g, '©').replace(/&reg;/g, '®')
    // Numeric entities (hex and decimal)
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/\s+/g, ' ').trim();
}

module.exports = { escapeHtml, stripHtml };
