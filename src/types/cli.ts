import type { AgentCapabilityName } from './capability.js';

export interface CreateOptions {
  capability?: AgentCapabilityName | string;
  packageManager?: 'npm' | string;
  force?: boolean;
  mode?: 'package' | 'service' | string;
}

export interface AddToolOptions {
  permission?: 'public' | 'external_api' | 'user_private' | string;
}
