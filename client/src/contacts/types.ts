import type { TokenStorage } from '../auth';

export interface FoafContactEdge {
  foaf_id: string;
  created_at: string | null;
  created_via_invitation_id: string | null;
}

export interface FoafContactsResponse {
  contacts: FoafContactEdge[];
}

export interface FoafContactsClientOptions {
  baseUrl: string;
  clientId: string;
  storage: TokenStorage;
  timeoutMs?: number;
  httpClient?: {
    get(
      url: string,
      config: { params: Record<string, string>; headers: Record<string, string> },
    ): Promise<{ data: FoafContactsResponse }>;
  };
}
