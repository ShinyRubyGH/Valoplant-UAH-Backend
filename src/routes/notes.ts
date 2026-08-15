import { Router, Response } from 'express';
import { requireAuth, requireCoach } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import { db } from '../firebase.js';
import { AuthenticatedRequest } from '../types.js';

const router = Router();
router.use(requireAuth);

// Obtener notas del equipo
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teamId = req.user?.teamId;
    if (!teamId) {
       res.status(400).json({ error: 'Team ID es requerido' });
       return;
    }

    const snapshot = await db.collection(`teams/${teamId}/coachNotes`)
      .orderBy('createdAt', 'desc')
      .get();
      
    const notes = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        };
    });

    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Error al obtener notas' });
  }
});

// Crear una nota
router.post('/', requireCoach, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, content, imageUrl } = req.body;
    const user = req.user!;
    
    if (!content?.trim() && !imageUrl) {
        res.status(400).json({ error: 'La nota necesita texto o una imagen' });
        return;
    }

    const noteData = {
      title: title?.trim() || null,
      content: content?.trim() || '',
      imageUrl: imageUrl || null,
      coachId: user.userId,
      coachName: user.name,
      teamId: user.teamId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection(`teams/${user.teamId}/coachNotes`).add(noteData);
    res.status(201).json({ id: docRef.id, ...noteData });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Error al crear la nota' });
  }
});

// Actualizar una nota
router.put('/:id', requireCoach, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const noteId = req.params.id;
    const { title, content, imageUrl } = req.body;
    const user = req.user!;

    if (!content?.trim() && !imageUrl) {
        res.status(400).json({ error: 'La nota necesita texto o una imagen' });
        return;
    }

    const noteRef = db.doc(`teams/${user.teamId}/coachNotes/${noteId}`);
    
    const updates = {
        title: title?.trim() || null,
        content: content?.trim() || '',
        imageUrl: imageUrl || null,
        updatedAt: new Date()
    };

    await noteRef.update(updates);
    res.json({ id: noteId, ...updates });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Error al actualizar la nota' });
  }
});

// Eliminar una nota
router.delete('/:id', requireCoach, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const noteId = req.params.id;
    const user = req.user!;
    
    await db.doc(`teams/${user.teamId}/coachNotes/${noteId}`).delete();
    res.json({ message: 'Nota eliminada' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Error al eliminar la nota' });
  }
});

// Subir imagen para la nota
router.post('/upload', requireCoach, imageUpload.single('image'), (req: AuthenticatedRequest, res: Response): void => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No se subió ninguna imagen' });
            return;
        }
        
        // Generar URL pública basada en el path (este path asume que 'uploads' es expuesto estáticamente)
        const teamId = req.user!.teamId;
        const relativePath = req.file.path.split('uploads')[1].replace(/\\/g, '/');
        const imageUrl = `/uploads${relativePath}`;
        
        res.json({ imageUrl });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: 'Error al subir la imagen' });
    }
});

export default router;
