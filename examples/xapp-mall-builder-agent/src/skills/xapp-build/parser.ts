import {
  channels,
  getKnownPackages,
  matchChannel,
  type Channel,
  type IntentHelpers,
  type VersionStrategy,
  type XappEnv,
  type XappIntent,
  type XappMode,
} from './intents.js';

export type ParseIntentResult =
  | { ok: true; intent: XappIntent }
  | {
      ok: false;
      reason: 'empty' | 'env-unknown' | 'direct-without-package';
      partial?: Partial<XappIntent>;
    };

export function parseIntent(message: string, helpers: IntentHelpers = {}): ParseIntentResult {
  const text = String(message || '').trim();
  if (!text) return { ok: false, reason: 'empty' };

  const lower = text.toLowerCase();
  const env = parseEnv(lower);
  const channel = matchChannel(text) ?? 'wx';
  const version = parseVersion(text, lower);
  const known = helpers.knownPackages ?? getKnownPackages(helpers.repoRoot);
  const packages = extractPackages(text, known);
  const uploadAll = /(全部|所有|全量|整包)/.test(text) || /\ball\b/i.test(lower);
  const mode = parseMode(text, lower, packages, uploadAll);

  if (!env) return { ok: false, reason: 'env-unknown', partial: { channel, version, packages, uploadAll, mode } };

  if (mode === 'direct' && packages.length === 0 && !uploadAll) {
    return { ok: false, reason: 'direct-without-package', partial: { env, channel, version, packages, uploadAll, mode } };
  }

  return {
    ok: true,
    intent: {
      env,
      channel,
      packages,
      uploadAll,
      version,
      mode,
      source: 'regex',
      originalText: text,
    },
  };
}

export function normalizeIntent(raw: unknown, originalText: string, helpers: IntentHelpers = {}): ParseIntentResult {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'empty' };
  const value = raw as Record<string, unknown>;
  const env = value.env === 'prod' || value.env === 'qa' ? value.env : undefined;
  const channel = isChannel(value.channel) ? value.channel : 'wx';
  const version = isVersion(value.version) ? value.version : 'patch';
  const known = helpers.knownPackages ?? getKnownPackages(helpers.repoRoot);
  const knownSet = new Set(known);
  const packages = Array.isArray(value.packages)
    ? [...new Set(value.packages.filter((item): item is string => typeof item === 'string' && knownSet.has(item)))]
    : [];
  const uploadAll = Boolean(value.uploadAll);
  const mode = isMode(value.mode) ? value.mode : packages.length || uploadAll ? 'direct' : 'build';

  if (!env) return { ok: false, reason: 'env-unknown', partial: { channel, version, packages, uploadAll, mode } };
  if (mode === 'direct' && packages.length === 0 && !uploadAll) {
    return { ok: false, reason: 'direct-without-package', partial: { env, channel, version, packages, uploadAll, mode } };
  }

  return {
    ok: true,
    intent: {
      env,
      channel,
      packages,
      uploadAll,
      version,
      mode,
      source: 'llm',
      originalText,
    },
  };
}

function parseEnv(lower: string): XappEnv | undefined {
  if (/(prod|线上|正式|生产)/.test(lower)) return 'prod';
  if (/(qa|测试|预发)/.test(lower)) return 'qa';
  return undefined;
}

function parseVersion(text: string, lower: string): VersionStrategy {
  if (/(不更新|不改版本|直接推送|多渠道)/.test(text)) return 'none';
  if (/(次级版本|次版本|minor)/.test(lower)) return 'minor';
  if (/(大版本|major)/.test(lower)) return 'major';
  return 'patch';
}

function parseMode(text: string, lower: string, packages: string[], uploadAll: boolean): XappMode {
  if (/(发版|正式发布|发布版本|出版本|发新版|更新版本)/.test(text)) return 'release';
  if (/(构建|build|打包)/.test(lower)) return 'build';
  if (packages.length || uploadAll || /(强制|force|强推|直接上传|直传|只传|单独上传|上传)/.test(lower)) return 'direct';
  return 'build';
}

function extractPackages(text: string, knownPackages: string[]): string[] {
  const known = new Set(knownPackages);
  const candidates = text.match(/[A-Za-z][A-Za-z0-9_]+/g) ?? [];
  return [...new Set(candidates.filter((candidate) => known.has(candidate)))];
}

function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && value in channels;
}

function isVersion(value: unknown): value is VersionStrategy {
  return value === 'patch' || value === 'minor' || value === 'major' || value === 'none';
}

function isMode(value: unknown): value is XappMode {
  return value === 'build' || value === 'direct' || value === 'release';
}

export function describeParseFailure(result: Extract<ParseIntentResult, { ok: false }>): string {
  if (result.reason === 'empty') return '请输入构建或 QA 上传指令。';
  if (result.reason === 'env-unknown') return '请在指令中明确环境，例如 qa。当前示例不默认执行任何环境。';
  return '直接上传需要指定真实分包名，或使用“全部分包”。';
}
