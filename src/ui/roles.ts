import type { Role } from '@/domain/policy/can';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  marketer: 'Marketér',
  leadership: 'Vedení',
  production: 'Produkce',
};
