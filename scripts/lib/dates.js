'use strict';

// Shared date helpers. Every date is constructed at noon UTC so the displayed
// day never drifts across a timezone boundary; "today" is computed in AEST
// (Australia/Sydney) to match the publishing convention.

function atNoonUTC(ds) {
  return new Date(`${ds}T12:00:00Z`);
}

function formatDate(ds) {
  return atNoonUTC(ds).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function formatShortDate(ds) {
  return atNoonUTC(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatDayLabel(ds) {
  return atNoonUTC(ds).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

// Returns { date: Date, iso: 'YYYY-MM-DD' } for "now" in AEST.
function todayAEST() {
  const date = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
  const iso = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  return { date, iso };
}

module.exports = { atNoonUTC, formatDate, formatShortDate, formatDayLabel, todayAEST };
