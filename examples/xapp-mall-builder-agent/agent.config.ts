const config = {
  name: 'examples/xapp-mall-builder-agent',
  capability: 'agent-core',
  version: '0.4.2',
  configVersion: '0.1',
  capabilityVersion: '0.4.2',
  generatedBy: {
    name: 'agent-creator',
    version: '0.4.2',
  },
  service: {
    enabled: false,
    framework: undefined,
  },
  model: {
    // Minimum required configuration: baseUrl and apiKey.
    // You can hardcode local values here, or keep reading from environment variables.
    baseUrl: process.env.LLM_BASE_URL ?? '',
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
    timeoutMs: 30000,
    maxRetries: 1,
  },
  skills: {
    enabled: [
      // agent-creator:skills
      'xapp.build',
    ],
  },
};

export default config;
