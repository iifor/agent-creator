import type { TemplateDefinition } from '../../types/template.js';
import { toolAgentFiles } from './generatedFiles.js';

export const toolAgentTemplate: TemplateDefinition = {
  name: 'tool-agent',
  description: 'A runnable tool-calling agent with mock tools, trace, validation, and tests.',
  files: toolAgentFiles,
};
