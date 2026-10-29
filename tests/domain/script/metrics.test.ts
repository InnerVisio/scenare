import { describe, expect, it } from 'vitest';
import { durationSec, sceneCount, speakers } from '@/domain/script/metrics';
import { emptyScript } from '@/domain/script/template';
import { fixture } from './fixtures';

describe('durationSec', () => {
  it('is the max toSec', () => {
    expect(durationSec(fixture())).toBe(21);
  });
  it('is 2 for emptyScript', () => {
    expect(durationSec(emptyScript())).toBe(2);
  });
  it('is null when no scene has toSec', () => {
    const body = fixture();
    body.scenes = body.scenes.map((s) => ({ ...s, toSec: null }));
    expect(durationSec(body)).toBeNull();
  });
  it('is null with no scenes', () => {
    const body = fixture();
    body.scenes = [];
    expect(durationSec(body)).toBeNull();
  });
});

describe('sceneCount', () => {
  it('counts scenes', () => {
    expect(sceneCount(fixture())).toBe(3);
    expect(sceneCount(emptyScript())).toBe(3);
  });
});

describe('speakers', () => {
  it('returns unique speakers in order of appearance, skipping empty', () => {
    expect(speakers(fixture())).toEqual(['Radek', 'Honza']);
  });
  it('is empty for emptyScript', () => {
    expect(speakers(emptyScript())).toEqual([]);
  });
});
