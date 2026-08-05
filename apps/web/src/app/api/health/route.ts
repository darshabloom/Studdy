import { NextResponse } from 'next/server';

/** Health endpoint for previews and monitoring. Never exposes secrets. */
export function GET(): NextResponse {
  return NextResponse.json({
    status: 'ok',
    environment: process.env.NEXT_PUBLIC_STUDDY_ENVIRONMENT ?? 'local',
  });
}
