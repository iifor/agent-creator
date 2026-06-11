import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { AgentContext, AgentPlan, Planner, ModelProvider } from './types.js';

const candidateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('model') }),
  z.object({
    action: z.literal('skill'),
    skill: z.string().min(1),
    input: z.unknown(),
  }),
  z.object({
    action: z.literal('none'),
    reason: z.string().min(1),
  }),
]);

export type StructuredPlannerAction = z.infer<typeof candidateSchema>;

export interface StructuredPlannerDecision {
  action: StructuredPlannerAction;
  accepted: boolean;
  rejectionCode?: string;
  latencyMs: number;
}

export interface StructuredSkillPlannerOptions {
  allowedSkills?: string[];
  invalidResult?: 'model' | 'error';
}

export class StructuredSkillPlanner implements Planner {
  private readonly allowedSkills?: Set<string>;
  private readonly invalidResult: 'model' | 'error';

  constructor(
    private readonly model: ModelProvider,
    options: StructuredSkillPlannerOptions = {},
  ) {
    this.allowedSkills = options.allowedSkills ? new Set(options.allowedSkills) : undefined;
    this.invalidResult = options.invalidResult ?? 'model';
  }

  async decide(context: AgentContext): Promise<StructuredPlannerDecision> {
    const startedAt = Date.now();
    const available = context.availableSkills
      .filter((skill) => !this.allowedSkills || this.allowedSkills.has(skill.name));
    const result = await this.model.generate({
      task: 'select_structured_action',
      input: {
        instruction: [
          'Return exactly one JSON object.',
          'Choose model for a normal response, skill for one allowed skill call, or none when the request must not run.',
          'Do not return multiple steps and do not invent skill names or parameters.',
        ].join(' '),
        userRequest: context.input.input,
        skills: available.map((skill) => ({
          name: skill.name,
          description: skill.description,
          permission: skill.permission ?? 'public',
          inputSchema: zodToJsonSchema(skill.inputSchema as z.ZodTypeAny, {
            $refStrategy: 'none',
          }),
        })),
      },
      memory: context.memory,
    });

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(result.text);
    } catch {
      return this.reject(context, startedAt, 'invalid_json');
    }
    const candidate = candidateSchema.safeParse(parsedJson);
    if (!candidate.success) return this.reject(context, startedAt, 'invalid_action_shape');
    if (candidate.data.action !== 'skill') {
      return this.accept(context, startedAt, candidate.data);
    }

    const skillCandidate = candidate.data;
    const skill = available.find((item) => item.name === skillCandidate.skill);
    if (!skill) return this.reject(context, startedAt, 'skill_not_allowed');
    const input = skill.inputSchema.safeParse(skillCandidate.input);
    if (!input.success) return this.reject(context, startedAt, 'skill_input_invalid');
    return this.accept(context, startedAt, {
      action: 'skill',
      skill: skill.name,
      input: input.data,
    });
  }

  async plan(context: AgentContext): Promise<AgentPlan> {
    const decision = await this.decide(context);
    if (decision.action.action === 'skill') {
      return {
        goal: `Execute ${decision.action.skill}`,
        steps: [{
          type: 'skill',
          skill: decision.action.skill,
          input: decision.action.input,
        }],
      };
    }
    if (decision.action.action === 'none') {
      return {
        goal: 'Return a controlled refusal',
        steps: [{ type: 'response', message: decision.action.reason }],
      };
    }
    if (!decision.accepted && this.invalidResult === 'error') {
      return {
        goal: 'Report structured planning failure',
        steps: [{
          type: 'response',
          message: `Structured planning failed: ${decision.rejectionCode ?? 'unknown_error'}.`,
        }],
      };
    }
    return {
      goal: 'Generate a response',
      steps: [{ type: 'model', task: 'generate_response', input: context.input.input }],
    };
  }

  private async accept(
    context: AgentContext,
    startedAt: number,
    action: StructuredPlannerAction,
  ): Promise<StructuredPlannerDecision> {
    const decision = {
      action,
      accepted: true,
      latencyMs: Date.now() - startedAt,
    };
    await appendDecisionTrace(context, decision);
    return decision;
  }

  private async reject(
    context: AgentContext,
    startedAt: number,
    rejectionCode: string,
  ): Promise<StructuredPlannerDecision> {
    const decision = {
      action: { action: 'model' } as const,
      accepted: false,
      rejectionCode,
      latencyMs: Date.now() - startedAt,
    };
    await appendDecisionTrace(context, decision);
    return decision;
  }
}

async function appendDecisionTrace(context: AgentContext, decision: StructuredPlannerDecision): Promise<void> {
  await context.trace.append({
    type: decision.accepted ? 'structured_planner.accepted' : 'structured_planner.rejected',
    data: {
      action: decision.action.action,
      ...(decision.action.action === 'skill' ? { skill: decision.action.skill } : {}),
      ...(decision.rejectionCode ? { rejectionCode: decision.rejectionCode } : {}),
      durationMs: decision.latencyMs,
    },
  });
}
