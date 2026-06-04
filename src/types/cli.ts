import type { TemplateName } from './template.js';

export interface CreateOptions {
  template?: TemplateName | string;
  packageManager?: 'npm' | string;
  force?: boolean;
}

export interface AddToolOptions {
  permission?: 'public' | 'external_api' | 'user_private' | string;
}
