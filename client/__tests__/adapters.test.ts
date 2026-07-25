import { RailsV1Adapter } from '../src/adapters';

describe('RailsV1Adapter', () => {
  it('unwraps Rails JSON API empty/list envelopes', async () => {
    const adapter = new RailsV1Adapter({
      get: async () => ({ data: { data: [] } }) as never,
      post: async () => ({ data: {} }) as never,
      put: async () => ({ data: {} }) as never,
      delete: async () => ({ data: {} }) as never,
    });
    await expect(adapter.listTrustlines()).resolves.toEqual([]);
  });
});
