import { describe, expect, it } from 'vitest';
import { appUrl } from '@/server/appUrl';

describe('appUrl', () => {
  it('prefers an explicit APP_URL over everything else', () => {
    expect(
      appUrl({ APP_URL: 'https://scenare.example', VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' }),
    ).toBe('https://scenare.example');
  });

  it('uses the branch URL for preview deployments', () => {
    expect(
      appUrl({ VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'scenare-git-feat-a.vercel.app', VERCEL_URL: 'scenare-abc.vercel.app' }),
    ).toBe('https://scenare-git-feat-a.vercel.app');
  });

  it('uses the production domain for production deployments', () => {
    expect(
      appUrl({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'scenare.vercel.app', VERCEL_URL: 'scenare-abc.vercel.app' }),
    ).toBe('https://scenare.vercel.app');
  });

  it('falls back to the deployment URL', () => {
    expect(appUrl({ VERCEL_URL: 'scenare-abc.vercel.app' })).toBe('https://scenare-abc.vercel.app');
    expect(appUrl({ VERCEL_ENV: 'preview', VERCEL_URL: 'scenare-abc.vercel.app' })).toBe('https://scenare-abc.vercel.app');
    expect(appUrl({ VERCEL_ENV: 'production', VERCEL_URL: 'scenare-abc.vercel.app' })).toBe('https://scenare-abc.vercel.app');
  });

  it('returns null when nothing is known', () => {
    expect(appUrl({})).toBeNull();
    expect(appUrl({ APP_URL: '  ', VERCEL_ENV: 'preview' })).toBeNull();
  });
});
