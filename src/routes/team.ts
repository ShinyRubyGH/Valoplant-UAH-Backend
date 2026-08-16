import { Router, Response } from 'express';
import { requireAuth, requireCoach } from '../middleware/auth.js';
import { db } from '../firebase.js';
import { AuthenticatedRequest } from '../types.js';

const router = Router();
router.use(requireAuth);

// GET /api/team/members - Lista todos los miembros del equipo
router.get('/members', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const requestedTeamId = (req.query.teamId as string) || req.user?.teamId;
    if (!requestedTeamId) {
      res.status(400).json({ error: 'Team ID es requerido' });
      return;
    }

    let isAuthorized = false;

    if (req.user?.teamId === requestedTeamId) {
      isAuthorized = true;
    } else {
      const teamDoc = await db.collection('teams').doc(requestedTeamId).get();
      if (teamDoc.exists) {
        const allowedCoaches = teamDoc.data()?.allowedCoachEmails || [];
        if (req.user?.email && allowedCoaches.includes(req.user.email)) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      res.status(403).json({ error: 'No tienes permisos para ver este equipo' });
      return;
    }

    const snapshot = await db.collection('users').where('teamId', '==', requestedTeamId).get();
    
    const members = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        userId: doc.id,
        name: data.name || 'Sin nombre',
        email: data.email || 'Sin email',
        role: data.role,
        status: data.status || 'activo',
        gameRoles: data.gameRoles || [],
        leadership: data.leadership || (data.role === 'coach' ? 'coach' : 'miembro'),
        bestAgents: data.bestAgents || [],
        notes: data.notes || '',
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
    const { name, role, status, leadership, gameRoles, bestAgents, notes } = req.body;
    const coachTeamId = req.user!.teamId;

    const userRef = db.collection('users').doc(userId as string);
    const userSnap = await userRef.get();

    if (!userSnap.exists || userSnap.data()?.teamId !== coachTeamId) {
      res.status(404).json({ error: 'Usuario no encontrado en tu equipo' });
      return;
    }

    const validStatuses = ['activo', 'desactivado', 'fuera del team', 'fuera_del_team'];
    const validLeadershipRoles = ['igl', 'co_igl', 'miembro', 'coach'];
    const validRoles = ['coach', 'player'];

    const updates: Record<string, any> = { updatedAt: new Date() };

    if (name && typeof name === 'string') updates.name = name.trim();
    if (role && validRoles.includes(role)) updates.role = role;
    if (status && validStatuses.includes(status)) updates.status = status;
    if (leadership && validLeadershipRoles.includes(leadership)) updates.leadership = leadership;
    if (Array.isArray(gameRoles)) updates.gameRoles = gameRoles;
    if (Array.isArray(bestAgents)) updates.bestAgents = bestAgents;
    if (typeof notes === 'string') updates.notes = notes;

    await userRef.update(updates);
    
    // Fetch the updated member to return
    const updatedSnap = await userRef.get();
    const updatedData = updatedSnap.data();

    const member = {
      userId: updatedSnap.id,
      ...updatedData,
      createdAt: updatedData?.createdAt?.toDate?.()?.toISOString() || updatedData?.createdAt,
      updatedAt: updatedData?.updatedAt?.toDate?.()?.toISOString() || updatedData?.updatedAt
    };

    res.json({ message: 'Miembro actualizado correctamente', member });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

// POST /api/team/grant-coach-access - Comparte acceso con coach externo
router.post('/grant-coach-access', requireCoach, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { teamId, coachEmail } = req.body;
    if (!teamId || !coachEmail) {
      res.status(400).json({ error: 'teamId y coachEmail son requeridos' });
      return;
    }

    // Un coach solo puede dar acceso a su propio team
    if (req.user?.teamId !== teamId) {
      res.status(403).json({ error: 'Solo puedes otorgar acceso a tu propio equipo' });
      return;
    }

    const email = coachEmail.toLowerCase().trim();
    const teamRef = db.collection('teams').doc(teamId);
    
    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) {
      res.status(404).json({ error: 'Equipo no encontrado' });
      return;
    }

    const currentAllowed = teamDoc.data()?.allowedCoachEmails || [];
    if (!currentAllowed.includes(email)) {
      currentAllowed.push(email);
      await teamRef.update({ allowedCoachEmails: currentAllowed });
    }

    res.json({ message: 'Acceso otorgado al coach' });
  } catch (error) {
    console.error('Error granting access:', error);
    res.status(500).json({ error: 'Error al otorgar acceso al coach' });
  }
});

// POST /api/team/revoke-coach-access - Revoca acceso a coach externo
router.post('/revoke-coach-access', requireCoach, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { teamId, coachEmail } = req.body;
    if (!teamId || !coachEmail) {
      res.status(400).json({ error: 'teamId y coachEmail son requeridos' });
      return;
    }

    if (req.user?.teamId !== teamId) {
      res.status(403).json({ error: 'Solo puedes revocar acceso de tu propio equipo' });
      return;
    }

    const email = coachEmail.toLowerCase().trim();
    const teamRef = db.collection('teams').doc(teamId);
    
    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) {
      res.status(404).json({ error: 'Equipo no encontrado' });
      return;
    }

    const currentAllowed = teamDoc.data()?.allowedCoachEmails || [];
    const newAllowed = currentAllowed.filter((e: string) => e !== email);
    
    await teamRef.update({ allowedCoachEmails: newAllowed });

    res.json({ message: 'Acceso revocado' });
  } catch (error) {
    console.error('Error revoking access:', error);
    res.status(500).json({ error: 'Error al revocar acceso al coach' });
  }
});

export default router;
