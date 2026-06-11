import type { Skill, SkillContext, SkillRegistryLike, ToolDefinition } from './types.js';

export class SkillRegistry implements SkillRegistryLike {
  private readonly skills = new Map<string, Skill>();

  register(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      throw new Error(`skill_already_registered: ${skill.name}`);
    }
    if ((skill.retry ?? 0) > 0 && skill.idempotent !== true) {
      throw new Error(`skill_retry_requires_idempotent: ${skill.name}`);
    }
    this.skills.set(skill.name, skill);
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  get(name: string): Skill {
    const skill = this.skills.get(name);
    if (!skill) throw new Error(`skill_not_found: ${name}`);
    return skill;
  }

  list(): Skill[] {
    return [...this.skills.values()];
  }

  async execute(name: string, input: unknown, context: SkillContext): Promise<unknown> {
    const skill = this.get(name);
    const parsedInput = skill.inputSchema.safeParse(input);
    if (!parsedInput.success) throw new Error(`skill_input_invalid: ${parsedInput.error.message}`);
    const output = await skill.execute(parsedInput.data, context);
    const parsedOutput = skill.outputSchema.safeParse(output);
    if (!parsedOutput.success) throw new Error(`skill_output_invalid: ${parsedOutput.error.message}`);
    return parsedOutput.data;
  }
}

export function toolToSkill(tool: ToolDefinition): Skill {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    permission: tool.permission,
    timeoutMs: tool.timeoutMs,
    retry: tool.retry,
    idempotent: tool.idempotent,
    execute: (input, context) => tool.handler(input, context),
  };
}

/** @deprecated Use SkillRegistry. */
export class ToolRegistry {
  private readonly registry = new SkillRegistry();

  registerTool(tool: ToolDefinition): void {
    this.registry.register(toolToSkill(tool));
  }

  getTool(name: string): Skill {
    return this.registry.get(name);
  }

  listTools(): Skill[] {
    return this.registry.list();
  }

  hasTool(name: string): boolean {
    return this.registry.has(name);
  }

  executeTool(name: string, input: unknown, context: SkillContext): Promise<unknown> {
    return this.registry.execute(name, input, context);
  }

  toSkillRegistry(): SkillRegistry {
    return this.registry;
  }
}
