import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const distDir = path.resolve(args[0] ?? 'dist');
  const excludePrefixes = readExcludePrefixes(args.slice(1));
  const processed = await minifyDist(distDir, { excludePrefixes });
  console.log(`Minified ${processed} JavaScript file${processed === 1 ? '' : 's'} in ${path.relative(process.cwd(), distDir) || '.'}.`);
}

export async function minifyDist(distDir, options = {}) {
  const resolvedDistDir = path.resolve(distDir);
  const excludePrefixes = (options.excludePrefixes ?? []).map(normalizePrefix).filter(Boolean);
  const jsFiles = await collectJavaScriptFiles(resolvedDistDir);
  let processed = 0;

  for (const file of jsFiles) {
    const relativePath = toPosix(path.relative(resolvedDistDir, file));
    if (excludePrefixes.some((prefix) => relativePath.startsWith(prefix))) continue;

    const source = await fs.readFile(file, 'utf8');
    const result = await minify({ [relativePath]: source }, {
      compress: {
        passes: 2,
      },
      ecma: 2022,
      format: {
        comments: false,
      },
      mangle: {
        toplevel: true,
      },
      module: true,
      toplevel: true,
    });
    if (!result.code) throw new Error(`Failed to minify ${relativePath}`);
    await fs.writeFile(file, result.code);
    processed += 1;
  }

  return processed;
}

function readExcludePrefixes(values) {
  const prefixes = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--exclude-prefix') {
      prefixes.push(normalizePrefix(values[index + 1] ?? ''));
      index += 1;
    } else if (value.startsWith('--exclude-prefix=')) {
      prefixes.push(normalizePrefix(value.slice('--exclude-prefix='.length)));
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return prefixes.filter(Boolean);
}

async function collectJavaScriptFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJavaScriptFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(entryPath);
    }
  }

  return files;
}

function normalizePrefix(value) {
  const normalized = toPosix(value).replace(/^\/+/, '');
  if (!normalized) return '';
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}
