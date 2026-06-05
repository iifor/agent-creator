import type { ToolContext, ToolDefinition } from '../types/tool.js';
import { weatherTool } from '../tools/weather.js';
import { mathTool } from '../tools/math.js';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): ToolDefinition {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`tool_not_found: ${name}`);
    return tool;
  }

  listTools(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  async executeTool(name: string, input: unknown, context: ToolContext): Promise<unknown> {
    const tool = this.getTool(name);
    const parsedInput = tool.inputSchema.safeParse(input);
    if (!parsedInput.success) throw new Error(`tool_input_invalid: ${parsedInput.error.message}`);
    const output = await tool.handler(parsedInput.data, context);
    const parsedOutput = tool.outputSchema.safeParse(output);
    if (!parsedOutput.success) throw new Error(`tool_output_invalid: ${parsedOutput.error.message}`);
    return parsedOutput.data;
  }
}

export function createDefaultToolRegistry(extraTools: ToolDefinition[] = []): ToolRegistry {
  const registry = new ToolRegistry();
  registry.registerTool(weatherTool);
  registry.registerTool(mathTool);
  for (const tool of extraTools) registry.registerTool(tool);
  return registry;
}

const registry = createDefaultToolRegistry();

export function getToolRegistry(): ToolRegistry {
  return registry;
}
