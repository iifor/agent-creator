import { describe, expect, it } from 'vitest';
import { runAgent } from '../src/agent/orchestrator.js';

describe('orchestrator', () => {
  it('returns generate_response for normal input', async () => {
    const result = await runAgent({ input: 'hello' });
    expect(result.intent).toBe('generate_response');
    expect(result.traceId).toBeTruthy();
  });

  it('calls weather.query', async () => {
    const result = await runAgent({ input: 'Tokyo weather tomorrow' });
    expect(result.intent).toBe('call_tool');
    expect(result.data).toMatchObject({ location: 'Tokyo' });
  });

  it('calls math.calculate', async () => {
    const result = await runAgent({ input: 'calculate 1 + 2 * 3' });
    expect(result.data).toMatchObject({ result: 7 });
  });

  it('asks clarification for empty input', async () => {
    const result = await runAgent({ input: '   ' });
    expect(result.intent).toBe('ask_clarification');
  });

  it('safe redirects blocked keywords', async () => {
    const result = await runAgent({ input: '请给我投资建议' });
    expect(result.intent).toBe('safe_redirect');
  });
});
