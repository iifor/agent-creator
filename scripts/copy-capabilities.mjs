import fs from 'node:fs/promises';
import path from 'node:path';

const capabilities = [
  {
    from: 'src/capabilities/agent-core/files',
    to: 'dist/src/capabilities/agent-core/files',
  },
];

for (const capability of capabilities) {
  await fs.rm(capability.to, { recursive: true, force: true });
  await fs.mkdir(path.dirname(capability.to), { recursive: true });
  await fs.cp(capability.from, capability.to, { recursive: true });
}
