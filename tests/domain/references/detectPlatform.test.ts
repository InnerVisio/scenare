import { describe, expect, it } from 'vitest';
import { detectPlatform } from '@/domain/references';

describe('detectPlatform', () => {
  it.each([
    ['https://www.tiktok.com/@example/video/1234567890', 'TikTok', 'tiktok.com'],
    ['https://vm.tiktok.com/ZMabc/', 'TikTok', 'vm.tiktok.com'],
    ['https://www.instagram.com/reel/Cabc123/', 'Instagram', 'instagram.com'],
    ['https://www.youtube.com/watch?v=abc', 'YouTube', 'youtube.com'],
    ['https://youtu.be/abc', 'YouTube', 'youtu.be'],
    ['http://m.youtube.com/shorts/abc', 'YouTube', 'm.youtube.com'],
  ])('%s -> %s', (url, label, domain) => {
    expect(detectPlatform(url)).toMatchObject({ label, domain });
  });

  it('falls back to „Odkaz“ with the domain', () => {
    expect(detectPlatform('https://www.example.com/clip')).toEqual({ key: 'other', label: 'Odkaz', domain: 'example.com' });
  });

  it('does not match look-alike hosts and survives garbage', () => {
    expect(detectPlatform('https://nottiktok.com/x').label).toBe('Odkaz');
    expect(detectPlatform('not a url')).toEqual({ key: 'other', label: 'Odkaz', domain: '' });
  });
});
