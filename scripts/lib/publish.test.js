'use strict';

// Tests for the concurrency-safe publish flow (publish.js). These run REAL git
// against throwaway repos in the OS temp dir — no network, no touching this
// repo. The centerpiece is the concurrent-publish race test: the exact failure
// that used to drop/duplicate same-day briefings (failure-forensics row 4).

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const { publish, acquireLock, LOCK_DIRNAME } = require('./publish');
const CLI = path.resolve(__dirname, '..', 'publish-briefing.js');

function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${res.stderr || res.stdout}`);
  return res.stdout.trim();
}

// Bare "origin" + a working clone with one seed commit on main.
function makeFixture(t) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-publish-test-'));
  t.after(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows lag */ } });
  const bare = path.join(tmp, 'origin.git');
  run('git', ['init', '--bare', '--initial-branch=main', bare]);
  const work = clone(tmp, bare, 'work');
  fs.writeFileSync(path.join(work, 'README.md'), 'seed\n');
  run('git', ['add', '--', 'README.md'], work);
  run('git', ['commit', '-m', 'seed'], work);
  run('git', ['push', '-u', 'origin', 'main'], work);
  return { tmp, bare, work };
}

function clone(tmp, bare, name) {
  const dir = path.join(tmp, name);
  run('git', ['-c', 'init.defaultBranch=main', 'clone', bare, dir]);
  run('git', ['config', 'user.name', 'test'], dir);
  run('git', ['config', 'user.email', 'test@example.com'], dir);
  run('git', ['config', 'core.autocrlf', 'false'], dir);
  return dir;
}

function writeContent(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  return abs;
}

function remoteFile(bare, rel) {
  const res = spawnSync('git', ['-C', bare, 'cat-file', '-p', `main:${rel}`], { encoding: 'utf8', windowsHide: true });
  return res.status === 0 ? res.stdout : null;
}

test('publish lands the file on the remote and verifies its content', (t) => {
  const { bare, work } = makeFixture(t);
  writeContent(work, 'briefings/2026-01-01/a.html', '<html>A</html>\n');
  const { sha, alreadyPublished } = publish({
    root: work, files: ['briefings/2026-01-01/a.html'], message: 'Add a', generators: [],
  });
  assert.ok(sha.length >= 7);
  assert.equal(alreadyPublished, false);
  assert.equal(remoteFile(bare, 'briefings/2026-01-01/a.html'), '<html>A</html>\n');
  assert.ok(!fs.existsSync(path.join(work, '.git', LOCK_DIRNAME)), 'lock released');
});

test('RACE: two concurrent publishers in one checkout both land, nothing lost', async (t) => {
  const { bare, work } = makeFixture(t);
  writeContent(work, 'briefings/2026-01-02/a.html', 'AAA\n');
  writeContent(work, 'briefings/2026-01-02/b.html', 'BBB\n');
  const runCli = (file, msg) => new Promise((resolve) => {
    const p = spawn(process.execPath, [
      CLI, '--root', work, '--file', file, '--message', msg, '--skip-generators',
    ], { windowsHide: true });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { out += d; });
    p.on('close', code => resolve({ code, out }));
  });
  const [a, b] = await Promise.all([
    runCli('briefings/2026-01-02/a.html', 'Add a'),
    runCli('briefings/2026-01-02/b.html', 'Add b'),
  ]);
  assert.equal(a.code, 0, `publisher A failed:\n${a.out}`);
  assert.equal(b.code, 0, `publisher B failed:\n${b.out}`);
  assert.equal(remoteFile(bare, 'briefings/2026-01-02/a.html'), 'AAA\n');
  assert.equal(remoteFile(bare, 'briefings/2026-01-02/b.html'), 'BBB\n');
});

test('diverged history with generated-artifact conflict auto-resolves and regenerates', (t) => {
  const { tmp, bare, work } = makeFixture(t);
  // Someone else published content + a fresh index.html to the remote.
  const other = clone(tmp, bare, 'other');
  writeContent(other, 'briefings/2026-01-03/other.html', 'OTHER\n');
  writeContent(other, 'index.html', 'REMOTE-GEN\n');
  run('git', ['add', '--', 'briefings/2026-01-03/other.html', 'index.html'], other);
  run('git', ['commit', '-m', 'Add other'], other);
  run('git', ['push', 'origin', 'main'], other);
  // Our checkout diverges: a local commit already touches index.html.
  writeContent(work, 'index.html', 'LOCAL-STALE\n');
  run('git', ['add', '--', 'index.html'], work);
  run('git', ['commit', '-m', 'stale local index'], work);
  // "Generator" stamps a deterministic index.html.
  writeContent(work, 'briefings/2026-01-03/mine.html', 'MINE\n');
  const gen = [['-e', 'require("fs").writeFileSync("index.html","MERGED-GEN\\n")']];
  publish({ root: work, files: ['briefings/2026-01-03/mine.html'], message: 'Add mine', generators: gen });
  assert.equal(remoteFile(bare, 'briefings/2026-01-03/mine.html'), 'MINE\n');
  assert.equal(remoteFile(bare, 'briefings/2026-01-03/other.html'), 'OTHER\n', 'concurrent content preserved');
  assert.equal(remoteFile(bare, 'index.html'), 'MERGED-GEN\n', 'artifact regenerated after rebase');
});

test('a stale lock is taken over instead of deadlocking', (t) => {
  const { bare, work } = makeFixture(t);
  const lock = path.join(work, '.git', LOCK_DIRNAME);
  fs.mkdirSync(lock);
  const old = new Date(Date.now() - 60 * 60 * 1000);
  fs.utimesSync(lock, old, old);
  writeContent(work, 'briefings/2026-01-04/a.html', 'A\n');
  const warnings = [];
  publish({
    root: work, files: ['briefings/2026-01-04/a.html'], message: 'Add a', generators: [],
    lockOpts: { staleMs: 10 * 60 * 1000 }, log: m => warnings.push(m),
  });
  assert.equal(remoteFile(bare, 'briefings/2026-01-04/a.html'), 'A\n');
  assert.ok(warnings.some(w => /stale publish lock/.test(w)), 'takeover was logged');
});

test('a live lock makes the second publisher wait, not fail', (t) => {
  const { bare, work } = makeFixture(t);
  const lock = acquireLock(work, { label: 'holder' });
  // Release the lock shortly after the publisher starts polling.
  const releaser = spawn(process.execPath, ['-e',
    `setTimeout(() => require('fs').rmSync(${JSON.stringify(lock)}, {recursive:true, force:true}), 1500)`,
  ], { windowsHide: true, detached: false });
  writeContent(work, 'briefings/2026-01-05/a.html', 'A\n');
  publish({
    root: work, files: ['briefings/2026-01-05/a.html'], message: 'Add a', generators: [],
    lockOpts: { pollMs: 300, waitMs: 30 * 1000 },
  });
  assert.equal(remoteFile(bare, 'briefings/2026-01-05/a.html'), 'A\n');
  releaser.kill();
});

test('refuses to publish from the wrong branch, an empty file, or a generated artifact', (t) => {
  const { work } = makeFixture(t);
  writeContent(work, 'briefings/2026-01-06/a.html', 'A\n');
  run('git', ['checkout', '-b', 'feature'], work);
  assert.throws(
    () => publish({ root: work, files: ['briefings/2026-01-06/a.html'], message: 'x', generators: [] }),
    /refusing to publish/,
  );
  run('git', ['checkout', 'main'], work);
  writeContent(work, 'briefings/2026-01-06/empty.html', '');
  assert.throws(
    () => publish({ root: work, files: ['briefings/2026-01-06/empty.html'], message: 'x', generators: [] }),
    /empty file/,
  );
  assert.throws(
    () => publish({ root: work, files: ['index.html'], message: 'x', generators: [] }),
    /generated artifact/,
  );
});
