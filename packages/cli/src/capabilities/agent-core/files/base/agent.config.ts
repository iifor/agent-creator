const config = {
  name: '{{projectName}}',
  capability: 'agent-core',
  version: '{{capabilityVersion}}',
  configVersion: '{{configVersion}}',
  capabilityVersion: '{{capabilityVersion}}',
  generatedBy: {
    name: 'agent-creator',
    version: '{{cliVersion}}',
  },
  service: {
    enabled: {{serviceEnabled}},
    framework: {{serviceFramework}},
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
  webhook: {
    url: process.env.WEBHOOK_URL ?? '',
    timeoutMs: 10000,
  },
  skills: {
    enabled: [
      // agent-creator:skills
    ],
  },
  guards: {
    enabled: [
      // agent-creator:guards
    ],
  },
  workflows: {
    enabled: [
      // agent-creator:workflows
    ],
  },
};

export default config;
