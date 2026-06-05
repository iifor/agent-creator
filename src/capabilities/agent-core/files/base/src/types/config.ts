export interface AgentConfig {
  name: string;
  capability: 'agent-core';
  version: string;
  configVersion: string;
  capabilityVersion: string;
  generatedBy: {
    name: 'agent-creator';
    version: string;
  };
  service: {
    enabled: boolean;
    framework?: 'next';
  };
  model: {
    provider: 'openai-compatible';
    defaultModel: string;
    timeoutMs: number;
    maxRetries: number;
  };
  tools: {
    enabled: string[];
    defaultTimeoutMs: number;
    defaultRetry: number;
  };
  constraints: {
    blockedKeywords: string[];
  };
  trace: {
    enabled: boolean;
    writeToFile: boolean;
    directory: string;
  };
}
