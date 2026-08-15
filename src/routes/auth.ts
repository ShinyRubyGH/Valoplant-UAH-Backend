import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../firebase.js';
import { AuthenticatedRequest, UserRole } from '../types.js';

const router = Router();

// Endpoint para validar el token y obtener el perfil del usuario actual
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }
    
    // Aquí el user ya viene procesado por el middleware requireAuth
    // El middleware ya verificó en Firestore que existe en `users/{uid}`
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

// Endpoint opcional para registrar un nuevo perfil en la base de datos (después del signup en firebase auth)
router.post('/register-profile', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { uid, name, teamId, role } = req.body;
        if (!uid || !name || !teamId || !role) {
            res.status(400).json({ error: 'Faltan datos requeridos' });
            return;
        }
        
        await db.doc(`users/${uid}`).set({
            name,
            teamId,
            role,
            createdAt: new Date()
        });
        
        res.status(201).json({ message: 'Perfil creado exitosamente' });
    } catch (error) {
        console.error('Error creating profile:', error);
        res.status(500).json({ error: 'Error al crear el perfil' });
    }
});

export default router;
