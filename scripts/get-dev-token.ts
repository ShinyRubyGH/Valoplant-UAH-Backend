import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
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

const auth = getAuth();
const db = getFirestore();

// Clave Web de Firebase del usuario
const WEB_API_KEY = "AIzaSyDjPYFZt0o8H-FnZ_ndMTztQ_FzC0DoWy8";

async function getDevToken() {
  const email = 'coach_prueba@valoplant.com';
  const password = 'password1234';
  const teamId = 'team-fenix';

  console.log('Verificando si el usuario de desarrollo existe...');
  let uid = '';

  try {
    const userRecord = await auth.getUserByEmail(email);
    uid = userRecord.uid;
    console.log('El usuario ya existe. UID:', uid);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.log('Creando nuevo usuario...');
      const newUser = await auth.createUser({
        email,
        password,
        displayName: 'Coach de Prueba'
      });
      uid = newUser.uid;
      console.log('Usuario creado con éxito. UID:', uid);
    } else {
      throw error;
    }
  }

  // Asegurar que su perfil esté configurado correctamente en Firestore
  console.log('Configurando el perfil en la base de datos...');
  await db.doc(`users/${uid}`).set({
    name: 'Coach de Prueba',
    teamId: teamId,
    role: 'coach',
    createdAt: new Date()
  }, { merge: true }); // merge por si ya existía no sobreescribir otros datos accidentalmente

  // Iniciar sesión con la API REST de Firebase para obtener el Token
  console.log('Iniciando sesión para obtener el Token...');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true
    })
  });

  const data = await response.json();

  if (data.error) {
    console.error('Error al iniciar sesión:', data.error.message);
    return;
  }

  console.log('\n====================================================');
  console.log('✅ ÉXITO! AQUÍ TIENES TU TOKEN BEARER:');
  console.log('====================================================\n');
  console.log(data.idToken);
  console.log('\n====================================================');
  console.log('Pégalo en Swagger (botón Authorize) y podrás usar la API.');
}

getDevToken().catch(console.error);
