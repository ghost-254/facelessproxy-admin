import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type ServiceAccountConfig = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

let cachedConfig: ServiceAccountConfig | null = null;

function readServiceAccount() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };

    cachedConfig = {
      projectId: parsed.project_id || process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: parsed.client_email || process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: parsed.private_key || process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    };

    return cachedConfig;
  }

  cachedConfig = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  };

  return cachedConfig;
}

function normalizePrivateKey(privateKey?: string) {
  if (!privateKey) {
    return undefined;
  }

  return privateKey.replace(/\\n/g, "\n");
}

export function isFirebaseAdminConfigured() {
  const credentials = readServiceAccount();
  return Boolean(credentials.projectId && credentials.clientEmail && normalizePrivateKey(credentials.privateKey));
}

export function getFirebaseAdminApp(): App {
  if (getApps().length) {
    return getApp();
  }

  const credentials = readServiceAccount();
  const privateKey = normalizePrivateKey(credentials.privateKey);

  if (!credentials.projectId || !credentials.clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.",
    );
  }

  return initializeApp({
    credential: cert({
      projectId: credentials.projectId,
      clientEmail: credentials.clientEmail,
      privateKey,
    }),
  });
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}
