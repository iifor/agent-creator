'use client';

import Link from 'next/link';
import { Button, Card, Layout, List, Space, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

interface TraceSummary {
  traceId: string;
  startedAt: string;
  latencyMs?: number;
  intent?: string;
  success?: boolean;
}

export function TraceViewer() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch('/api/traces');
      const data = await response.json() as { traces: TraceSummary[] };
      setTraces(data.traces);
    } finally {
      setLoading(false);
    }
  }

  async function openTrace(traceId: string) {
    const response = await fetch(`/api/traces/${traceId}`);
    setSelected(await response.json() as Record<string, unknown>);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Layout className="appShell">
      <div className="content">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
            <div>
              <Typography.Title level={2} style={{ marginBottom: 0 }}>Traces</Typography.Title>
              <Typography.Text type="secondary">Local trace files from .agent-traces</Typography.Text>
            </div>
            <Space>
              <Button onClick={refresh} loading={loading}>Refresh</Button>
              <Link href="/">Chat</Link>
            </Space>
          </Space>
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
            <Card>
              <List
                dataSource={traces}
                locale={{ emptyText: 'No traces yet. Send a chat message first.' }}
                renderItem={(trace) => (
                  <List.Item onClick={() => void openTrace(trace.traceId)} style={{ cursor: 'pointer' }}>
                    <List.Item.Meta
                      title={<Typography.Text code>{trace.traceId}</Typography.Text>}
                      description={trace.startedAt}
                    />
                    <Space direction="vertical" align="end">
                      {trace.intent && <Tag>{trace.intent}</Tag>}
                      <Tag color={trace.success ? 'green' : 'red'}>{trace.latencyMs ?? 0}ms</Tag>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
            <Card title="Trace Detail">
              {selected ? (
                <pre className="jsonBlock">{JSON.stringify(selected, null, 2)}</pre>
              ) : (
                <Typography.Text type="secondary">Select a trace to inspect the full JSON record.</Typography.Text>
              )}
            </Card>
          </div>
        </Space>
      </div>
    </Layout>
  );
}
