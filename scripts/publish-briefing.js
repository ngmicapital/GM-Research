#!/usr/bin/env node
'use strict';

// Concurrency-safe publisher for automated content pushes. ALL scheduled
// briefing/transcript jobs must publish through this instead of raw
// add/commit/push — see scripts/lib/publish.js for why and for the protocol.
//
//   node scripts/publish-briefing.js --type ai-briefing --date 2026-07-02
//   node scripts/publish-briefing.js --file transcripts/foo/index.html \
//        --file transcripts/manifest.json --message "Add transcript: foo"
//
// Options:
//   --type <key> --date <YYYY-MM-DD>  briefing shorthand: derives the file
//                                     (briefings/<date>/<filename>) and the
//                                     "Add <type> for <date>" message
//   --file <repo-relative-path>       explicit file (repeatable)
//   --message "<msg>"                 commit message (required with --file)
//   --root <path>                     repo root (default: this script's repo;
//                                     used by tests)
//   --skip-generators                 tests only — skip index/viz regeneration
//
// Exit codes: 0 published & content-verified on origin/main (or identical
// content already there) · 1 failed before push, nothing lost, file still on
// disk · 2 push happened but remote content does not match — needs a human.

const path = require('path');
const { publish, DEFAULT_GENERATORS } = require('./lib/publish');
const { BRIEFING_FILENAMES } = require('./lib/briefings');

function parseArgs(argv) {
  const out = { files: [], skipGenerators: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--type') out.type = argv[++i];
    else if (a === '--date') out.date = argv[++i];
    else if (a === '--file') out.files.push(argv[++i]);
    else if (a === '--message') out.message = argv[++i];
    else if (a === '--root') out.root = argv[++i];
    else if (a === '--skip-generators') out.skipGenerators = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root ? path.resolve(args.root) : path.resolve(__dirname, '..');

  if (args.type) {
    const filename = BRIEFING_FILENAMES[args.type];
    if (!filename) throw new Error(`unknown briefing type '${args.type}' — known: ${Object.keys(BRIEFING_FILENAMES).join(', ')}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date || '')) throw new Error('--type requires --date YYYY-MM-DD');
    args.files.push(`briefings/${args.date}/${filename}`);
    if (!args.message) args.message = `Add ${args.type} for ${args.date}`;
  }
  if (args.files.length === 0) throw new Error('nothing to publish — pass --type/--date or --file (see header)');
  if (!args.message) throw new Error('--message is required when publishing by --file');

  const { sha, alreadyPublished } = publish({
    root,
    files: args.files,
    message: args.message,
    generators: args.skipGenerators ? [] : DEFAULT_GENERATORS,
    log: (m) => console.log(m),
  });
  console.log(`PUBLISH ${alreadyPublished ? 'ALREADY' : 'OK'} ${sha}`);
}

try {
  main();
} catch (err) {
  const verifyFailed = /VERIFY FAILED/.test(err.message);
  console.error(`PUBLISH FAIL ${err.message}`);
  process.exit(verifyFailed ? 2 : 1);
}
