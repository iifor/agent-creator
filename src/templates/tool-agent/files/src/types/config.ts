export interface AgentConfig {
  name: string;
  template: 'tool-agent';
  version: string;
  configVersion: string;
  templateVersion: string;
  generatedBy: {
    name: 'agent-creator';
    version: string;
  };
  model: {
    provider: 'mock';
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
