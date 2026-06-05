import packageJson from '../package.json' with { type: 'json' };

export const CLI_VERSION = packageJson.version;
export const SUPPORTED_CONFIG_VERSIONS = ['0.1'] as const;
export const CURRENT_CONFIG_VERSION = '0.1';
export const AGENT_CORE_CAPABILITY_VERSION = '0.4.2';
