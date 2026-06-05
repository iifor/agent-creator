import { describe, expect, it } from 'vitest';
import { createAgent } from '@agent-creator/core';
import { createXappBuildSkill, parseIntent } from '../../src/skills/xapp-build.js';
import type { CommandStep } from '../../src/skills/xapp-build/runner.js';

const knownPackages = ['ec_order', 'ec_user', 'ec_cart'];

describe('xapp build intent parser', () => {
  it('parses a QA direct upload for one package', () => {
    expect(parseIntent('上传 qa ec_order', { knownPackages })).toMatchObject({
      ok: true,
      intent: {
        mode: 'direct',
        env: 'qa',
        channel: 'wx',
        packages: ['ec_order'],
        uploadAll: false,
      },
    });
  });

  it('parses channel aliases', () => {
    expect(parseIntent('上传 qa 支付宝 ec_order', { knownPackages })).toMatchObject({
      ok: true,
      intent: {
        channel: 'ali',
      },
    });
  });

  it('parses upload all', () => {
    expect(parseIntent('上传 qa 全部分包', { knownPackages })).toMatchObject({
      ok: true,
      intent: {
        mode: 'direct',
        uploadAll: true,
      },
    });
  });
});

describe('xapp build skill', () => {
  it('blocks release and prod intents', async () => {
    const skill = createXappBuildSkill({ repoRoot: '/tmp/not-used', knownPackages });

    await expect(skill.execute({ query: '发版 qa' }, { traceId: 'trace_test' })).resolves.toMatchObject({
      ok: false,
      action: 'blocked',
    });
    await expect(skill.execute({ query: '上传 prod ec_order' }, { traceId: 'trace_test' })).resolves.toMatchObject({
      ok: false,
      action: 'blocked',
    });
  });

  it('runs build commands in order', async () => {
    const steps: CommandStep[] = [];
    const skill = createXappBuildSkill({
      repoRoot: '/tmp/not-used',
      knownPackages,
      driveCommand: async (step) => {
        steps.push(step);
        return { code: 0 };
      },
    });

    await expect(skill.execute({ query: '构建 qa 支付宝' }, { traceId: 'trace_test' })).resolves.toMatchObject({
      ok: true,
      action: 'build',
    });
    expect(steps.map((step) => `${step.command} ${step.args.join(' ')}`)).toEqual([
      'npm run resolve:ali',
      'npm run build:nm',
    ]);
  });

  it('requires confirmation before QA direct upload', async () => {
    const skill = createXappBuildSkill({ repoRoot: '/tmp/not-used', knownPackages });

    await expect(skill.execute({ query: '上传 qa ec_order' }, { traceId: 'trace_test' })).resolves.toMatchObject({
      ok: false,
      action: 'needConfirmation',
      logs: ['npm run resolve:wx', 'npx --yes titan-cli publish --env=qa --debug --checked=ec_order'],
    });
  });

  it('uses the model to understand conversational publish wording', async () => {
    const skill = createXappBuildSkill({
      repoRoot: '/tmp/not-used',
      knownPackages,
      model: {
        async generate() {
          return {
            text: JSON.stringify({
              env: 'qa',
              channel: 'wx',
              packages: ['ec_order'],
              uploadAll: false,
              version: 'patch',
              mode: 'direct',
            }),
          };
        },
      },
    });

    await expect(skill.execute({ query: '帮我发布qa ec_order' }, { traceId: 'trace_test' })).resolves.toMatchObject({
      ok: false,
      action: 'needConfirmation',
      intent: {
        source: 'llm',
        env: 'qa',
        channel: 'wx',
        packages: ['ec_order'],
        mode: 'direct',
      },
      logs: ['npm run resolve:wx', 'npx --yes titan-cli publish --env=qa --debug --checked=ec_order'],
    });
  });

  it('runs confirmed QA direct upload commands', async () => {
    const steps: CommandStep[] = [];
    const skill = createXappBuildSkill({
      repoRoot: '/tmp/not-used',
      knownPackages,
      driveCommand: async (step) => {
        steps.push(step);
        return { code: 0 };
      },
    });

    await expect(
      skill.execute({ query: '上传 qa ec_order ec_user', confirm: true }, { traceId: 'trace_test' }),
    ).resolves.toMatchObject({
      ok: true,
      action: 'directUpload',
    });
    expect(steps.map((step) => `${step.command} ${step.args.join(' ')}`)).toEqual([
      'npm run resolve:wx',
      'npx --yes titan-cli publish --env=qa --debug --checked=ec_order,ec_user',
    ]);
  });

  it('executes the pending upload when the user confirms in the same session', async () => {
    const steps: CommandStep[] = [];
    const skill = createXappBuildSkill({
      repoRoot: '/tmp/not-used',
      knownPackages,
      model: {
        async generate() {
          return {
            text: JSON.stringify({
              env: 'qa',
              channel: 'wx',
              packages: ['ec_order'],
              uploadAll: false,
              version: 'patch',
              mode: 'direct',
            }),
          };
        },
      },
      driveCommand: async (step) => {
        steps.push(step);
        return { code: 0 };
      },
    });

    await expect(
      skill.execute({ query: '帮我发布qa ec_order' }, { traceId: 'trace_test', sessionId: 'session_1' }),
    ).resolves.toMatchObject({
      action: 'needConfirmation',
    });
    await expect(skill.execute('确认', { traceId: 'trace_test', sessionId: 'session_1' })).resolves.toMatchObject({
      ok: true,
      action: 'directUpload',
    });
    expect(steps.map((step) => `${step.command} ${step.args.join(' ')}`)).toEqual([
      'npm run resolve:wx',
      'npx --yes titan-cli publish --env=qa --debug --checked=ec_order',
    ]);
  });

  it('accepts conversational string input through the default planner', async () => {
    const steps: CommandStep[] = [];
    const agent = createAgent({
      model: {
        baseUrl: 'https://example.test/v1/',
        apiKey: 'test-key',
        model: 'test-model',
      },
    })
      .useSkill(
        createXappBuildSkill({
          repoRoot: '/tmp/not-used',
          knownPackages,
          driveCommand: async (step) => {
            steps.push(step);
            return { code: 0 };
          },
        }),
      )
      .build();

    await expect(agent.run({ input: '构建 qa 微信' })).resolves.toMatchObject({
      success: true,
      data: {
        ok: true,
        action: 'build',
      },
    });
    expect(steps.map((step) => `${step.command} ${step.args.join(' ')}`)).toEqual([
      'npm run resolve:wx',
      'npm run build:nm',
    ]);
  });
});
