// Source of truth: foaf-client/client/src/auth/FoafAuthClient.ts

import axios from 'axios';
import { normalizeError } from './errors';
import { mapAuthResponse } from './responseMappers';
import type {
  FoafAuthClientOptions,
  FoafIdentity,
  MappedAuthResponse,
  OAuthAppleNativePayload,
  OAuthGoogleNativePayload,
  OAuthCompletePayload,
  OAuthLinkCompletePayload,
  OAuthLinkSummary,
  OAuthMode,
  OAuthProviderAvailability,
  OAuthStartResponse,
  PasswordChangePayload,
  SignupPayload,
  TokenStorage,
} from './types';

/**
 * Shared HTTP client for the auth.foaf.io surface. Knows nothing about
 * Growoperative or Orchardly profiles — apps extract their own profile
 * fields from `MappedAuthResponse.raw`. Returns identity + token + the
 * raw payload via `MappedAuthResponse`; rejects with `FoafAuthErrorShape`.
 */
export class FoafAuthClient {
  private readonly storage: TokenStorage;
  private readonly clientId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- axios instance
  private readonly http: any;

  constructor(opts: FoafAuthClientOptions) {
    this.storage = opts.storage;
    this.clientId = opts.clientId;
    this.http =
      opts.httpClient ??
      axios.create({
        baseURL: opts.baseUrl,
        timeout: opts.timeoutMs ?? 15000,
        headers: { 'Content-Type': 'application/json' },
        withCredentials: opts.withCredentials ?? false,
      });

    // Attach Bearer token automatically.
    this.http.interceptors.request.use(async (config: { headers?: Record<string, string> }) => {
      const token = await this.storage.getToken();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /** Token storage adapter, exposed for the app's tokenManager wiring. */
  getStorage(): TokenStorage {
    return this.storage;
  }

  /**
   * Run an auth-mutating request that may return a fresh token, persist
   * the token if present, and return the mapped identity + raw payload.
   */
  private async authRequest(
    method: 'post' | 'patch' | 'put' | 'get' | 'delete',
    url: string,
    body?: unknown,
  ): Promise<MappedAuthResponse> {
    try {
      const response = await this.http.request({
        method,
        url,
        data: body,
        params: method === 'get' ? undefined : undefined,
      });
      const mapped = mapAuthResponse(response.data);
      if (mapped.token) {
        await this.storage.setToken(mapped.token);
      }
      return mapped;
    } catch (err) {
      throw normalizeError(err, `auth request ${method.toUpperCase()} ${url} failed`);
    }
  }

  // --- Lifecycle ---

  async login(credentials: { user_name: string; password: string }): Promise<MappedAuthResponse> {
    return this.authRequest('post', '/v1/sessions', {
      username: credentials.user_name,
      password: credentials.password,
      client_id: this.clientId,
    });
  }

  async signup(payload: SignupPayload): Promise<MappedAuthResponse> {
    return this.authRequest('post', '/v1/signup', {
      user: payload,
      client_id: this.clientId,
    });
  }

  async logout(): Promise<void> {
    // Clear the local token FIRST so the app's auth state flips to
    // logged-out immediately. The server DELETE is best-effort: if the
    // request hangs or fails, the user is still logged out locally and
    // the route guard can redirect without waiting on the network. The
    // server-side jti blacklist is a defense-in-depth measure; the
    // token would expire on its own regardless.
    await this.storage.clearToken();
    this.http.delete('/v1/sessions').catch(() => {});
  }

  /**
   * Re-fetch the current identity from the server. Used at app boot to
   * verify the stored token is still valid; also re-issues the token if
   * the server returns a fresh one.
   */
  async restoreSession(): Promise<MappedAuthResponse> {
    return this.authRequest('get', '/v1/sessions');
  }

  // --- Identity-oriented writes ---

  async updateProfile(patch: Partial<FoafIdentity>): Promise<MappedAuthResponse> {
    return this.authRequest('patch', '/v1/users/profile', patch);
  }

  async uploadAvatar(formData: FormData): Promise<{ avatar_url: string }> {
    try {
      const response = await this.http.patch('/v1/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { avatar_url: response.data?.avatar_url ?? null };
    } catch (err) {
      throw normalizeError(err, 'avatar upload failed');
    }
  }

  async changePassword(payload: PasswordChangePayload): Promise<MappedAuthResponse> {
    return this.authRequest('patch', '/v1/users/password', { user: payload });
  }

  // --- Password reset by email (forgot-password) ---

  /**
   * Step 1: ask the server to email a reset link to `email` (a handle or
   * email). Enumeration-safe — the server returns the same response whether or
   * not an account exists, so a resolved promise just means "request accepted".
   * `origin` is the app's web origin; the server validates it against an
   * allowlist before building the link. Carries no token (not auth-shaped),
   * so it does NOT go through authRequest/mapAuthResponse.
   */
  async requestPasswordReset(payload: { email: string; origin: string }): Promise<void> {
    try {
      await this.http.post('/v1/password_resets', {
        email: payload.email,
        origin: payload.origin,
        client_id: this.clientId,
      });
    } catch (err) {
      throw normalizeError(err, 'password reset request failed');
    }
  }

  /**
   * Step 2: consume the token from the reset link and set the new password.
   * No auto-login — the response carries no session, so the app routes the
   * user to sign in afterwards.
   */
  async confirmPasswordReset(payload: { token: string; password: string }): Promise<void> {
    try {
      await this.http.post('/v1/password_resets/confirm', {
        token: payload.token,
        password: payload.password,
        password_confirmation: payload.password,
        client_id: this.clientId,
      });
    } catch (err) {
      throw normalizeError(err, 'password reset confirm failed');
    }
  }

  // --- Email verification ---

  /**
   * Ask the server to email a verification link for the calling identity's
   * pending/unverified email. Authenticated — the Bearer token is attached by
   * the request interceptor, so this targets the current identity (no email
   * argument, no enumeration surface). `origin` is the app's web origin; the
   * server validates it against an allowlist before building the link. Carries
   * no token, so it does NOT go through authRequest/mapAuthResponse.
   */
  async requestEmailVerification(payload: { origin: string }): Promise<void> {
    try {
      await this.http.post('/v1/email_verifications', {
        origin: payload.origin,
        client_id: this.clientId,
      });
    } catch (err) {
      throw normalizeError(err, 'email verification request failed');
    }
  }

  /**
   * Consume the token from the verification link. Token-only / unauthenticated
   * (works from the email link). The server promotes the snapshotted address to
   * the verified email without logging the user out; the app refreshes its
   * session afterwards so the badge flips.
   */
  async confirmEmailVerification(payload: { token: string }): Promise<void> {
    try {
      await this.http.post('/v1/email_verifications/confirm', {
        token: payload.token,
        client_id: this.clientId,
      });
    } catch (err) {
      throw normalizeError(err, 'email verification confirm failed');
    }
  }

  // --- OAuth provider login (Job 49) ---

  /**
   * Tells the app which OAuth providers the server can complete a flow
   * for. Used at app boot to decide which buttons to render — the app
   * never tries a provider whose env hasn't been configured server-side.
   */
  async listOAuthProviders(): Promise<OAuthProviderAvailability[]> {
    try {
      const response = await this.http.get('/v1/oauth/providers');
      return Array.isArray(response.data?.providers) ? response.data.providers : [];
    } catch (err) {
      throw normalizeError(err, 'oauth providers fetch failed');
    }
  }

  /**
   * Begin an authorization-code flow for the named provider. Server
   * generates the state token + stashes PKCE state; client receives the
   * authorization URL to navigate to in a browser.
   */
  async startOAuth(provider: string, redirect_uri: string, mode: OAuthMode = 'login'): Promise<OAuthStartResponse> {
    try {
      const response = await this.http.post(`/v1/oauth/${provider}/start`, {
        redirect_uri,
        mode,
        client_id: this.clientId,
      });
      return response.data;
    } catch (err) {
      throw normalizeError(err, `oauth ${provider} start failed`);
    }
  }

  /**
   * Exchange the provider code for a session token. Resolver may return
   * one of: a v1 session envelope (`{ token, identity }`), a link-required
   * envelope, or a needs-handle envelope. All shapes flow through the same
   * mapper layer; callers branch on `shape`.
   */
  async completeOAuth(provider: string, payload: OAuthCompletePayload): Promise<MappedAuthResponse> {
    return this.authRequest('post', `/v1/oauth/${provider}/callback`, {
      ...payload,
      client_id: this.clientId,
    });
  }

  /**
   * iOS-native Sign in with Apple. Server verifies the identity_token
   * against Apple's JWKS + nonce hash, then runs the same resolver as the
   * web/Android code-exchange path. Apple's `full_name` + `email` are
   * captured on the FIRST authorization only — the client must surface
   * those values here when present.
   */
  async completeAppleNative(payload: OAuthAppleNativePayload): Promise<MappedAuthResponse> {
    return this.authRequest('post', '/v1/oauth/apple/native', {
      ...payload,
      client_id: this.clientId,
    });
  }

  /**
   * Native Sign in with Google (iOS/Android/web SDK). Server verifies the
   * `id_token` against Google's JWKS, then runs the same resolver as the
   * web code-exchange path. Same shape contract as Apple native.
   */
  async completeGoogleNative(payload: OAuthGoogleNativePayload): Promise<MappedAuthResponse> {
    return this.authRequest('post', '/v1/oauth/google/native', {
      ...payload,
      client_id: this.clientId,
    });
  }

  /** List the calling identity's linked OAuth providers. Bearer-authed. */
  async listOAuthLinks(): Promise<OAuthLinkSummary[]> {
    try {
      const response = await this.http.get('/v1/oauth/links');
      return Array.isArray(response.data?.links) ? response.data.links : [];
    } catch (err) {
      throw normalizeError(err, 'oauth links fetch failed');
    }
  }

  /**
   * Remove a linked provider. Refuses to leave the identity with no
   * usable credential — surfaces a `would_leave_no_credential` error in
   * that case so the UI can prompt the user to set a password first.
   */
  async unlinkOAuth(provider: string): Promise<void> {
    try {
      await this.http.delete(`/v1/oauth/links/${provider}`, {
        params: { client_id: this.clientId },
      });
    } catch (err) {
      throw normalizeError(err, `oauth ${provider} unlink failed`);
    }
  }

  /**
   * Complete a link-challenge (existing-email collision path) by proving
   * control of the target identity, OR complete a needs-handle signup by
   * supplying a user-chosen handle. Same endpoint; payload shape selects
   * the branch.
   */
  async completeOAuthLink(payload: OAuthLinkCompletePayload): Promise<MappedAuthResponse> {
    return this.authRequest('post', '/v1/oauth/links/complete', {
      ...payload,
      client_id: this.clientId,
    });
  }
}

export type { FoafAuthClientOptions } from './types';
