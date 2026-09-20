/**
 * Firestore-compatible data layer backed by the secure FastAPI + MongoDB API.
 * Keeps the exact API surface (collection/doc/setDoc/getDoc/deleteDoc/onSnapshot/writeBatch)
 * used across the app so business logic in App.tsx stays untouched.
 * Real-time is emulated via lightweight polling. Auth uses JWT httpOnly cookies.
 */

const API = '/api';

export type User = any;

// Dummy handles kept for import compatibility (not used by the REST layer)
export const db: any = { __store: true };
export const auth: any = { __store: true };
export const googleProvider: any = { __store: true };

// ---- Auth stubs (Firebase auth surface, unused by direct-login flow) ----
export function onAuthStateChanged(_auth: any, cb: (u: any) => void) {
  cb(null);
  return () => {};
}
export async function signInWithPopup() {
  throw new Error('Login social não está habilitado. Use e-mail/usuário e senha.');
}

// ---- References ----
interface Ref {
  __ref: 'collection' | 'doc';
  path: string[];
}

export function collection(_db: any, ...segments: string[]): Ref {
  return { __ref: 'collection', path: segments };
}
export function doc(_db: any, ...segments: string[]): Ref {
  return { __ref: 'doc', path: segments };
}
export function query(ref: Ref): Ref {
  return ref;
}

// ---- HTTP helpers ----
function pathQuery(path: string[]): string {
  const p = new URLSearchParams();
  path.forEach((seg) => p.append('path', seg));
  return p.toString();
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${url}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {}
    const err: any = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : null;
}

// ---- Document ops ----
export async function setDoc(ref: Ref, data: any, opts?: { merge?: boolean }) {
  return apiFetch('/store/doc', {
    method: 'PUT',
    body: JSON.stringify({ path: ref.path, data, merge: opts?.merge !== false }),
  });
}

export async function getDoc(ref: Ref) {
  const r = await apiFetch(`/store/doc?${pathQuery(ref.path)}`);
  return {
    exists: () => !!r?.exists,
    data: () => r?.data,
    id: r?.id ?? ref.path[ref.path.length - 1],
  };
}

export async function deleteDoc(ref: Ref) {
  return apiFetch(`/store/doc?${pathQuery(ref.path)}`, { method: 'DELETE' });
}

// ---- Query snapshots (polling based real-time) ----
interface DocSnap {
  id: string;
  data: () => any;
}
interface QuerySnap {
  docs: DocSnap[];
  empty: boolean;
  forEach: (fn: (d: DocSnap) => void) => void;
}

const POLL_MS = 4000;

export function onSnapshot(
  ref: Ref,
  onNext: (snap: QuerySnap) => void,
  onError?: (err: any) => void
): () => void {
  let stopped = false;
  let timer: any = null;

  const tick = async () => {
    if (stopped) return;
    try {
      const r = await apiFetch(`/store/collection?${pathQuery(ref.path)}`);
      const docs: DocSnap[] = (r?.docs || []).map((d: any) => ({
        id: d.id,
        data: () => d.data,
      }));
      const snap: QuerySnap = {
        docs,
        empty: docs.length === 0,
        forEach: (fn) => docs.forEach(fn),
      };
      if (!stopped) onNext(snap);
    } catch (e) {
      if (!stopped && onError) onError(e);
    } finally {
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    }
  };

  tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

// ---- Write batch ----
export function writeBatch(_db: any) {
  const ops: any[] = [];
  return {
    set(ref: Ref, data: any, opts?: { merge?: boolean }) {
      ops.push({ type: 'set', path: ref.path, data, merge: opts?.merge !== false });
      return this;
    },
    delete(ref: Ref) {
      ops.push({ type: 'delete', path: ref.path });
      return this;
    },
    async commit() {
      // chunk large batches to keep payloads reasonable
      const CHUNK = 400;
      for (let i = 0; i < ops.length; i += CHUNK) {
        await apiFetch('/store/batch', {
          method: 'POST',
          body: JSON.stringify({ ops: ops.slice(i, i + CHUNK) }),
        });
      }
    },
  };
}

// ---- Auth API ----
export async function apiLogin(emailOrUser: string, password: string) {
  const r = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ emailOrUser, password }),
  });
  return r.profile;
}

export async function apiRegister(name: string, emailOrUser: string, password: string) {
  const r = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, emailOrUser, password }),
  });
  return r.profile;
}

export async function apiAdminCreate(
  name: string,
  emailOrUser: string,
  password: string,
  role: string
) {
  const r = await apiFetch('/auth/admin-create', {
    method: 'POST',
    body: JSON.stringify({ name, emailOrUser, password, role }),
  });
  return r.profile;
}

export async function apiMe() {
  const r = await apiFetch('/auth/me');
  return r.profile;
}

export async function apiLogout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {}
}

export async function signOut(_auth?: any) {
  return apiLogout();
}
