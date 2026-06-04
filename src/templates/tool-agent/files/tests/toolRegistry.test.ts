import { describe, expect, it } from 'vitest';
import { getToolRegistry } from '../src/agent/toolRegistry.js';

describe('tool registry', () => {
  it('executes weather.query', async () => {
    const result = await getToolRegistry().executeTool('weather.query', { location: 'Tokyo', date: 'tomorrow' }, { traceId: 'test' });
    expect(result).toMatchObject({ location: 'Tokyo', condition: 'rainy' });
  });

  it('executes math.calculate', async () => {
    const result = await getToolRegistry().executeTool('math.calculate', { expression: '1 + 2 * 3' }, { traceId: 'test' });
    expect(result).toMatchObject({ result: 7 });
  });

  it('rejects unsafe math', async () => {
    await expect(getToolRegistry().executeTool('math.calculate', { expression: 'process.exit()' }, { traceId: 'test' })).rejects.toThrow();
  });
});
