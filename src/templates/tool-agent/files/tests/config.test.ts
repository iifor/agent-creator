import { describe, expect, it } from 'vitest';
import config from '../agent.config.js';
import { agentConfigSchema } from '../src/schemas/config.schema.js';

describe('config', () => {
  it('matches the config schema', () => {
    expect(agentConfigSchema.safeParse(config).success).toBe(true);
  });
});
