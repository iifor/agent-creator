'use client';

import { Alert, Button, Card, Input, Layout, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import type { AgentOutput, AgentProgressEvent } from '@agent-creator/core';

interface Message {
  role: 'user' | 'agent';
  content: string;
  output?: AgentOutput;
  progress?: AgentProgressEvent[];
}

export function AgentChat() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const sessionId = useMemo(() => `web_${Date.now()}`, []);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setLoading(true);
    setMessages((current) => [...current, { role: 'user', content: text }]);
    const agentMessageIndex = messages.length + 1;
    setMessages((current) => [...current, { role: 'agent', content: 'Agent is working...', progress: [] }]);
    try {
      const response = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text, sessionId }),
      });
      if (!response.body) throw new Error('Streaming response is unavailable.');
      await readStream(response.body, {
        onProgress(event) {
          setMessages((current) => current.map((message, index) => index === agentMessageIndex
            ? { ...message, content: event.message, progress: [...(message.progress ?? []), event] }
            : message));
        },
        onFinal(output) {
          setMessages((current) => current.map((message, index) => index === agentMessageIndex
            ? { ...message, content: output.message, output }
            : message));
        },
      });
    } catch (error) {
      setMessages((current) => current.map((message, index) => index === agentMessageIndex
        ? { ...message, content: error instanceof Error ? error.message : String(error) }
        : message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout className="appShell">
      <div className="content">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
            <div>
              <Typography.Title level={2} style={{ marginBottom: 0 }}>{{projectName}}</Typography.Title>
              <Typography.Text type="secondary">Agent service example shell</Typography.Text>
            </div>
          </Space>
          <Card>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {messages.length === 0 && (
                <Alert
                  type="info"
                  showIcon
                  message="Configure the model environment variables, then ask the Agent a question."
                />
              )}
              {messages.map((message, index) => (
                <Card key={index} size="small" title={message.role === 'user' ? 'You' : 'Agent'}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Typography.Text>{message.content}</Typography.Text>
                    {message.output && (
                      <Space wrap>
                        <Tag color={message.output.success ? 'green' : 'red'}>{message.output.success ? 'success' : 'failed'}</Tag>
                        <Tag>{message.output.intent}</Tag>
                        {message.output.traceId && <Tag>{message.output.traceId}</Tag>}
                      </Space>
                    )}
                    {message.output?.data !== undefined && (
                      <pre className="jsonBlock">{JSON.stringify(message.output.data, null, 2)}</pre>
                    )}
                    {message.progress && message.progress.length > 0 && (
                      <pre className="jsonBlock">{message.progress.map((event) => `${event.type}: ${event.message}`).join('\n')}</pre>
                    )}
                  </Space>
                </Card>
              ))}
              <Input.Search
                value={input}
                enterButton={<Button type="primary" loading={loading}>Send</Button>}
                placeholder="Ask the agent..."
                onChange={(event) => setInput((event.target as unknown as { value: string }).value)}
                onSearch={send}
                disabled={loading}
              />
            </Space>
          </Card>
        </Space>
      </div>
    </Layout>
  );
}

async function readStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onProgress(event: AgentProgressEvent): void;
    onFinal(output: AgentOutput): void;
  },
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) handleLine(line, handlers);
  }
  if (buffer.trim()) handleLine(buffer, handlers);
}

function handleLine(
  line: string,
  handlers: {
    onProgress(event: AgentProgressEvent): void;
    onFinal(output: AgentOutput): void;
  },
) {
  if (!line.trim()) return;
  const event = JSON.parse(line) as
    | { type: 'progress'; event: AgentProgressEvent }
    | { type: 'final'; output: AgentOutput };
  if (event.type === 'progress') handlers.onProgress(event.event);
  else handlers.onFinal(event.output);
}
