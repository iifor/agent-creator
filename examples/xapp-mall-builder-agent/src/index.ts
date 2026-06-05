import { createAgent, createOpenAICompatibleProvider, type Agent, type Skill } from '@agent-creator/core';
import config from '../agent.config.js';
import { createXappBuildSkill } from './skills/xapp-build.js';

let configuredAgent: Agent | undefined;

export function getAgent(): Agent {
  if (configuredAgent) return configuredAgent;
  const model = createOpenAICompatibleProvider(config.model);
  const skills: Skill[] = [createXappBuildSkill({ model })];
  const builder = createAgent({ model: config.model }).useModel(model);
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
