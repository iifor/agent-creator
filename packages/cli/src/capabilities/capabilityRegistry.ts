import type { AgentCapabilityDefinition, AgentCapabilityName } from '../types/capability.js';
import { agentCoreCapability } from './agent-core/capability.config.js';

const capabilities = new Map<AgentCapabilityName, AgentCapabilityDefinition>([
  [agentCoreCapability.name, agentCoreCapability],
]);

export function getCapability(name: string): AgentCapabilityDefinition {
  if (name !== 'agent-core') {
    throw new Error('当前版本只支持 agent-core。RAG、workflow、guard 等能力会以 add 命令或模块形式扩展。');
  }
  const capability = capabilities.get(name);
  if (!capability) throw new Error(`Capability not found: ${name}`);
  return capability;
}

export function listCapabilities(): AgentCapabilityDefinition[] {
  return [...capabilities.values()];
}
