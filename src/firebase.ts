// src/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  initializeFirestore,
  FirestoreSettings,
  doc,
  getDocFromServer,
} from 'firebase/firestore';

const env =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : ({} as Record<string, string | undefined>);

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey:
    env.VITE_FIREBASE_API_KEY || 'AIzaSyD2IQHTaHWzCFws87ju7LIJqiVMEaGt_3o',
  authDomain:
    env.VITE_FIREBASE_AUTH_DOMAIN || 'langjournal-9b6ce.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'langjournal-9b6ce',
  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET ||
    'langjournal-9b6ce.firebasestorage.app',
  messagingSenderId:
    env.VITE_FIREBASE_MESSAGING_SENDER_ID || '808440701803',
  appId:
    env.VITE_FIREBASE_APP_ID ||
    '1:808440701803:web:1f04e4da8aad93c0dbe22e',
};

const databaseId =
  env.VITE_FIREBASE_DATABASE_ID ||
  'ai-studio-langlog-5e6c2433-62fc-4c59-aa05-0cedeb8d1ba8';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore explicitly targeting the provided databaseId
const db = initializeFirestore(app, {} as FirestoreSettings, databaseId);

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function formatFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = formatFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  return signOut(auth);
}

export { app, db, auth, googleProvider };
