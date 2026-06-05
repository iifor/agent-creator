import { describe, expect, it } from 'vitest';
import { getCapability, listCapabilities } from '../src/capabilities/index.js';

describe('capability registry', () => {
  it('lists only agent-core', () => {
    expect(listCapabilities().map((capability) => capability.name)).toEqual(['agent-core']);
  });

  it('rejects unsupported capabilities', () => {
    expect(() => getCapability('rag')).toThrow('当前版本只支持 agent-core');
  });
});
