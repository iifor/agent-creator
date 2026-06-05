import { z } from 'zod';
import type { ModelProvider, Skill } from '@agent-creator/core';
import { describeParseFailure, parseIntent } from './xapp-build/parser.js';
import { TARGET_REPO_ROOT, type XappIntent } from './xapp-build/intents.js';
import { understandIntent } from './xapp-build/llm.js';
import {
  formatCommand,
  previewBuildCommands,
  previewDirectUploadCommands,
  runBuild,
  runDirectUpload,
  type RunnerOptions,
} from './xapp-build/runner.js';

export interface XappBuildSkillOptions extends RunnerOptions {
  knownPackages?: string[];
  model?: ModelProvider;
  pendingStore?: PendingIntentStore;
}

export interface PendingIntentStore {
  get(key: string): XappIntent | undefined;
  set(key: string, intent: XappIntent): void;
  delete(key: string): void;
}

class InMemoryPendingIntentStore implements PendingIntentStore {
  private readonly intents = new Map<string, XappIntent>();

  get(key: string): XappIntent | undefined {
    return this.intents.get(key);
  }

  set(key: string, intent: XappIntent): void {
    this.intents.set(key, intent);
  }

  delete(key: string): void {
    this.intents.delete(key);
  }
}

const defaultPendingStore = new InMemoryPendingIntentStore();

const objectInputSchema = z.object({
  query: z.string().min(1),
  dryRun: z.boolean().optional().default(false),
  confirm: z.boolean().optional().default(false),
});

const inputSchema = z
  .union([z.string().min(1), objectInputSchema])
  .transform((input) => (typeof input === 'string' ? objectInputSchema.parse({ query: input }) : input));

const intentSchema = z.object({
  env: z.enum(['qa', 'prod']),
  channel: z.enum(['wx', 'ali', 'xhs', 'ks', 'bd', 'qq', 'dy']),
  packages: z.array(z.string()),
  uploadAll: z.boolean(),
  version: z.enum(['patch', 'minor', 'major', 'none']),
  mode: z.enum(['build', 'direct', 'release']),
  source: z.enum(['regex', 'llm']),
  originalText: z.string(),
});

const outputSchema = z.object({
  ok: z.boolean(),
  action: z.enum(['build', 'directUpload', 'blocked', 'needConfirmation']),
  intent: intentSchema.optional(),
  logs: z.array(z.string()),
  message: z.string(),
});

export type XappBuildInput = z.input<typeof inputSchema>;
export type XappBuildOutput = z.infer<typeof outputSchema>;

export function createXappBuildSkill(options: XappBuildSkillOptions = {}): Skill<XappBuildInput, XappBuildOutput> {
  return {
    name: 'xapp.build',
    description: '对 saas-fe-xapp-mall 执行受控的对话式构建和 QA 直接上传。',
    inputSchema,
    outputSchema,
    async execute(input, context) {
      const request = inputSchema.parse(input);
      const store = options.pendingStore ?? defaultPendingStore;
      const pendingKey = requestKey(context.sessionId, context.userId);

      if (isConfirmation(request.query)) {
        const pendingIntent = store.get(pendingKey);
        if (!pendingIntent) {
          return {
            ok: false,
            action: 'blocked',
            logs: [],
            message: '没有待确认的 QA 上传任务。请先说出要上传的环境和分包，例如“帮我发布qa ec_order”。',
          };
        }
        store.delete(pendingKey);
        const result = await runDirectUpload(pendingIntent, { ...options, dryRun: request.dryRun });
        return {
          ok: true,
          action: 'directUpload',
          intent: pendingIntent,
          logs: result.logs,
          message: request.dryRun ? 'QA 直接上传 dry-run 执行完成。' : 'QA 直接上传执行完成。',
        };
      }

      const parsed = await understandIntent(request.query, {
        repoRoot: options.repoRoot ?? TARGET_REPO_ROOT,
        knownPackages: options.knownPackages,
        model: options.model,
      });
      if (!parsed.ok) {
        return {
          ok: false,
          action: 'blocked',
          logs: [],
          message: describeParseFailure(parsed),
        };
      }

      const { intent } = parsed;
      if (intent.env === 'prod' || intent.mode === 'release') {
        return {
          ok: false,
          action: 'blocked',
          intent,
          logs: [],
          message: '当前示例 Agent 不执行 prod 上传或完整发版，不会改版本号、commit、tag 或 push。请改用 QA 构建/QA 直接上传指令。',
        };
      }

      if (intent.mode === 'build') {
        const result = await runBuild(intent, { ...options, dryRun: request.dryRun });
        return {
          ok: true,
          action: 'build',
          intent,
          logs: result.logs,
          message: '构建流程执行完成。',
        };
      }

      const preview = previewDirectUploadCommands(intent, request.dryRun).map(formatCommand);
      if (!request.confirm) {
        store.set(pendingKey, intent);
        return {
          ok: false,
          action: 'needConfirmation',
          intent,
          logs: preview,
          message: [
            '我理解为：QA 环境直接上传。',
            `渠道：${intent.channel}；分包：${intent.uploadAll ? '全部分包' : intent.packages.join(', ')}。`,
            '将执行下面的命令。请回复“确认”后执行。',
          ].join('\n'),
        };
      }

      store.delete(pendingKey);
      const result = await runDirectUpload(intent, { ...options, dryRun: request.dryRun });
      return {
        ok: true,
        action: 'directUpload',
        intent,
        logs: result.logs,
        message: request.dryRun ? 'QA 直接上传 dry-run 执行完成。' : 'QA 直接上传执行完成。',
      };
    },
  };
}

export const xappBuildSkill = createXappBuildSkill();

export { parseIntent, previewBuildCommands, previewDirectUploadCommands };

function isConfirmation(query: string): boolean {
  return /^(确认|确定|执行|开始|yes|y|ok|继续)$/i.test(query.trim());
}

function requestKey(sessionId?: string, userId?: string): string {
  return sessionId ?? userId ?? 'default';
}
