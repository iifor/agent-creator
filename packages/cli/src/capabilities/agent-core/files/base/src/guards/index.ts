import type { Guard } from '@agent-creator/core';

const guards: Guard[] = [
  // agent-creator:guard-imports
];

export const enabledGuardNames = [
  // agent-creator:guard-exports
];

export const guard: Guard = {
  async check(context) {
    for (const current of guards) {
      const result = await current.check(context);
      if (!result.allowed) return result;
    }
    return { allowed: true };
  },
};
