import { NextFunction, Response } from 'express';
import { adminAuth, db } from '../firebase.js';
import { AuthenticatedRequest, AuthenticatedUser, UserRole } from '../types.js';

export async function requireAuth(request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> {
  try {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) { response.status(401).json({ error: 'Falta el token de autenticación.' }); return; }
    const decoded = await adminAuth.verifyIdToken(token);
    const profile = await db.doc(`users/${decoded.uid}`).get();
    if (!profile.exists) { response.status(403).json({ error: 'La cuenta no tiene perfil de team.' }); return; }
    const data = profile.data() as { teamId?: string; role?: UserRole; name?: string };
    if (!data.teamId || (data.role !== 'coach' && data.role !== 'player') || !data.name) {
      response.status(403).json({ error: 'El perfil de usuario es inválido.' }); return;
    }
    request.user = { userId: decoded.uid, teamId: data.teamId, role: data.role, name: data.name } as AuthenticatedUser;
    next();
  } catch {
    response.status(401).json({ error: 'Token inválido o vencido.' });
  }
}

export function requireTeam(request: AuthenticatedRequest, response: Response): boolean {
  if (!request.user || request.params['teamId'] !== request.user.teamId) { response.status(403).json({ error: 'No tienes acceso a este team.' }); return false; }
  return true;
}

export function requireCoach(request: AuthenticatedRequest, response: Response): boolean {
  if (!request.user || request.user.role !== 'coach') { response.status(403).json({ error: 'Solo un coach puede realizar esta acción.' }); return false; }
  return true;
}
