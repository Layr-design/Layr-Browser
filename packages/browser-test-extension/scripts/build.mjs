import { mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../', import.meta.url).pathname;
const dist = join(root, 'dist');
mkdirSync(join(dist, 'vendor/browser'), { recursive: true });
mkdirSync(join(dist, 'vendor/chrome'), { recursive: true });
for (const name of readdirSync(join(root, 'src'))) copyFileSync(join(root, 'src', name), join(dist, name));
for (const name of readdirSync(join(root, '../browser/dist/src'))) if (name.endsWith('.js')) copyFileSync(join(root, '../browser/dist/src', name), join(dist, 'vendor/browser', name));
for (const name of readdirSync(join(root, '../browser-driver-chrome/dist/src'))) if (name.endsWith('.js')) copyFileSync(join(root, '../browser-driver-chrome/dist/src', name), join(dist, 'vendor/chrome', name));
