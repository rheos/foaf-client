// Source of truth: foaf-client/client/__tests__/FoafAuthClient.test.ts

import { FoafAuthClient } from '../src/auth/FoafAuthClient';
import { FoafAuthErrorShape } from '../src/auth/errors';
import { createMemoryTokenStorage } from '../src/auth/storage';

interface FakeAxiosCall {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function makeFakeAxios(handler: (call: FakeAxiosCall) => Promise<{ data: unknown } | never>) {
  const calls: FakeAxiosCall[] = [];
  const requestInterceptors: Array<(config: { headers?: Record<string, string> }) => Promise<unknown>> = [];

  const dispatch = async (call: FakeAxiosCall) => {
    let config: { headers?: Record<string, string> } = { headers: { ...(call.headers ?? {}) } };
    for (const interceptor of requestInterceptors) {
      config = (await interceptor(config)) as typeof config;
    }
    const finalCall = { ...call, headers: config.headers };
    calls.push(finalCall);
    return handler(finalCall);
  };

  const fakeAxios = {
    interceptors: {
      request: {
        use(fn: (config: { headers?: Record<string, string> }) => Promise<unknown>) {
          requestInterceptors.push(fn);
        },
      },
    },
    request(opts: { method: string; url: string; data?: unknown }) {
      return dispatch({ method: opts.method.toLowerCase(), url: opts.url, body: opts.data });
    },
    delete(url: string) {
      return dispatch({ method: 'delete', url });
    },
    patch(url: string, data: unknown, config?: { headers?: Record<string, string> }) {
      return dispatch({ method: 'patch', url, body: data, headers: config?.headers });
    },
  };

  return { fakeAxios, calls };
}

describe('FoafAuthClient — login', () => {
  it('sends client_id and persists token from a v1-shaped response', async () => {
    const { fakeAxios, calls } = makeFakeAxios(async () => ({
      data: {
        token: 'jwt-fresh',
        identity: {
          foaf_id: 'uuid-1',
          user_name: 'bruce',
          first_name: 'Bruce',
          last_name: 'Wayne',
          email: 'b@example.com',
          avatar_url: null,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      },
    }));
    const storage = createMemoryTokenStorage();
    const client = new FoafAuthClient({
      baseUrl: 'https://api.example.com',
      clientId: 'growoperative',
      storage,
      httpClient: fakeAxios,
    });

    const result = await client.login({ user_name: 'bruce', password: 'pass' });

    expect(calls[0]).toMatchObject({
      method: 'post',
      url: '/v1/sessions',
      body: { username: 'bruce', password: 'pass', client_id: 'growoperative' },
    });
    expect(result.identity.user_name).toBe('bruce');
    expect(result.token).toBe('jwt-fresh');
    expect(await storage.getToken()).toBe('jwt-fresh');
  });

  it('also accepts the legacy JSON:API shape from old backends', async () => {
    const { fakeAxios } = makeFakeAxios(async () => ({
      data: {
        data: {
          id: '7',
          type: 'users',
          attributes: {
            user_name: 'bruce',
            first_name: 'Bruce',
            last_name: 'Wayne',
            email: null,
            avatar_url: null,
            created_at: '',
            updated_at: '',
          },
        },
        token: 'jwt-legacy',
      },
    }));
    const storage = createMemoryTokenStorage();
    const client = new FoafAuthClient({
      baseUrl: 'https://api.example.com',
      clientId: 'growoperative',
      storage,
      httpClient: fakeAxios,
    });

    const result = await client.login({ user_name: 'bruce', password: 'pass' });
    expect(result.shape).toBe('legacy-jsonapi');
    expect(result.token).toBe('jwt-legacy');
  });

  it('throws normalized FoafAuthError on invalid credentials', async () => {
    const { fakeAxios } = makeFakeAxios(async () => {
      const err = Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 401, data: { error: 'Username or password are invalid' } },
      });
      throw err;
    });
    const client = new FoafAuthClient({
      baseUrl: 'https://api.example.com',
      clientId: 'growoperative',
      storage: createMemoryTokenStorage(),
      httpClient: fakeAxios,
    });

    await expect(client.login({ user_name: 'x', password: 'y' })).rejects.toBeInstanceOf(
      FoafAuthErrorShape,
    );
    try {
      await client.login({ user_name: 'x', password: 'y' });
      throw new Error('should not reach');
    } catch (err) {
      const foaf = err as FoafAuthErrorShape;
      expect(foaf.status).toBe(401);
      expect(foaf.code).toBe('unauthenticated');
      expect(foaf.message).toBe('Username or password are invalid');
    }
  });
});

describe('FoafAuthClient — restoreSession', () => {
  it('GETs /v1/sessions and surfaces identity', async () => {
    const { fakeAxios, calls } = makeFakeAxios(async () => ({
      data: {
        identity: {
          foaf_id: 'uuid-restore',
          user_name: 'restored',
          first_name: 'R',
          last_name: 'S',
          email: null,
          avatar_url: null,
          created_at: '',
          updated_at: '',
        },
      },
    }));
    const client = new FoafAuthClient({
      baseUrl: 'https://api.example.com',
      clientId: 'growoperative',
      storage: createMemoryTokenStorage('existing-jwt'),
      httpClient: fakeAxios,
    });

    const result = await client.restoreSession();
    expect(calls[0]).toMatchObject({ method: 'get', url: '/v1/sessions' });
    expect(calls[0].headers?.Authorization).toBe('Bearer existing-jwt');
    expect(result.identity.foaf_id).toBe('uuid-restore');
  });
});

describe('FoafAuthClient — logout', () => {
  it('clears stored token even if the server call fails', async () => {
    const { fakeAxios } = makeFakeAxios(async () => {
      throw Object.assign(new Error('server down'), { isAxiosError: true });
    });
    const storage = createMemoryTokenStorage('to-clear');
    const client = new FoafAuthClient({
      baseUrl: 'https://api.example.com',
      clientId: 'growoperative',
      storage,
      httpClient: fakeAxios,
    });

    await client.logout();
    expect(await storage.getToken()).toBeNull();
  });
});

describe('FoafAuthClient — changePassword', () => {
  it('sends only the replacement password and persists the refreshed token', async () => {
    const { fakeAxios, calls } = makeFakeAxios(async () => ({
      data: {
        token: 'jwt-after-password',
        identity: {
          foaf_id: 'uuid-pw',
          user_name: 'bruce',
          first_name: 'Bruce',
          last_name: 'Wayne',
          email: 'b@example.com',
          has_password: true,
          avatar_url: null,
          created_at: '',
          updated_at: '',
        },
      },
    }));
    const storage = createMemoryTokenStorage('jwt-before-password');
    const client = new FoafAuthClient({
      baseUrl: 'https://api.example.com',
      clientId: 'growoperative',
      storage,
      httpClient: fakeAxios,
    });

    const result = await client.changePassword({
      password: 'newpw1234!',
      password_confirmation: 'newpw1234!',
    });

    expect(calls[0]).toMatchObject({
      method: 'patch',
      url: '/v1/users/password',
      body: {
        user: {
          password: 'newpw1234!',
          password_confirmation: 'newpw1234!',
        },
      },
    });
    expect(JSON.stringify(calls[0].body)).not.toContain('current_password');
    expect(calls[0].headers?.Authorization).toBe('Bearer jwt-before-password');
    expect(result.identity.has_password).toBe(true);
    expect(await storage.getToken()).toBe('jwt-after-password');
  });
});

describe('FoafAuthClient — request interceptor', () => {
  it('attaches Bearer when storage has a token', async () => {
    const { fakeAxios, calls } = makeFakeAxios(async () => ({
      data: {
        identity: {
          foaf_id: 'uuid', user_name: 'u', first_name: '', last_name: '',
          email: null, avatar_url: null, created_at: '', updated_at: '',
        },
      },
    }));
    const client = new FoafAuthClient({
      baseUrl: 'https://api.example.com',
      clientId: 'growoperative',
      storage: createMemoryTokenStorage('bearer-test-token'),
      httpClient: fakeAxios,
    });

    await client.restoreSession();
    expect(calls[0].headers?.Authorization).toBe('Bearer bearer-test-token');
  });

  it('omits Bearer when storage is empty', async () => {
    const { fakeAxios, calls } = makeFakeAxios(async () => ({
      data: {
        identity: {
          foaf_id: 'uuid', user_name: 'u', first_name: '', last_name: '',
          email: null, avatar_url: null, created_at: '', updated_at: '',
        },
      },
    }));
    const client = new FoafAuthClient({
      baseUrl: 'https://api.example.com',
      clientId: 'growoperative',
      storage: createMemoryTokenStorage(),
      httpClient: fakeAxios,
    });

    await client.restoreSession();
    expect(calls[0].headers?.Authorization).toBeUndefined();
  });
});
