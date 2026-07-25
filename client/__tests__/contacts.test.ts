import { createMemoryTokenStorage } from '../src/auth';
import { FoafContactsClient } from '../src/contacts';

describe('FoafContactsClient', () => {
  it('passes audience and Bearer token and returns graph edges', async () => {
    const get = jest.fn(async () => ({
      data: {
        contacts: [
          {
            foaf_id: 'identity-2',
            created_at: '2026-07-24T00:00:00Z',
            created_via_invitation_id: null,
          },
        ],
      },
    }));
    const client = new FoafContactsClient({
      baseUrl: 'https://auth.foaf.test',
      clientId: 'onloan',
      storage: createMemoryTokenStorage('token'),
      httpClient: { get },
    });

    expect(await client.list()).toHaveLength(1);
    expect(get).toHaveBeenCalledWith('/v1/contacts', {
      params: { client_id: 'onloan' },
      headers: { Authorization: 'Bearer token' },
    });
  });
});
