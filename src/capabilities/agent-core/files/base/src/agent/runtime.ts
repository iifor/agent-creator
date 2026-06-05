import defaultConfig from '../../agent.config.js';
import type { Agent, AgentInput, AgentOptions, AgentRuntime } from '../types/agent.js';
import { InMemoryStore } from '../memory/memoryManager.js';
import { createOpenAICompatibleProvider } from '../model/openAICompatibleProvider.js';
import { createTraceLogger } from '../traces/traceLogger.js';
import { createDefaultToolRegistry } from './toolRegistry.js';
import { runAgentWithRuntime } from './orchestrator.js';

export function createAgent(options: AgentOptions = {}): Agent {
  const config = options.config ?? defaultConfig;
  const toolRegistry = options.toolRegistry ?? createDefaultToolRegistry(options.tools);
  const runtime: AgentRuntime = {
    config,
    toolRegistry,
    modelProvider: options.modelProvider ?? createOpenAICompatibleProvider(config),
    memoryStore: options.memoryStore ?? new InMemoryStore(),
    createTraceLogger: options.createTraceLogger ?? createTraceLogger,
  };

  return {
    tools: runtime.toolRegistry,
    run(input: AgentInput) {
      return runAgentWithRuntime(input, runtime);
    },
    clearMemory(sessionId?: string) {
      return runtime.memoryStore.clear(sessionId);
    },
    getMemory(sessionId: string) {
      return runtime.memoryStore.getMessages(sessionId);
    },
  };
}

const defaultAgent = createAgent();

export function runAgent(input: AgentInput) {
  return defaultAgent.run(input);
}
