import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forbidden = [
  /(^|\/)\.env(?:$|\.(?!example$))/,
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)coverage\//,
  /(^|\/)\.playwright-mcp\//,
  /(^|\/)\.claude\/settings\.local\.json$/,
];
const secretPatterns = [
  { name: 'OpenAI API key', re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/ },
  { name: 'private key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
];

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString('utf8').split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

async function sourceFiles(dir, prefix = '') {
  const ignoredDirs = new Set(['.git', '.claude', 'node_modules', 'dist', 'coverage', '.playwright-mcp']);
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path.join(dir, entry.name), relative)));
    else if (!relative.startsWith('.env')) files.push(relative);
  }
  return files;
}

const tracked = trackedFiles();
const files = tracked.length > 0 ? tracked : await sourceFiles(root);
const forbiddenFiles = files.filter((file) => forbidden.some((pattern) => pattern.test(file.replaceAll('\\', '/'))));
if (forbiddenFiles.length) throw new Error(`Forbidden publication files:\n${forbiddenFiles.join('\n')}`);

for (const file of files) {
  let text;
  try {
    text = tracked.length > 0
      ? execFileSync('git', ['show', `:${file}`], {
          cwd: root,
          stdio: ['ignore', 'pipe', 'ignore'],
          maxBuffer: 25 * 1024 * 1024,
        }).toString('utf8')
      : await readFile(path.join(root, file), 'utf8');
  } catch {
    continue;
  }
  for (const pattern of secretPatterns) {
    if (pattern.re.test(text)) throw new Error(`${pattern.name} pattern found in ${file}`);
  }
}

console.log(`release publication set passed (${files.length} files scanned)`);
