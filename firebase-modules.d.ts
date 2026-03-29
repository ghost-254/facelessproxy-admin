declare module "firebase/app" {
  export function initializeApp(config: Record<string, unknown>): unknown;
  export function getApp(): unknown;
  export function getApps(): unknown[];
}

declare module "firebase/auth" {
  export type User = {
    uid?: string;
    email?: string | null;
    getIdToken: (forceRefresh?: boolean) => Promise<string>;
  };

  export function getAuth(app?: unknown): unknown;
  export function signOut(auth: unknown): Promise<void>;
  export function signInWithEmailAndPassword(
    auth: unknown,
    email: string,
    password: string,
  ): Promise<{ user: User }>;
  export function onAuthStateChanged(
    auth: unknown,
    nextOrObserver: (user: User | null) => void,
  ): () => void;
}

declare module "firebase/firestore" {
  export class Timestamp {
    static fromDate(date: Date): Timestamp;
    toDate(): Date;
  }

  export type DocumentSnapshot = {
    id: string;
    exists: () => boolean;
    data: () => Record<string, unknown>;
  };

  export function getFirestore(app?: unknown): unknown;
  export function collection(...args: unknown[]): unknown;
  export function query(...args: unknown[]): unknown;
  export function where(...args: unknown[]): unknown;
  export function orderBy(...args: unknown[]): unknown;
  export function limit(value: number): unknown;
  export function startAfter(...args: unknown[]): unknown;
  export function getDocs(...args: unknown[]): Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> }>;
  export function doc(...args: unknown[]): unknown;
  export function getDoc(...args: unknown[]): Promise<DocumentSnapshot>;
  export function updateDoc(...args: unknown[]): Promise<void>;
  export function deleteDoc(...args: unknown[]): Promise<void>;
  export function serverTimestamp(): unknown;
}
