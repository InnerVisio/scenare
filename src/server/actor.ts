import { eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import type { Role } from '@/domain/policy/can';
import { DomainError } from './errors';

export interface Actor {
  id: string;
  role: Role;
  name: string;
}

export async function loadActor(db: Db, userId: string): Promise<Actor> {
  const [user] = await db.select().from(s.users).where(eq(s.users.id, userId));
  if (!user) throw new DomainError('NOT_FOUND', 'Uživatel nenalezen.');
  return { id: user.id, role: user.role, name: user.name };
}
