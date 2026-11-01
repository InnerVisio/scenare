/** A sample video (TikTok / Instagram / YouTube link) attached to a script or to one of its scenes. */
export interface VideoReference {
  id: string;
  url: string;
  note: string;
  /** Scene the sample explains, or null for the whole video. */
  sceneId: string | null;
  addedBy: string;
  /** ISO timestamp. */
  addedAt: string;
}

export const MAX_REFERENCES = 10;
export const MAX_REFERENCE_URL = 500;
export const MAX_REFERENCE_NOTE = 300;

export type PlatformKey = 'tiktok' | 'instagram' | 'youtube' | 'other';

export interface Platform {
  key: PlatformKey;
  /** „TikTok“, „Instagram“, „YouTube“ or „Odkaz“. */
  label: string;
  /** Host without „www.“, e.g. "tiktok.com". */
  domain: string;
}

const KNOWN: { key: Exclude<PlatformKey, 'other'>; label: string; hosts: string[] }[] = [
  { key: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'] },
  { key: 'instagram', label: 'Instagram', hosts: ['instagram.com'] },
  { key: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
];

/** Platform of a link; anything else is „Odkaz“ plus its domain. Never throws. */
export function detectPlatform(url: string): Platform {
  let host = '';
  try {
    host = new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return { key: 'other', label: 'Odkaz', domain: '' };
  }
  for (const known of KNOWN) {
    if (known.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return { key: known.key, label: known.label, domain: host };
    }
  }
  return { key: 'other', label: 'Odkaz', domain: host };
}
