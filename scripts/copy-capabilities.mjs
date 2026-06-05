import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const capabilities = [
  {
    from: path.join(root, 'packages/cli/src/capabilities/agent-core/files'),
    to: path.join(root, 'packages/cli/dist/src/capabilities/agent-core/files'),
  },
];

for (const capability of capabilities) {
  await fs.rm(capability.to, { recursive: true, force: true });
  await fs.mkdir(path.dirname(capability.to), { recursive: true });
  await fs.cp(capability.from, capability.to, { recursive: true });
}
