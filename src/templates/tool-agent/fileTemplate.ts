import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TemplateFile } from '../../types/template.js';
import { normalizePath } from '../../utils/path.js';
import { CLI_VERSION, CURRENT_CONFIG_VERSION, TOOL_AGENT_TEMPLATE_VERSION } from '../../version.js';

const templateDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'files');

export async function loadToolAgentFiles(projectName: string): Promise<TemplateFile[]> {
  const files = await readTemplateFiles(templateDir);
  return files.map((file) => ({
    path: file.path,
    content: file.content
      .replaceAll('{{projectName}}', projectName)
      .replaceAll('{{cliVersion}}', CLI_VERSION)
      .replaceAll('{{configVersion}}', CURRENT_CONFIG_VERSION)
      .replaceAll('{{templateVersion}}', TOOL_AGENT_TEMPLATE_VERSION),
  }));
}

async function readTemplateFiles(directory: string, baseDir = directory): Promise<TemplateFile[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return readTemplateFiles(entryPath, baseDir);
    const relativePath = normalizePath(path.relative(baseDir, entryPath));
    return [{ path: relativePath, content: await fs.readFile(entryPath, 'utf8') }];
  }));
  return files.flat();
}
