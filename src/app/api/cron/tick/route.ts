import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { runTick } from '@/server/notify/tick';

export const dynamic = 'force-dynamic';

function authorised(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET není nastavený.' }, { status: 503 });
  if (!authorised(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'Neplatné oprávnění.' }, { status: 401 });
  }
  return NextResponse.json(await runTick(await getDb(), new Date()), { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = handle;
export const POST = handle;
