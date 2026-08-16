import { Router, Response } from 'express';
import { requireAuth, requireCoach } from '../middleware/auth.js';
import { db } from '../firebase.js';
import { AuthenticatedRequest } from '../types.js';

const router = Router();
router.use(requireAuth);

// Obtener eventos del equipo
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      res.status(403).json({ error: 'No tienes permisos para ver el horario de este equipo' });
      return;
    }

    const snapshot = await db.collection(`teams/${requestedTeamId}/scheduleEvents`)
      .orderBy('time')
      .get();
      
    const events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    res.json(events);
  } catch (error) {
    console.error('Error fetching schedule events:', error);
    res.status(500).json({ error: 'Error al obtener los eventos' });
  }
});

// Crear un evento
router.post('/', requireCoach, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const eventData = req.body;
    const user = req.user!;
    
    // Asegurar que se asigna al equipo del coach
    eventData.teamId = user.teamId;

    const docRef = await db.collection(`teams/${user.teamId}/scheduleEvents`).add(eventData);
    res.status(201).json({ id: docRef.id, ...eventData });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Error al crear el evento' });
  }
});

// Actualizar un evento
router.put('/:id', requireCoach, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const eventId = req.params.id;
    const updates = req.body;
    const user = req.user!;

    // Evitar que modifiquen el teamId u otros campos clave sin querer, 
    // pero para este ejemplo simple, pasamos updates directo
    delete updates.id;
    delete updates.teamId;

    const eventRef = db.doc(`teams/${user.teamId}/scheduleEvents/${eventId}`);
    await eventRef.update(updates);
    
    res.json({ id: eventId, ...updates });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Error al actualizar el evento' });
  }
});

// Eliminar un evento
router.delete('/:id', requireCoach, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const eventId = req.params.id;
    const user = req.user!;
    
    await db.doc(`teams/${user.teamId}/scheduleEvents/${eventId}`).delete();
    res.json({ message: 'Evento eliminado' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Error al eliminar el evento' });
  }
});

export default router;
