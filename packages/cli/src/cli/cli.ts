import { Command } from 'commander';
import { addSkillCommand } from '../commands/addSkill.js';
import { addToolCommand } from '../commands/addTool.js';
import { createCommand } from '../commands/create.js';
import { devCommand } from '../commands/dev.js';
import { traceCommand } from '../commands/trace.js';
import { validateCommand } from '../commands/validate.js';
import { CLI_VERSION } from '../version.js';

export function buildCli(): Command {
  const program = new Command();
  program
    .name('agent')
    .description('Create and maintain runnable Agent projects.')
    .version(CLI_VERSION);

  program
    .command('create')
    .argument('<name>', 'project name')
    .option('--capability <capability>', 'agent capability name', 'agent-core')
    .option('--mode <mode>', 'generation mode: package | service', 'service')
    .option('--package-manager <packageManager>', 'package manager', 'npm')
    .option('--force', 'overwrite an existing directory', false)
    .action(createCommand);

  program
    .command('validate')
    .description('Validate the current generated Agent project.')
    .action(validateCommand);

  program
    .command('version')
    .description('Print the Agent Creator CLI version.')
    .action(() => {
      console.log(program.version());
    });

  program
    .command('help')
    .description('Print Agent Creator CLI help.')
    .action(() => {
      program.outputHelp();
    });

  program
    .command('dev')
    .description('Run the generated Agent interactive console.')
    .action(devCommand);

  program
    .command('trace')
    .option('--latest', 'show the latest trace', false)
    .option('--list', 'list traces', false)
    .option('--id <traceId>', 'show a trace by id')
    .action(traceCommand);

  const add = program.command('add').description('Add generated project modules.');
  add
    .command('skill')
    .argument('<skillName>', 'skill name')
    .action(addSkillCommand);
  add
    .command('tool')
    .argument('<toolName>', 'tool name')
    .description('Deprecated alias for agent add skill.')
    .action(addToolCommand);

  return program;
}

export function runCli(argv: string[]): void {
  buildCli().parse(argv);
}
