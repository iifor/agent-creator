import type { AgentCapabilityDefinition } from '../../types/capability.js';
import { loadAgentCoreFiles } from './fileLoader.js';

export const agentCoreCapability: AgentCapabilityDefinition = {
  name: 'agent-core',
  description: 'A complete runnable Agent runtime with tools, trace, validation, and tests.',
  files: loadAgentCoreFiles,
};
