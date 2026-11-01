import { afterEach, describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/cron/tick/route';

const req = (auth?: string) => new Request('http://x/api/cron/tick', { headers: auth ? { authorization: auth } : {} });
const saved = process.env.CRON_SECRET;
afterEach(() => {
  if (saved === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = saved;
});

describe('cron tick route', () => {
  it('answers 503 while CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req('Bearer anything'))).status).toBe(503);
    expect((await POST(req())).status).toBe(503);
  });

  it('answers 401 for a missing or wrong bearer token', async () => {
    process.env.CRON_SECRET = 'right-secret';
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('Bearer wrong-secret'))).status).toBe(401);
    expect((await POST(req('right-secret'))).status).toBe(401);
  });
});
