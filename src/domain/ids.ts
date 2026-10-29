/** 12-char URL-safe random id, derived from crypto.randomUUID() (no dashes). */
export function newId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}
