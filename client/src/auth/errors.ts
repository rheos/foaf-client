// Source of truth: foaf-client/client/src/auth/errors.ts

import type { FoafAuthError, FoafAuthErrorCode } from './types';

/**
 * Concrete `Error` subclass implementing the `FoafAuthError` contract.
 * Throw or reject with this anywhere a stable, app-facing error is needed.
 */
export class FoafAuthErrorShape extends Error implements FoafAuthError {
  readonly status?: number;
  readonly code?: string;
  readonly email?: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(opts: FoafAuthError) {
    super(opts.message);
    this.name = 'FoafAuthError';
    this.status = opts.status;
    this.code = opts.code;
    this.email = opts.email;
    this.fieldErrors = opts.fieldErrors;
  }
}

interface AxiosLikeError {
  isAxiosError?: boolean;
  message: string;
  response?: {
    status: number;
    data?: unknown;
  };
}

function isAxiosLike(err: unknown): err is AxiosLikeError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'isAxiosError' in err &&
    (err as { isAxiosError: unknown }).isAxiosError === true
  );
}

interface RailsErrorResponse {
  error?: string;
  message?: string;
  code?: string;
  email?: string;
  errors?: Record<string, string[]> | string[] | unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractFieldErrors(data: unknown): Record<string, string[]> | undefined {
  if (!isPlainObject(data)) return undefined;
  const errors = data.errors;
  if (!isPlainObject(errors)) return undefined;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (Array.isArray(value)) {
      out[key] = value.filter((v): v is string => typeof v === 'string');
    } else if (typeof value === 'string') {
      out[key] = [value];
    }
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

function codeForStatus(status: number): FoafAuthErrorCode | undefined {
  if (status === 401) return 'unauthenticated';
  if (status === 422 || status === 400) return 'validation_failed';
  return undefined;
}

/**
 * Normalize any thrown value (axios error, Error, string, unknown) into
 * a `FoafAuthErrorShape`. Use at the boundary of every FoafAuthClient
 * method so callers always see a consistent shape.
 */
export function normalizeError(
  err: unknown,
  fallbackMessage = 'Auth request failed',
): FoafAuthErrorShape {
  if (err instanceof FoafAuthErrorShape) return err;

  if (isAxiosLike(err)) {
    const status = err.response?.status;
    const data = err.response?.data as RailsErrorResponse | undefined;
    const serverMessage =
      (data && typeof data.error === 'string' && data.error) ||
      (data && typeof data.message === 'string' && data.message) ||
      undefined;

    if (typeof status === 'number' && status === 0) {
      return new FoafAuthErrorShape({
        message: 'Network error — could not reach the auth service.',
        code: 'network_error',
      });
    }

    const serverCode =
      isPlainObject(data) && typeof data.code === 'string' ? data.code : undefined;

    const serverEmail =
      isPlainObject(data) && typeof data.email === 'string' ? data.email : undefined;

    return new FoafAuthErrorShape({
      message: serverMessage || err.message || fallbackMessage,
      status,
      code: serverCode || (typeof status === 'number' ? codeForStatus(status) : undefined),
      email: serverEmail,
      fieldErrors: extractFieldErrors(data),
    });
  }

  if (err instanceof Error) {
    return new FoafAuthErrorShape({ message: err.message || fallbackMessage });
  }

  if (typeof err === 'string' && err.length > 0) {
    return new FoafAuthErrorShape({ message: err });
  }

  return new FoafAuthErrorShape({ message: fallbackMessage });
}
