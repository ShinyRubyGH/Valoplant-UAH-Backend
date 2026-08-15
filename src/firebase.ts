import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const rawServiceAccount = process.env['FIREBASE_SERVICE_ACCOUNT'];

if (!getApps().length) {
  initializeApp({ credential: rawServiceAccount ? cert(JSON.parse(rawServiceAccount)) : applicationDefault() });
}

export const adminAuth = getAuth();
export const db = getFirestore();
