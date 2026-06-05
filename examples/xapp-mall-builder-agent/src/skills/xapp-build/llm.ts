import type { ModelProvider } from '@agent-creator/core';
import { normalizeIntent, parseIntent, type ParseIntentResult } from './parser.js';
import { getKnownPackages, type IntentHelpers } from './intents.js';

export interface UnderstandIntentOptions extends IntentHelpers {
  model?: ModelProvider;
}

export async function understandIntent(message: string, options: UnderstandIntentOptions = {}): Promise<ParseIntentResult> {
  if (!options.model) return parseIntent(message, options);

  const knownPackages = options.knownPackages ?? getKnownPackages(options.repoRoot);
  const modelResult = await options.model.generate({
    task: 'xapp_build_intent',
    input: {
      userText: message,
      knownPackages,
      defaultChannel: 'wx',
      allowedEnvs: ['qa', 'prod'],
      allowedChannels: ['wx', 'ali', 'xhs', 'ks', 'bd', 'qq', 'dy'],
      allowedModes: ['build', 'direct', 'release'],
      instruction: [
        '把用户的中文构建/上传需求解析成 JSON。',
        '字段必须是 env, channel, packages, uploadAll, version, mode。',
        'env 只能是 qa 或 prod；没有明确环境时不要猜。',
        'channel 缺省为 wx。',
        'packages 只能从 knownPackages 里选择。',
        '“发布qa ec_order”“帮我发布qa ec_order”表示 direct QA 上传指定分包，不是 release 发版。',
        '“发版/更新版本/正式发布/出版本”才是 release。',
        '“构建/打包/build”表示 build。',
        '只返回 JSON，不要解释。',
      ].join('\n'),
    },
    memory: [],
  });

  const parsedJson = parseModelJson(modelResult.text);
  if (!parsedJson.ok) return parseIntent(message, options);

  const normalized = normalizeIntent(parsedJson.value, message, { ...options, knownPackages });
  if (!normalized.ok) return parseIntent(message, { ...options, knownPackages });
  return normalized;
}

function parseModelJson(text: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = text.trim();
  const candidate = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed;
  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch {
    return { ok: false };
  }
}
