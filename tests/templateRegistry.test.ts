import { describe, expect, it } from 'vitest';
import { getTemplate, listTemplates } from '../src/templates/index.js';

describe('template registry', () => {
  it('lists only tool-agent', () => {
    expect(listTemplates().map((template) => template.name)).toEqual(['tool-agent']);
  });

  it('rejects unsupported templates', () => {
    expect(() => getTemplate('rag-agent')).toThrow('当前版本只支持 tool-agent');
  });
});
