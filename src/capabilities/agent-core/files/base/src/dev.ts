import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import config from '../agent.config.js';
import { runAgent } from './index.js';

const rl = readline.createInterface({ input, output });
const sessionId = `session_${Date.now()}`;

console.log(`${config.name} Dev Console started.`);
console.log('Type "exit" or "quit" to quit.\n');

while (true) {
  const text = await rl.question('User: ');
  if (['exit', 'quit'].includes(text.trim().toLowerCase())) break;
  const result = await runAgent({ input: text, sessionId });
  console.log('Agent:');
  console.log(JSON.stringify(result, null, 2));
}

rl.close();
