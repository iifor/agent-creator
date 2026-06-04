import { z } from 'zod';
import type { ToolDefinition } from '../types/tool.js';

const inputSchema = z.object({ expression: z.string().min(1) });
const outputSchema = z.object({ expression: z.string(), result: z.number() });

export const mathTool: ToolDefinition = {
  name: 'math.calculate',
  description: 'Safely evaluate basic arithmetic without eval.',
  inputSchema,
  outputSchema,
  permission: 'public',
  timeoutMs: 5000,
  retry: 1,
  async handler(input) {
    const value = inputSchema.parse(input);
    return { expression: value.expression, result: evaluateExpression(value.expression) };
  },
};

function evaluateExpression(expression: string): number {
  if (!/^[0-9+\-*/().\s]+$/.test(expression)) throw new Error('Only numbers and + - * / ( ) are allowed.');
  const tokens = expression.match(/\d+(?:\.\d+)?|[()+\-*/]/g) ?? [];
  let index = 0;

  function parseExpression(): number {
    let value = parseTerm();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const op = tokens[index++];
      const right = parseTerm();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (tokens[index] === '*' || tokens[index] === '/') {
      const op = tokens[index++];
      const right = parseFactor();
      if (op === '/' && right === 0) throw new Error('Division by zero.');
      value = op === '*' ? value * right : value / right;
    }
    return value;
  }

  function parseFactor(): number {
    const token = tokens[index++];
    if (!token) throw new Error('Unexpected end of expression.');
    if (token === '(') {
      const value = parseExpression();
      if (tokens[index++] !== ')') throw new Error('Expected closing parenthesis.');
      return value;
    }
    if (token === '-') return -parseFactor();
    const value = Number(token);
    if (Number.isNaN(value)) throw new Error(`Invalid token: ${token}`);
    return value;
  }

  const result = parseExpression();
  if (index < tokens.length) throw new Error('Unexpected token after expression.');
  return result;
}
