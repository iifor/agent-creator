import { describe, expect, it, vi } from 'vitest';
import { buildCommitMessage, commitCommand } from '../src/commands/commit.js';

describe('commit command', () => {
  it('builds conventional commit messages', () => {
    expect(buildCommitMessage('feat', 'cli', 'add commit command')).toBe('feat(cli): add commit command');
    expect(buildCommitMessage('refactor', undefined, 'change config', true)).toBe('refactor!: change config');
  });

  it('rejects invalid commit input', () => {
    expect(() => buildCommitMessage('unknown', undefined, 'message')).toThrow('Unsupported commit type');
    expect(() => buildCommitMessage('fix', 'Bad Scope', 'message')).toThrow('Commit scope');
    expect(() => buildCommitMessage('fix', undefined, '   ')).toThrow('non-empty single line');
  });

  it('prompts for a type and commits staged changes', async () => {
    const questions = ['2', 'cli', 'handle invalid input'];
    const question = vi.fn(async () => questions.shift() ?? '');
    const calls: string[][] = [];
    const run = vi.fn((_command: string, args: string[]) => {
      calls.push(args);
      if (args[0] === 'rev-parse') return { status: 0, stdout: 'true\n' };
      if (args[0] === 'diff') return { status: 1 };
      return { status: 0, stdout: '[main abc123] fix(cli): handle invalid input\n' };
    });

    await commitCommand({}, { question, run });

    expect(calls.at(-1)).toEqual(['commit', '-m', 'fix(cli): handle invalid input']);
  });

  it('does not commit when nothing is staged', async () => {
    const run = vi.fn((_command: string, args: string[]) => ({
      status: args[0] === 'diff' ? 0 : 0,
      stdout: 'true\n',
    }));

    await expect(commitCommand({ type: 'fix', message: 'nothing staged' }, { run })).rejects.toThrow('No staged changes');
  });
});
