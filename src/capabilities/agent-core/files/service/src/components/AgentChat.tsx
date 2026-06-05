'use client';

import Link from 'next/link';
import { Alert, Button, Card, Input, Layout, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import type { AgentOutput } from '../types/agent';

interface Message {
  role: 'user' | 'agent';
  content: string;
  output?: AgentOutput;
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
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text, sessionId }),
      });
      const output = await response.json() as AgentOutput;
      setMessages((current) => [...current, { role: 'agent', content: output.message, output }]);
    } catch (error) {
      setMessages((current) => [...current, {
        role: 'agent',
        content: error instanceof Error ? error.message : String(error),
      }]);
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
            <Link href="/traces">Trace Viewer</Link>
          </Space>
          <Card>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {messages.length === 0 && (
                <Alert
                  type="info"
                  showIcon
                  message="Try: Tokyo weather tomorrow, calculate 1 + 2 * 3, or hello agent."
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
                        {message.output.traceId && <Link href={`/traces?traceId=${message.output.traceId}`}>{message.output.traceId}</Link>}
                      </Space>
                    )}
                    {message.output?.data !== undefined && (
                      <pre className="jsonBlock">{JSON.stringify(message.output.data, null, 2)}</pre>
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
