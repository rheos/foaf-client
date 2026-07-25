// Source of truth: foaf-client/client/__tests__/errors.test.ts

import { FoafAuthErrorShape, normalizeError } from '../src/auth/errors';

function axiosLike(status: number, data: unknown, message = 'Request failed') {
  return {
    isAxiosError: true,
    message,
    response: { status, data },
  };
}

describe('normalizeError', () => {
  it('passes a server-supplied error code through (Job 37 bridge sunset)', () => {
    const err = normalizeError(
      axiosLike(401, {
        error: 'Legacy auth bridge has been retired; please sign in again.',
        code: 'client_too_old_auth_bridge_expired',
      }),
    );

    expect(err).toBeInstanceOf(FoafAuthErrorShape);
    expect(err.status).toBe(401);
    expect(err.code).toBe('client_too_old_auth_bridge_expired');
    expect(err.message).toBe('Legacy auth bridge has been retired; please sign in again.');
  });

  it('falls back to a status-derived code when no server code is present', () => {
    const err = normalizeError(axiosLike(401, { error: 'unauthenticated' }));
    expect(err.code).toBe('unauthenticated');
  });

  it('prefers server code over status-derived code', () => {
    const err = normalizeError(
      axiosLike(401, { error: 'something else', code: 'invalid_credentials' }),
    );
    expect(err.code).toBe('invalid_credentials');
  });

  it('emits network_error for status === 0', () => {
    const err = normalizeError(axiosLike(0, undefined, 'Network Error'));
    expect(err.code).toBe('network_error');
  });

  it('returns validation_failed for 422 when no server code is supplied', () => {
    const err = normalizeError(axiosLike(422, { errors: { user_name: ['taken'] } }));
    expect(err.code).toBe('validation_failed');
    expect(err.fieldErrors).toEqual({ user_name: ['taken'] });
  });
});
