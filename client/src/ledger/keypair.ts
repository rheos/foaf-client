import type { FoafKeypair, StringStorage } from './types';

export function createKeypairStore(
  storage: StringStorage,
  key = 'foaf.keypair.v1',
) {
  return {
    async get(): Promise<FoafKeypair | null> {
      const raw = await storage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as FoafKeypair;
    },
    async set(keypair: FoafKeypair): Promise<void> {
      await storage.setItem(key, JSON.stringify(keypair));
    },
    async clear(): Promise<void> {
      await storage.removeItem(key);
    },
  };
}
