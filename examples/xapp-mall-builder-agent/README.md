# xapp-mall-builder-agent

Example Agent for conversational builds and QA direct uploads in:

```bash
/Users/wuqingfu/Desktop/weimob/saas-fe-xapp-mall
```

The Agent is intentionally scoped to low-risk operations:

- QA channel resolve + build
- QA direct upload for explicit subpackages or all subpackages
- No prod upload
- No release flow, version bump, git commit, tag, or push

## Setup

Edit `agent.config.ts` and set the minimum model configuration:

```ts
model: {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'your-key',
  model: 'gpt-4o-mini', // optional; defaults to gpt-4o-mini
}
```

You can also keep the generated environment-variable reads:

```bash
npm install

export LLM_BASE_URL=https://api.openai.com/v1
export OPENAI_API_KEY=your-key
# Optional override. Defaults to gpt-4o-mini.
export LLM_MODEL=gpt-4o-mini
```

For QA direct upload, configure SSO password before running the confirmed upload:

```bash
export XAPP_SSO_PASSWORD='your-sso-password'
```

The password is only passed to the PTY response rule and is not written into skill logs.

## Commands

```bash
npm run build
npm start
npm test
npm run dev
```

`npm run dev` starts the TypeScript CLI. `npm run build && npm start` starts the compiled CLI. The package bin is `xapp-mall-builder-agent`.

## Supported Requests

The skill asks the configured model to turn natural language into a structured intent, then validates that intent against real subpackages from the target repo.

Build examples:

```text
构建 qa 微信
构建 qa 支付宝
```

QA direct upload examples:

```text
帮我发布qa ec_order
上传 qa ec_order
上传 qa ec_order ec_user
上传 qa 全部分包
```

For upload requests, the first turn returns `needConfirmation` with the interpreted intent and command preview:

```text
User: 帮我发布qa ec_order
Agent: 我理解为 QA 环境直接上传，渠道 wx，分包 ec_order。请回复“确认”后执行。

User: 确认
Agent: 执行 npm run resolve:wx 和 npx --yes titan-cli publish --env=qa --debug --checked=ec_order
```

The pending upload is stored per Agent session. If you call the skill programmatically, you can still bypass the second conversational turn with `confirm: true`.

```ts
await runAgent({
  input: 'xapp.build:',
  metadata: {
    skill: 'xapp.build',
    skillInput: {
      query: '上传 qa ec_order',
      confirm: true,
    },
  },
});
```

## Skill Contract

Input:

```ts
{
  query: string;
  dryRun?: boolean;
  confirm?: boolean;
}
```

Output:

```ts
{
  ok: boolean;
  action: 'build' | 'directUpload' | 'blocked' | 'needConfirmation';
  intent?: object;
  logs: string[];
  message: string;
}
```

Direct upload with `dryRun: true` adds `--skipUpload` to the `titan-cli publish` command.
