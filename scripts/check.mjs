import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const files = ['server.mjs'];
for (const directory of ['public', 'scripts', 'tests']) for (const entry of await readdir(directory, { withFileTypes: true })) if (entry.isFile() && entry.name.endsWith('.mjs')) files.push(`${directory}/${entry.name}`);
for (const file of files) { const result = spawnSync(process.execPath, ['--check', resolve(file)], { stdio: 'inherit' }); if (result.status) process.exit(result.status); }
console.log(`${files.length} JavaScript modules passed syntax checks.`);
