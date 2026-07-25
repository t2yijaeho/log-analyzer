import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = [
  ['release-log-analyzer', '.agents/skills/release-log-analyzer'],
  ['work-on-dashboard', 'apps/web/.agents/skills/work-on-dashboard'],
  ['work-on-log-api', 'apps/api/.agents/skills/work-on-log-api'],
  ['change-log-core', 'packages/log-core/.agents/skills/change-log-core'],
];

for (const [expectedName, relativeDir] of skills) {
  const skillDir = path.join(root, relativeDir);
  const markdown = await readFile(path.join(skillDir, 'SKILL.md'), 'utf8');
  const metadata = await readFile(path.join(skillDir, 'agents', 'openai.yaml'), 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1];
  if (!frontmatter) throw new Error(`${relativeDir}: missing YAML frontmatter`);
  const name = /^name:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
  const description = /^description:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
  if (name !== expectedName) throw new Error(`${relativeDir}: expected name ${expectedName}, received ${name}`);
  if (!description || description.includes('TODO')) throw new Error(`${relativeDir}: missing complete description`);
  if (!metadata.includes(`$${expectedName}`)) throw new Error(`${relativeDir}: default prompt must mention $${expectedName}`);
  if (markdown.includes('TODO')) throw new Error(`${relativeDir}: unresolved TODO`);
  console.log(`validated ${relativeDir}`);
}
