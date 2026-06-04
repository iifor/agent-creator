import { Command } from 'commander';
import { addToolCommand } from '../commands/addTool.js';
import { createCommand } from '../commands/create.js';
import { devCommand } from '../commands/dev.js';
import { traceCommand } from '../commands/trace.js';
import { validateCommand } from '../commands/validate.js';

export function buildCli(): Command {
  const program = new Command();
  program
    .name('agent')
    .description('Create and maintain runnable Agent projects.')
    .version('0.1.0');

  program
    .command('create')
    .argument('<name>', 'project name')
    .option('--template <template>', 'template name', 'tool-agent')
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
    .command('tool')
    .argument('<toolName>', 'tool name')
    .option('--permission <permission>', 'public | external_api | user_private', 'public')
    .action(addToolCommand);

  return program;
}

export function runCli(argv: string[]): void {
  buildCli().parse(argv);
}
