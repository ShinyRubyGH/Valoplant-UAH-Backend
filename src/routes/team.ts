import { Router, Response } from 'express';
import { requireAuth, requireCoach } from '../middleware/auth.js';
import { db } from '../firebase.js';
import { AuthenticatedRequest } from '../types.js';

const router = Router();
router.use(requireAuth);

// GET /api/team/members - Lista todos los miembros del equipo
router.get('/members', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teamId = req.user?.teamId;
    if (!teamId) {
      res.status(400).json({ error: 'Team ID es requerido' });
      return;
    }

    const snapshot = await db.collection('users').where('teamId', '==', teamId).get();
    
    const members = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        userId: doc.id,
        name: data.name || 'Sin nombre',
        email: data.email || 'Sin email',
        role: data.role, // 'coach' o 'player'
        status: data.status || 'activo',
        gameRoles: data.gameRoles || [], // ej: ['Controlador', 'Flex']
        teamRole: data.teamRole || (data.role === 'coach' ? 'igl' : 'miembro'), // 'igl', 'co igl', 'miembro'
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      };
    });

    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Error al obtener miembros del equipo' });
  }
});

// PUT /api/team/members/:userId - Actualiza la información de un miembro
router.put('/members/:userId', requireCoach, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status, gameRoles, teamRole } = req.body;
    const coachTeamId = req.user!.teamId;

    // Verificar que el usuario pertenece al mismo equipo
    const userRef = db.collection('users').doc(userId as string);
    const userSnap = await userRef.get();

    if (!userSnap.exists || userSnap.data()?.teamId !== coachTeamId) {
      res.status(404).json({ error: 'Usuario no encontrado en tu equipo' });
      return;
    }

    const validStatuses = ['activo', 'desactivado', 'fuera del team'];
    const validTeamRoles = ['igl', 'co igl', 'miembro'];

    const updates: Record<string, any> = {};
    if (status && validStatuses.includes(status)) updates.status = status;
    if (Array.isArray(gameRoles)) updates.gameRoles = gameRoles;
    if (teamRole && validTeamRoles.includes(teamRole)) updates.teamRole = teamRole;

    if (Object.keys(updates).length > 0) {
        await userRef.update(updates);
    }
    
    res.json({ message: 'Usuario actualizado correctamente', updates });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

export default router;
