import { Router, Response } from 'express';
import { requireAuth, requireCoach } from '../middleware/auth.js';
import { adminAuth, db } from '../firebase.js';
import { AuthenticatedRequest, UserRole } from '../types.js';

const router = Router();

// Clave secreta que solo los verdaderos Coaches conocen
const COACH_SECRET_KEY = process.env['COACH_SECRET_KEY'] || 'sakura123';

// Endpoint para validar el token y obtener el perfil del usuario actual
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    
    res.json({
      userId: user.userId,
      teamId: user.teamId,
      role: user.role,
      name: user.name
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Error al obtener el perfil' });
  }
});

// Endpoint para registrar un nuevo perfil (validando clave secreta si es Coach)
router.post('/register-profile', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { uid, name, teamId, role, email, coachSecretKey } = req.body;
    if (!uid || !name || !teamId || !role) {
      res.status(400).json({ error: 'Faltan datos requeridos (uid, name, teamId, role)' });
      return;
    }

    if (role !== 'coach' && role !== 'player') {
      res.status(400).json({ error: 'El rol debe ser coach o player' });
      return;
    }

    // Validar clave secreta para los coaches
    if (role === 'coach') {
      if (!coachSecretKey || coachSecretKey.trim() !== COACH_SECRET_KEY) {
        res.status(403).json({ error: 'Clave secreta de Coach incorrecta. Solo los coaches autorizados pueden crear cuentas de Coach.' });
        return;
      }
    }

    const userData: any = {
      name: name.trim(),
      teamId: teamId.trim().toLowerCase(),
      role,
      createdAt: new Date()
    };

    if (email) {
      userData.email = email.toLowerCase().trim();
    }
    
    await db.doc(`users/${uid}`).set(userData, { merge: true });

    // Asegurar que el equipo quede registrado con sus datos y coach
    await db.doc(`teams/${teamId.trim().toLowerCase()}`).set({
      id: teamId.trim().toLowerCase(),
      teamId: teamId.trim().toLowerCase(),
      name: teamId.trim(),
      coachId: uid,
      coachName: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });
    
    res.status(201).json({ message: 'Perfil creado exitosamente' });
  } catch (error) {
    console.error('Error creating profile:', error);
    res.status(500).json({ error: 'Error al crear el perfil' });
  }
});

// Obtener la lista de miembros del equipo del usuario actual
router.get('/team-members', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teamId = req.user!.teamId;
    const snapshot = await db.collection('users')
      .where('teamId', '==', teamId)
      .get();

    const members = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        userId: doc.id,
        name: data['name'] || 'Sin nombre',
        role: data['role'] || 'player',
        teamId: data['teamId'],
        createdAt: data['createdAt']?.toDate?.()?.toISOString() || data['createdAt'] || null
      };
    });

    res.json(members);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Error al obtener miembros del equipo' });
  }
});

// Endpoint exclusivo para que el Coach cree y añada miembros (jugadores) a su equipo
router.post('/create-team-member', requireAuth, requireCoach, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name, role = 'player' } = req.body;
    const coachTeamId = req.user!.teamId;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Debes proporcionar correo, contraseña y nombre del jugador.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    // 1. Crear el usuario en Firebase Authentication vía Admin SDK
    const userRecord = await adminAuth.createUser({
      email: email.trim(),
      password,
      displayName: name.trim()
    });

    // 2. Crear el documento de usuario en Firestore asociado al team del Coach
    await db.doc(`users/${userRecord.uid}`).set({
      name: name.trim(),
      teamId: coachTeamId,
      role: role === 'coach' ? 'coach' : 'player',
      createdAt: new Date()
    });

    res.status(201).json({
      userId: userRecord.uid,
      name: name.trim(),
      email: email.trim(),
      role: role === 'coach' ? 'coach' : 'player',
      teamId: coachTeamId,
      message: 'Jugador creado y asignado al equipo exitosamente.'
    });
  } catch (error: any) {
    console.error('Error creating team member:', error);
    if (error.code === 'auth/email-already-exists') {
      res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado.' });
      return;
    }
    res.status(500).json({ error: error.message || 'Error al crear el nuevo miembro del equipo' });
  }
});

// Eliminar un miembro del equipo (exclusivo para Coach)
router.delete('/team-members/:userId', requireAuth, requireCoach, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.userId;
    const coachTeamId = req.user!.teamId;

    // Verificar que el usuario objetivo pertenezca al mismo team
    const memberDoc = await db.doc(`users/${targetUserId}`).get();
    if (!memberDoc.exists) {
      res.status(404).json({ error: 'Miembro no encontrado.' });
      return;
    }

    const memberData = memberDoc.data();
    if (memberData?.['teamId'] !== coachTeamId) {
      res.status(403).json({ error: 'No tienes permiso para eliminar miembros de otro equipo.' });
      return;
    }

    // En lugar de eliminarlo, lo marcamos como "fuera del team"
    await db.doc(`users/${targetUserId as string}`).update({
      status: 'fuera del team'
    });

    res.json({ message: 'Miembro marcado como fuera del equipo.' });
  } catch (error) {
    console.error('Error deleting team member:', error);
    res.status(500).json({ error: 'Error al eliminar el miembro' });
  }
});

export default router;
