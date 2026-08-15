import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!getApps().length) {
  initializeApp({ 
    credential: rawServiceAccount ? cert(JSON.parse(rawServiceAccount)) : applicationDefault() 
  });
}

const db = getFirestore();

async function seedDatabase() {
  console.log('Iniciando el Seeding de la base de datos...');
  const teamId = 'team-fenix';
  const coachUid = 'demo-coach-uid-123';
  const playerUid = 'demo-player-uid-123';

  // 1. Crear Perfiles de Usuario de prueba
  console.log('Creando perfiles de usuario...');
  await db.doc(`users/${coachUid}`).set({
    name: 'Sebastián (Coach)',
    teamId: teamId,
    role: 'coach',
    createdAt: new Date()
  });

  await db.doc(`users/${playerUid}`).set({
    name: 'Jugador 1',
    teamId: teamId,
    role: 'player',
    createdAt: new Date()
  });

  // 2. Crear documento del equipo (Opcional pero buena práctica)
  await db.doc(`teams/${teamId}`).set({
    name: 'Team Fénix',
    createdAt: new Date()
  });

  // 3. Crear Notas de Estrategia
  console.log('Creando notas de coach...');
  const notesRef = db.collection(`teams/${teamId}/coachNotes`);
  await notesRef.add({
    title: 'Estrategia Ascent - Atacantes',
    content: 'Ejecución rápida en A. Jett entra con dash a generador, Omen pone humos en heaven y puerta. Sova tira el recon a default.',
    imageUrl: null,
    coachId: coachUid,
    coachName: 'Sebastián (Coach)',
    teamId: teamId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await notesRef.add({
    title: 'Defensa Bind',
    content: 'Cypher controla B con cables en Hookah y Larga. Todo el equipo rota según la cámara.',
    imageUrl: null,
    coachId: coachUid,
    coachName: 'Sebastián (Coach)',
    teamId: teamId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // 4. Crear Horarios / Eventos
  console.log('Creando eventos de horario...');
  const scheduleRef = db.collection(`teams/${teamId}/scheduleEvents`);
  await scheduleRef.add({
    type: 'clase',
    day: 'Lunes',
    time: '19:00',
    description: 'Revisión de VODs del torneo pasado',
    teamId: teamId,
    timezone: 'America/Santiago'
  });

  await scheduleRef.add({
    type: 'scrim',
    day: 'Miércoles',
    time: '20:30',
    description: 'Práctica contra el equipo Leviatán Academy',
    teamId: teamId,
    timezone: 'America/Santiago'
  });

  await scheduleRef.add({
    type: 'premier',
    day: 'Sábado',
    time: '21:00',
    description: 'Partido oficial de Premier',
    teamId: teamId,
    timezone: 'America/Santiago'
  });

  console.log('¡Seeding completado con éxito!');
}

seedDatabase().catch(console.error);
