export type DomainErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_TRANSITION' | 'VALIDATION' | 'STALE';

/** Expected business failure. `message` is Czech and safe to show to the user. */
export class DomainError extends Error {
  constructor(
    public code: DomainErrorCode,
    message: string,
    /** Optional Czech list of concrete problems (e.g. unresolved blockers). */
    public details: string[] = [],
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
