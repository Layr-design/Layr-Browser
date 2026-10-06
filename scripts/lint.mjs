import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const sources = ['packages/browser/src', 'packages/browser-driver-chrome/src'];
let failed = false;
for (const directory of sources) for (const name of readdirSync(directory)) {
  if (!name.endsWith('.ts')) continue;
  const path = join(directory, name); const content = readFileSync(path, 'utf8');
  const rules = [
    [/\bconsole\.(log|debug|info)\s*\(/, 'console logging'],
    [/\bany\b/, 'explicit any'],
    [/\b(TODO|FIXME)\b/, 'unfinished marker'],
    ...(directory === 'packages/browser/src' ? [[/\bchrome\.|\bfrom\s+['"](?:playwright|puppeteer)/, 'browser-specific core import']] : [])
  ];
  for (const [pattern, label] of rules) if (pattern.test(content)) { process.stderr.write(`${path}: ${label}\n`); failed = true; }
}
if (failed) process.exitCode = 1;
