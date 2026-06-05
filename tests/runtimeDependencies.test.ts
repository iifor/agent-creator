import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('runtime dependencies', () => {
  it('declares package imports used by src runtime code as dependencies', async () => {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const sourceFiles = await listSourceFiles('src');
    const packageImports = new Set<string>();

    for (const file of sourceFiles) {
      const text = await fs.readFile(file, 'utf8');
      for (const specifier of extractStaticImports(text)) {
        if (specifier.startsWith('.') || specifier.startsWith('node:')) continue;
        packageImports.add(packageName(specifier));
      }
    }

    for (const importedPackage of packageImports) {
      expect(packageJson.dependencies, `${importedPackage} must be in dependencies because src imports it at runtime`).toHaveProperty(importedPackage);
    }
  });
});

async function listSourceFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entryPath.includes(`${path.sep}capabilities${path.sep}`) && entryPath.includes(`${path.sep}files${path.sep}`)) return [];
    if (entry.isDirectory()) return listSourceFiles(entryPath);
    return entry.name.endsWith('.ts') ? [entryPath] : [];
  }));
  return files.flat();
}

function extractStaticImports(text: string): string[] {
  const specifiers: string[] = [];
  const importRegex = /import\s+(?!type\b)[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of text.matchAll(importRegex)) specifiers.push(match[1]);
  return specifiers;
}

function packageName(specifier: string): string {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}
