import type { TemplateDefinition } from '../../types/template.js';
import { loadToolAgentFiles } from './fileTemplate.js';

export const toolAgentTemplate: TemplateDefinition = {
  name: 'tool-agent',
  description: 'A runnable tool-calling agent with mock tools, trace, validation, and tests.',
  files: loadToolAgentFiles,
};
