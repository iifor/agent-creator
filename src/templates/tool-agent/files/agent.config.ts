import type { AgentConfig } from './src/types/config.js';

const config: AgentConfig = {
  name: '{{projectName}}',
  template: 'tool-agent',
  version: '{{templateVersion}}',
  configVersion: '{{configVersion}}',
  templateVersion: '{{templateVersion}}',
  generatedBy: {
    name: 'agent-creator',
    version: '{{cliVersion}}',
  },
  model: {
    provider: 'mock',
    defaultModel: 'mock-basic',
    timeoutMs: 10000,
    maxRetries: 1,
  },
  tools: {
    enabled: [
      // agent-creator:tools
      'weather.query',
      'math.calculate',
    ],
    defaultTimeoutMs: 5000,
    defaultRetry: 1,
  },
  constraints: {
    blockedKeywords: ['伪造凭证', '色情', '投资建议'],
  },
  trace: {
    enabled: true,
    writeToFile: true,
    directory: '.agent-traces',
  },
};

export default config;
