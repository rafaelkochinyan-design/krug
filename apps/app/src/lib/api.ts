import { createApiClient, type ApiError as ApiErrorBody } from '@krug/api-client';
import { useSyncExternalStore } from 'react';
import { storage } from './storage';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787').replace(
  /\/$/,
  '',
);

/** TEMPORARY until step 0.7 (Better Auth): lets testers act as one of the API's seeded dev users. */
export const DEV_AUTH = process.env.EXPO_PUBLIC_DEV_AUTH === '1';
export const DEV_USERS = ['dev-anna', 'dev-arman', 'dev-mariam', 'dev-davit'] as const;
const DEV_USER_KEY = 'krug.devUser';

let devUser: string = storage.get(DEV_USER_KEY) ?? DEV_USERS[0];
const listeners = new Set<() => void>();

export function setDevUser(id: string) {
  devUser = id;
  storage.set(DEV_USER_KEY, id);
  listeners.forEach((l) => l());
}

export function useDevUser(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => devUser,
  );
}

export const api = createApiClient({ baseUrl: API_URL });
if (DEV_AUTH) {
  api.use({
    onRequest({ request }) {
      request.headers.set('x-dev-user-id', devUser);
      return request;
    },
  });
}

/** One error type for every failed call, so screens handle failures in one way. */
export class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  /** Field-level validation messages from the API, keyed by field path. */
  fieldErrors(): Record<string, string> {
    if (this.code !== 'validation_error' || !Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const d of this.details as { path?: unknown; message?: unknown }[]) {
      if (typeof d.path === 'string' && typeof d.message === 'string') out[d.path] ??= d.message;
    }
    return out;
  }
}

/** Unwraps an openapi-fetch result: returns data or throws RequestError (network failures become status 0). */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await call;
  } catch {
    throw new RequestError(0, 'network', 'Network error');
  }
  if (result.response.ok) return result.data as T;
  const body = result.error as Partial<ApiErrorBody> | undefined;
  throw new RequestError(
    result.response.status,
    body?.error?.code ?? 'unknown',
    body?.error?.message ?? result.response.statusText,
    body?.error?.details,
  );
}
