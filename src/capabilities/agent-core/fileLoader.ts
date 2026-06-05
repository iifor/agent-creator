import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CreateOptions } from '../../types/cli.js';
import type { AgentCapabilityFile } from '../../types/capability.js';
import { normalizePath } from '../../utils/path.js';
import { AGENT_CORE_CAPABILITY_VERSION, CLI_VERSION, CURRENT_CONFIG_VERSION } from '../../version.js';

const capabilityDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'files');

export async function loadAgentCoreFiles(projectName: string, options: CreateOptions = {}): Promise<AgentCapabilityFile[]> {
  const mode = options.mode === 'package' ? 'package' : 'service';
  const baseFiles = await readCapabilityFiles(path.join(capabilityDir, 'base'));
  const serviceFiles = mode === 'service' ? await readCapabilityFiles(path.join(capabilityDir, 'service')) : [];
  const files = mergeFiles([...baseFiles, ...serviceFiles]);
  return files.map((file) => ({
    path: file.path,
    content: file.content
      .replaceAll('{{projectName}}', projectName)
      .replaceAll('{{cliVersion}}', CLI_VERSION)
      .replaceAll('{{configVersion}}', CURRENT_CONFIG_VERSION)
      .replaceAll('{{capabilityVersion}}', AGENT_CORE_CAPABILITY_VERSION)
      .replaceAll('{{serviceEnabled}}', mode === 'service' ? 'true' : 'false')
      .replaceAll('{{serviceFramework}}', mode === 'service' ? "'next'" : 'undefined'),
  }));
}

function mergeFiles(files: AgentCapabilityFile[]): AgentCapabilityFile[] {
  const byPath = new Map<string, AgentCapabilityFile>();
  for (const file of files) byPath.set(file.path, file);
  return [...byPath.values()];
}

async function readCapabilityFiles(directory: string, baseDir = directory): Promise<AgentCapabilityFile[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return readCapabilityFiles(entryPath, baseDir);
    const relativePath = normalizePath(path.relative(baseDir, entryPath));
    return [{ path: relativePath, content: await fs.readFile(entryPath, 'utf8') }];
  }));
  return files.flat();
}
