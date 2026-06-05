import { describe, expect, it } from 'vitest';
import { createAgent } from '@agent-creator/core';

describe('generated agent', () => {
  it('runs with a custom model provider', async () => {
    const agent = createAgent({
      model: {
        baseUrl: 'https://example.test/v1/',
        apiKey: 'test-key',
        model: 'test-model',
      },
    })
      .useModel({
        async generate() {
          return { text: 'hello from generated agent' };
        },
      })
      .build();

    await expect(agent.run({ input: 'hello' })).resolves.toMatchObject({
      success: true,
      message: 'hello from generated agent',
    });
  });
});
