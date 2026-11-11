import createClient from 'openapi-fetch';
import type { components, paths } from './generated/schema';

export type { components, paths };
export type Schemas = components['schemas'];
export type ApiError = Schemas['Error'];

export interface ClientOptions {
  baseUrl: string;
  /** TEMPORARY until step 0.7: development user id sent as x-dev-user-id. */
  devUserId?: string;
}

/** Typed API client generated from the API's OpenAPI document: a renamed field breaks the build, not the app. */
export function createApiClient({ baseUrl, devUserId }: ClientOptions) {
  return createClient<paths>({
    baseUrl,
    credentials: 'include',
    headers: devUserId ? { 'x-dev-user-id': devUserId } : undefined,
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
