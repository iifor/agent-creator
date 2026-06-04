import type { ModelProvider } from './modelProvider.js';

export const mockLLM: ModelProvider = {
  async generate(input) {
    if (input.task === 'ask_clarification') {
      return { text: 'What would you like the agent to help with?' };
    }
    if (input.task === 'safe_redirect') {
      return { text: 'Sorry, I cannot complete that request safely.' };
    }
    return { text: `Mock response for: ${String(input.input)}` };
  },
};
