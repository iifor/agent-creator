import { drive, type PtyDriveResult, type PtyRule } from './pty.js';
import { TARGET_REPO_ROOT, type XappIntent } from './intents.js';

export const ssoPasswordEnv = 'XAPP_SSO_PASSWORD';

export interface CommandStep {
  label: string;
  command: string;
  args: string[];
}

export interface RunnerOptions {
  repoRoot?: string;
  dryRun?: boolean;
  env?: NodeJS.ProcessEnv;
  driveCommand?: (step: CommandStep, rules: PtyRule[]) => Promise<PtyDriveResult>;
}

export interface RunnerResult {
  logs: string[];
}

export async function runBuild(intent: XappIntent, options: RunnerOptions = {}): Promise<RunnerResult> {
  const steps: CommandStep[] = [
    { label: `解析渠道 (resolve:${intent.channel})`, command: 'npm', args: ['run', `resolve:${intent.channel}`] },
    { label: '构建小程序 (build:nm)', command: 'npm', args: ['run', 'build:nm'] },
  ];
  return runSteps(steps, [], options);
}

export async function runDirectUpload(intent: XappIntent, options: RunnerOptions = {}): Promise<RunnerResult> {
  const checked = intent.uploadAll ? 'ALL' : intent.packages.join(',');
  const publishArgs = ['--yes', 'titan-cli', 'publish', '--env=qa', '--debug', `--checked=${checked}`];
  if (options.dryRun) publishArgs.push('--skipUpload');
  const steps: CommandStep[] = [
    { label: `解析渠道 (resolve:${intent.channel})`, command: 'npm', args: ['run', `resolve:${intent.channel}`] },
    { label: `QA 直接上传 (${checked})`, command: 'npx', args: publishArgs },
  ];
  return runSteps(steps, [checkboxRule(), ssoRule(options.env ?? process.env)], options);
}

export function previewBuildCommands(intent: XappIntent): CommandStep[] {
  return [
    { label: `解析渠道 (resolve:${intent.channel})`, command: 'npm', args: ['run', `resolve:${intent.channel}`] },
    { label: '构建小程序 (build:nm)', command: 'npm', args: ['run', 'build:nm'] },
  ];
}

export function previewDirectUploadCommands(intent: XappIntent, dryRun = false): CommandStep[] {
  const checked = intent.uploadAll ? 'ALL' : intent.packages.join(',');
  const publishArgs = ['--yes', 'titan-cli', 'publish', '--env=qa', '--debug', `--checked=${checked}`];
  if (dryRun) publishArgs.push('--skipUpload');
  return [
    { label: `解析渠道 (resolve:${intent.channel})`, command: 'npm', args: ['run', `resolve:${intent.channel}`] },
    { label: `QA 直接上传 (${checked})`, command: 'npx', args: publishArgs },
  ];
}

export function formatCommand(step: CommandStep): string {
  return `${step.command} ${step.args.join(' ')}`;
}

async function runSteps(steps: CommandStep[], rules: PtyRule[], options: RunnerOptions): Promise<RunnerResult> {
  const logs: string[] = [];
  for (const step of steps) {
    logs.push(`▶ ${step.label}: ${formatCommand(step)}`);
    const result = options.driveCommand
      ? await options.driveCommand(step, step.command === 'npx' ? rules : [])
      : await drive(step.command, step.args, {
          cwd: options.repoRoot ?? TARGET_REPO_ROOT,
          env: options.env ?? process.env,
          rules: step.command === 'npx' ? rules : [],
          onData(chunk) {
            logs.push(chunk);
          },
        });
    handleResult(step.label, result);
    logs.push(`✔ ${step.label} 完成`);
  }
  return { logs };
}

function checkboxRule(): PtyRule {
  return {
    name: 'uploadCheckbox',
    test: /请选择需要上传的模块/,
    respond: () => '\r',
    once: true,
  };
}

function ssoRule(env: NodeJS.ProcessEnv): PtyRule {
  return {
    name: 'ssoLogin',
    test: /(请输入密码|密码[:：]|password)/i,
    respond: () => {
      const password = env[ssoPasswordEnv];
      return password ? `${password}\r` : null;
    },
    once: true,
  };
}

function handleResult(label: string, result: PtyDriveResult): void {
  if (result.aborted === 'need:ssoLogin') {
    throw new Error(`${label} 需要 SSO 登录，但未配置 ${ssoPasswordEnv} 环境变量。`);
  }
  if (result.aborted === 'timeout') throw new Error(`${label} 超时无响应，可能卡在未预期的交互提示。`);
  if (result.aborted) throw new Error(`${label} 异常中止：${result.aborted}`);
  if (result.code !== 0) throw new Error(`${label} 失败，exit code ${result.code}。`);
}
