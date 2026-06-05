import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { AgentProgressEvent } from '@agent-creator/core';
import { loadDotEnv } from './env.js';

export async function runCli(): Promise<void> {
  loadDotEnv();
  const { default: config } = await import('../agent.config.js');
  const { runAgent } = await import('./index.js');
  const rl = readline.createInterface({ input, output });
  const sessionId = `session_${Date.now()}`;

  console.log(`${config.name} CLI started.`);
  if (!config.model.baseUrl || !config.model.apiKey) {
    console.error('Set model.baseUrl and model.apiKey in agent.config.ts before running the Agent.');
    process.exitCode = 1;
    rl.close();
    return;
  }
  console.log('Type "exit" or "quit" to quit.\n');

  while (true) {
    const text = await rl.question('User: ');
    if (['exit', 'quit'].includes(text.trim().toLowerCase())) break;
    const result = await runAgent({
      input: text,
      sessionId,
      metadata: {
        onProgress(event: AgentProgressEvent) {
          console.log(formatProgress(event));
        },
      },
    });
    console.log('Agent:');
    console.log(JSON.stringify(result, null, 2));
  }

  rl.close();
}

await runCli();

function formatProgress(event: AgentProgressEvent): string {
  const prefix = event.type.endsWith('.completed') ? '✓' : event.type.endsWith('.failed') ? '✗' : '…';
  return `${prefix} ${event.message}`;
}
