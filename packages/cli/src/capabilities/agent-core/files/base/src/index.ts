import { createAgent, type Agent } from '@agent-creator/core';
import config from '../agent.config.js';
import { guard } from './guards/index.js';
import { skills } from './skills/index.js';

let configuredAgent: Agent | undefined;

export function getAgent(): Agent {
  if (configuredAgent) return configuredAgent;
  const builder = createAgent({ model: config.model, webhook: config.webhook });
  builder.useGuard(guard);
  for (const skill of skills) builder.useSkill(skill);
  configuredAgent = builder.build();
  return configuredAgent;
}

export function runAgent(input: Parameters<Agent['run']>[0]) {
  return getAgent().run(input);
}

export { createAgent } from '@agent-creator/core';
export type {
  Agent,
  AgentInput,
  AgentOutput,
  Executor,
  Guard,
  MemoryProvider,
  ModelProvider,
  Planner,
  Skill,
  TraceProvider,
} from '@agent-creator/core';
