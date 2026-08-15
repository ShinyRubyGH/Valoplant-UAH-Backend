import { Request } from 'express';

export type UserRole = 'coach' | 'player';

export interface AuthenticatedUser {
  userId: string;
  teamId: string;
  role: UserRole;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
