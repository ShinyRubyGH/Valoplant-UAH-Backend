import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import notesRouter from './routes/notes.js';
import scheduleRouter from './routes/schedule.js';
import authRouter from './routes/auth.js';
import teamRouter from './routes/team.js';
import swaggerUi from 'swagger-ui-express';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const swaggerDocument = JSON.parse(fs.readFileSync(path.resolve('./src/swagger.json'), 'utf-8'));

// Configuración de CORS amplia para permitir peticiones desde Ionic y localhost
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With']
}));
app.use(express.json());

// Documentación de Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Servir la carpeta uploads para que las imágenes sean accesibles
const uploadFolder = path.resolve(process.env['UPLOAD_DIR'] ?? './uploads');
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}
app.use('/uploads', express.static(uploadFolder));

app.use('/api/auth', authRouter);
app.use('/api/team', teamRouter);
app.use('/api/notes', notesRouter);
app.use('/api/schedule', scheduleRouter);

// Redirigir la raíz a la documentación Swagger
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Valoplant API is running' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Trigger restart for swagger update
