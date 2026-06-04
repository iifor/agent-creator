import fs from 'node:fs/promises';
import path from 'node:path';

const templates = [
  {
    from: 'src/templates/tool-agent/files',
    to: 'dist/src/templates/tool-agent/files',
  },
];

for (const template of templates) {
  await fs.rm(template.to, { recursive: true, force: true });
  await fs.mkdir(path.dirname(template.to), { recursive: true });
  await fs.cp(template.from, template.to, { recursive: true });
}
