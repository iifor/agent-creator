export type TemplateName = 'tool-agent';

export interface TemplateFile {
  path: string;
  content: string;
}

export interface TemplateDefinition {
  name: TemplateName;
  description: string;
  files: (projectName: string) => Promise<TemplateFile[]> | TemplateFile[];
}
