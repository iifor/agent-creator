import { NextResponse } from 'next/server';
import config from '../../../../../agent.config';

export async function GET() {
  const baseUrlConfigured = Boolean(config.model.baseUrl?.trim());
  const apiKeyConfigured = Boolean(config.model.apiKey?.trim());

  return NextResponse.json({
    ok: baseUrlConfigured && apiKeyConfigured,
    name: config.name,
    version: config.version,
    service: {
      enabled: config.service.enabled,
      framework: config.service.framework,
    },
    model: {
      configured: baseUrlConfigured && apiKeyConfigured,
      baseUrlConfigured,
      apiKeyConfigured,
      model: config.model.model,
    },
  });
}
