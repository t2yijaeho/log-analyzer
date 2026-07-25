import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'packages', 'log-core', 'fixtures');
const manifest = JSON.parse(await readFile(path.join(fixtureDir, 'manifest.json'), 'utf8'));

if (!Array.isArray(manifest.fixtures) || manifest.fixtures.length !== 3) {
  throw new Error('Fixture manifest must contain exactly Signal 1, Signal 2, and Signal 3');
}

for (const fixture of manifest.fixtures) {
  const bytes = await readFile(path.join(fixtureDir, fixture.file));
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== fixture.sha256) {
    throw new Error(`${fixture.file}: expected ${fixture.sha256}, received ${actual}`);
  }
  const lineCount = bytes.toString('utf8').split(/\r\n|\r|\n/).filter((line) => line.trim()).length;
  if (lineCount !== 1_000) throw new Error(`${fixture.file}: expected 1000 non-blank lines, received ${lineCount}`);
  console.log(`verified ${fixture.file} (${lineCount} lines, sha256 ${actual})`);
}
