import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../', import.meta.url).pathname;
const fixtureRoot = join(root, '../browser/fixtures');
test('unpacked MV3 extension contains runnable modules and every scenario fixture', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'dist/manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.permissions.includes('debugger'));
  for (const path of ['runner.html', 'runner.js', 'background.js', 'vendor/browser/index.js', 'vendor/chrome/index.js']) assert.ok(existsSync(join(root, 'dist', path)), path);
  const runner = readFileSync(join(root, 'dist/runner.js'), 'utf8');
  const scenarios = [...runner.matchAll(/^  \['[^']+', '([^']+)', async/gm)].map(match => match[1]);
  assert.equal(scenarios.length, 13);
  for (const fixture of scenarios) assert.ok(existsSync(join(fixtureRoot, `${fixture}.html`)), fixture);
});
