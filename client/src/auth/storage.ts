// Source of truth: foaf-client/client/src/auth/storage.ts

import type { TokenStorage } from './types';

/**
 * In-memory token storage. Useful for tests and as a fallback when no
 * platform storage is available. Real apps inject a localStorage or
 * expo-secure-store adapter.
 */
export function createMemoryTokenStorage(initial: string | null = null): TokenStorage {
  let token: string | null = initial;
  return {
    async getToken() {
      return token;
    },
    async setToken(next: string) {
      token = next;
    },
    async clearToken() {
      token = null;
    },
  };
}

export type { TokenStorage } from './types';
