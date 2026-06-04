import type { TemplateDefinition, TemplateName } from '../types/template.js';
import { toolAgentTemplate } from './tool-agent/template.config.js';

const templates = new Map<TemplateName, TemplateDefinition>([
  [toolAgentTemplate.name, toolAgentTemplate],
]);

export function getTemplate(name: string): TemplateDefinition {
  if (name !== 'tool-agent') {
    throw new Error('当前版本只支持 tool-agent，后续会支持 rag-agent、workflow-agent、assistant-agent、data-agent、customer-agent');
  }
  const template = templates.get(name);
  if (!template) throw new Error(`Template not found: ${name}`);
  return template;
}

export function listTemplates(): TemplateDefinition[] {
  return [...templates.values()];
}
