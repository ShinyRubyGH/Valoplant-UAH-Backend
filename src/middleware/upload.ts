import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { AuthenticatedRequest } from '../types.js';

export const uploadDirectory = path.resolve(process.env['UPLOAD_DIR'] ?? './uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (request, _file, callback) => {
    const teamId = (request as AuthenticatedRequest).user?.teamId;
    if (!teamId) return callback(new Error('No se encontró el team para guardar la imagen.'), uploadDirectory);
    const teamDirectory = path.join(uploadDirectory, 'teams', teamId, 'notes');
    fs.mkdirSync(teamDirectory, { recursive: true });
    callback(null, teamDirectory);
  },
  filename: (_request, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

export const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype.startsWith('image/')),
});
