import type { CreateOptions } from './cli.js';

export type AgentCapabilityName = 'agent-core';

export interface AgentCapabilityFile {
  path: string;
  content: string;
}

export interface AgentCapabilityDefinition {
  name: AgentCapabilityName;
  description: string;
  files: (projectName: string, options?: CreateOptions) => Promise<AgentCapabilityFile[]> | AgentCapabilityFile[];
}
