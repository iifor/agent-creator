import fs from 'node:fs';
import path from 'node:path';

export const TARGET_REPO_ROOT = '/Users/wuqingfu/Desktop/weimob/saas-fe-xapp-mall';

export const channels = {
  wx: { value: 'wx', aliases: ['微信', 'wx', 'weixin', 'wechat'] },
  ali: { value: 'ali', aliases: ['支付宝', 'ali', 'alipay', 'zfb'] },
  xhs: { value: 'xhs', aliases: ['小红书', 'xhs', '红书'] },
  ks: { value: 'ks', aliases: ['快手', 'ks', 'kuaishou'] },
  bd: { value: 'bd', aliases: ['百度', 'bd', 'baidu'] },
  qq: { value: 'qq', aliases: ['qq'] },
  dy: { value: 'dy', aliases: ['抖音', 'dy', 'douyin'] },
} as const;

export type Channel = keyof typeof channels;
export type VersionStrategy = 'patch' | 'minor' | 'major' | 'none';
export type XappAction = 'build' | 'directUpload' | 'blocked' | 'needConfirmation';
export type XappMode = 'build' | 'direct' | 'release';
export type XappEnv = 'qa' | 'prod';
export type IntentSource = 'regex' | 'llm';

export interface XappIntent {
  env: XappEnv;
  channel: Channel;
  packages: string[];
  uploadAll: boolean;
  version: VersionStrategy;
  mode: XappMode;
  source: IntentSource;
  originalText: string;
}

export interface IntentHelpers {
  knownPackages?: string[];
  repoRoot?: string;
}

const ignoreDirs = new Set(['.DS_Store', '.git', 'node_modules']);

export function getKnownPackages(repoRoot = TARGET_REPO_ROOT): string[] {
  return [...scanDir(repoRoot, 'packages'), ...scanDir(repoRoot, 'platforms')];
}

export function matchChannel(text: string): Channel | undefined {
  const lower = text.toLowerCase();
  for (const [key, channel] of Object.entries(channels)) {
    if (channel.aliases.some((alias) => lower.includes(alias.toLowerCase()))) return key as Channel;
  }
  return undefined;
}

function scanDir(repoRoot: string, dirName: string): string[] {
  const dir = path.join(repoRoot, dirName);
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !ignoreDirs.has(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}
