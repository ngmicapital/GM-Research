'use strict';

// Concurrency-safe publish flow for automated briefing/transcript pushes.
//
// Why this exists: the daily briefing jobs are separate Claude sessions that
// all commit+push from ONE checkout. Raw `git add/commit/pull --rebase/push`
// sequences interleave across sessions — observed failures: one job's staged
// file landing in another job's commit, pushes that silently no-op, briefings
// stranded untracked (2026-07-01 praxis), and divergent side-branch variants
// (see readiness/EVIDENCE/failure-forensics.md row 4). Every automated pusher
// must go through publish() so the whole git critical section runs under one
// on-disk lock, and success is judged by CONTENT ON THE REMOTE, not by which
// git commands happened to exit 0.
//
// Protocol (all under .git/gm-publish.lock):
//   preflight → ff-sync to origin → regenerate site artifacts → stage ONLY the
//   caller's files + the generated artifacts → commit → push, retrying via
//   rebase (conflicts on GENERATED files auto-resolve by regenerating; a
//   conflict on real content aborts loudly) → verify each content file's blob
//   hash exists at origin/<branch>.
//
// Zero dependencies (Node >= 20 stdlib). Windows + Linux.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// Committed-but-regenerated-on-deploy artifacts. Rebase conflicts on these are
// resolved by taking either side and regenerating; they are staged on every
// publish so the committed copies stay fresh (ci.yml warns when they go stale).
const GENERATED = ['index.html', 'feed.xml', 'sitemap.xml', 'visualizations.html'];

const DEFAULT_GENERATORS = [
  ['scripts/generate-index.js', '--strict'],
  ['scripts/generate-visualizations.js'],
];

const LOCK_DIRNAME = 'gm-publish.lock';

function gitRun(root, args, { allowFail = false } = {}) {
  const res = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) throw new Error(`git ${args.join(' ')}: ${res.error.message}`);
  if (res.status !== 0 && !allowFail) {
    throw new Error(`git ${args.join(' ')} exited ${res.status}\n${res.stderr || res.stdout}`);
  }
  return { status: res.status, stdout: (res.stdout || '').trim(), stderr: (res.stderr || '').trim() };
}

function lockPath(root) {
  return path.join(root, '.git', LOCK_DIRNAME);
}

// Acquire the publish lock. mkdir is atomic on NTFS and POSIX, so exactly one
// process wins; losers poll. A lock older than staleMs is treated as left by a
// crashed session and taken over (loudly).
function acquireLock(root, { label = 'publish', waitMs = 15 * 60 * 1000, pollMs = 2000, staleMs = 10 * 60 * 1000, log = () => {} } = {}) {
  const dir = lockPath(root);
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'owner.json'), JSON.stringify({
        pid: process.pid, host: os.hostname(), label, acquired_at: new Date().toISOString(),
      }, null, 2));
      return dir;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      let age = 0;
      try { age = Date.now() - fs.statSync(dir).mtimeMs; } catch { continue; } // vanished — retry now
      if (age > staleMs) {
        log(`⚠ stale publish lock (${Math.round(age / 60000)}m old) — taking over`);
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* racer removed it first */ }
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error(`timed out after ${Math.round(waitMs / 60000)}m waiting for publish lock at ${dir}`);
      }
      const wait = pollMs + Math.floor(Math.random() * 500);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
    }
  }
}

function releaseLock(root) {
  try { fs.rmSync(lockPath(root), { recursive: true, force: true }); } catch { /* already gone */ }
}

function runGenerators(root, generators, log) {
  for (const gen of generators) {
    log(`· node ${gen.join(' ')}`);
    const res = spawnSync(process.execPath, gen, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    if (res.status !== 0) {
      throw new Error(`generator failed (node ${gen.join(' ')}):\n${(res.stdout || '') + (res.stderr || '')}`);
    }
  }
}

function conflictedFiles(root) {
  const out = gitRun(root, ['diff', '--name-only', '--diff-filter=U']).stdout;
  return out ? out.split('\n').map(s => s.trim()).filter(Boolean) : [];
}

function rebaseInProgress(root) {
  return fs.existsSync(path.join(root, '.git', 'rebase-merge'))
    || fs.existsSync(path.join(root, '.git', 'rebase-apply'));
}

// Drive an interrupted rebase to completion. Only GENERATED artifacts may be
// auto-resolved (take theirs — both sides are stale, the caller regenerates
// afterwards); any content conflict aborts the rebase, which restores the
// pre-rebase branch so the caller's commit is never lost. Each replayed commit
// can stop the rebase again, hence the loop. A resolution that leaves a commit
// empty needs --skip, not --continue.
function settleRebase(root, log) {
  for (let i = 0; rebaseInProgress(root); i++) {
    if (i >= 10) {
      gitRun(root, ['rebase', '--abort'], { allowFail: true });
      throw new Error('rebase did not settle after 10 rounds — aborted, local commit intact');
    }
    const conflicts = conflictedFiles(root);
    if (conflicts.length > 0) {
      if (!conflicts.every(c => GENERATED.includes(c))) {
        gitRun(root, ['rebase', '--abort'], { allowFail: true });
        throw new Error(`rebase conflict on content file(s) [${conflicts.join(', ')}] — aborted; the local commit is intact, escalate to a human`);
      }
      log(`auto-resolving generated-artifact conflict: ${conflicts.join(', ')}`);
      gitRun(root, ['checkout', '--theirs', '--', ...conflicts]);
      gitRun(root, ['add', '--', ...conflicts]);
    }
    const cont = gitRun(root, ['-c', 'core.editor=true', 'rebase', '--continue'], { allowFail: true });
    if (cont.status !== 0) {
      const skip = gitRun(root, ['rebase', '--skip'], { allowFail: true });
      if (skip.status !== 0 && rebaseInProgress(root)) {
        gitRun(root, ['rebase', '--abort'], { allowFail: true });
        throw new Error(`rebase could not continue or skip:\n${cont.stderr || cont.stdout}`);
      }
    }
  }
}

function blobHash(root, file) {
  return gitRun(root, ['hash-object', file]).stdout;
}

function remoteBlobHash(root, remote, branch, file) {
  const res = gitRun(root, ['rev-parse', `refs/remotes/${remote}/${branch}:${file}`], { allowFail: true });
  return res.status === 0 ? res.stdout : null;
}

// Publish `files` (repo-relative paths) to remote/branch. Returns
// { sha, alreadyPublished } on success; throws on any failure. Failure before
// the commit step leaves the working tree untouched apart from regenerated
// artifacts, so the caller's content is never lost — at worst it stays on disk
// for the stranded-content detector to flag.
function publish({
  root,
  files,
  message,
  remote = 'origin',
  branch = 'main',
  generators = DEFAULT_GENERATORS,
  maxPushAttempts = 3,
  lockOpts = {},
  log = () => {},
}) {
  if (!root || !fs.existsSync(path.join(root, '.git'))) throw new Error(`not a git repo root: ${root}`);
  if (!Array.isArray(files) || files.length === 0) throw new Error('no files given to publish');
  if (!message) throw new Error('a commit message is required');

  const rel = files.map(f => f.replace(/\\/g, '/'));
  for (const f of rel) {
    if (path.isAbsolute(f) || f.split('/').includes('..')) throw new Error(`file must be repo-relative: ${f}`);
    if (GENERATED.includes(f)) throw new Error(`${f} is a generated artifact — it is staged automatically, publish content files only`);
    const abs = path.join(root, f);
    if (!fs.existsSync(abs)) throw new Error(`file not found: ${f}`);
    if (fs.statSync(abs).size === 0) throw new Error(`refusing to publish empty file: ${f}`);
  }

  const head = gitRun(root, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout;
  if (head !== branch) {
    throw new Error(`checkout is on '${head}', expected '${branch}' — refusing to publish (see CLAUDE.md branch policy)`);
  }

  acquireLock(root, { ...lockOpts, log });
  try {
    // Sync up before building, so the regenerated index includes concurrent
    // content that already landed and most publishes never need a rebase.
    gitRun(root, ['fetch', remote, branch]);
    gitRun(root, ['merge', '--ff-only', `${remote}/${branch}`], { allowFail: true });

    runGenerators(root, generators, log);

    const toStage = [...rel, ...GENERATED.filter(g => fs.existsSync(path.join(root, g)))];
    gitRun(root, ['add', '--', ...toStage]);

    const staged = gitRun(root, ['diff', '--cached', '--name-only']).stdout;
    if (!staged) {
      // Nothing changed — a crashed prior run may already have pushed this.
      const ok = rel.every(f => remoteBlobHash(root, remote, branch, f) === blobHash(root, path.join(root, f)));
      if (ok) {
        log('nothing to commit — identical content already on the remote');
        return { sha: gitRun(root, ['rev-parse', 'HEAD']).stdout, alreadyPublished: true };
      }
      throw new Error('nothing staged, but remote content does not match the local files — investigate before retrying');
    }
    gitRun(root, ['commit', '-m', message]);

    let pushed = false;
    for (let attempt = 1; attempt <= maxPushAttempts && !pushed; attempt++) {
      const push = gitRun(root, ['push', remote, branch], { allowFail: true });
      if (push.status === 0) { pushed = true; break; }
      log(`push attempt ${attempt} rejected — rebasing onto ${remote}/${branch}`);
      gitRun(root, ['fetch', remote, branch]);
      // --empty=drop: if our commit became redundant (a crashed prior run
      // already pushed identical content), drop it and let verify arbitrate.
      gitRun(root, ['rebase', '--autostash', '--empty=drop', `${remote}/${branch}`], { allowFail: true });
      settleRebase(root, log);
      // The artifacts committed pre-rebase were built without the remote's
      // newest content — rebuild. A separate chore commit, never --amend:
      // after --empty=drop, HEAD may be someone else's already-pushed commit.
      runGenerators(root, generators, log);
      const dirty = gitRun(root, ['diff', '--name-only', '--', ...GENERATED], { allowFail: true }).stdout;
      if (dirty) {
        gitRun(root, ['add', '--', ...GENERATED.filter(g => fs.existsSync(path.join(root, g)))]);
        gitRun(root, ['commit', '-m', 'chore(index): regenerate after concurrent publish']);
      }
    }
    if (!pushed) throw new Error(`push failed after ${maxPushAttempts} attempts — commit is local, content is safe`);

    // Ground truth: the caller's bytes must be reachable at the remote branch.
    gitRun(root, ['fetch', remote, branch]);
    for (const f of rel) {
      const local = blobHash(root, path.join(root, f));
      const published = remoteBlobHash(root, remote, branch, f);
      if (published !== local) {
        throw new Error(`VERIFY FAILED: ${f} on ${remote}/${branch} is ${published || 'absent'}, local is ${local} — do not assume this published`);
      }
    }
    const sha = gitRun(root, ['rev-parse', 'HEAD']).stdout;
    log(`published ${sha} (${rel.join(', ')}) — verified on ${remote}/${branch}`);
    return { sha, alreadyPublished: false };
  } finally {
    releaseLock(root);
  }
}

module.exports = { publish, acquireLock, releaseLock, GENERATED, DEFAULT_GENERATORS, LOCK_DIRNAME };
