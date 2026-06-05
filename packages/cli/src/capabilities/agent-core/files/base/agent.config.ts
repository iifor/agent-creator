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
    baseUrl: process.env.LLM_BASE_URL ?? '',
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? '',
    timeoutMs: 30000,
    maxRetries: 1,
  },
  skills: {
    enabled: [
      // agent-creator:skills
    ],
  },
};

export default config;
