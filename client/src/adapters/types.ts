export type LedgerId = string | number;

export interface CreditTrustline {
  id: LedgerId;
  counterpartyId?: LedgerId;
  counterpartyAddress?: string;
  counterpartyName?: string;
  balance: number;
  creditlineGiven: number;
  creditlineReceived: number;
  active?: boolean;
  raw?: unknown;
}

export interface CreditLedgerSummary {
  totalReceivable: number;
  totalPayable: number;
  netBalance: number;
  trustlineCount: number;
}

export interface CreditPayment {
  id?: LedgerId;
  amount: number;
  status?: string;
  raw?: unknown;
}

export interface CreditPaymentPath {
  capacity: number;
  path: LedgerId[];
  raw?: unknown;
}

export interface CreateTrustlineInput {
  counterpartyId?: LedgerId;
  counterpartyAddress?: string;
  creditlineGiven: number;
  creditlineReceived: number;
  [key: string]: unknown;
}

export interface UpdateTrustlineInput {
  creditlineGiven?: number;
  creditlineReceived?: number;
  [key: string]: unknown;
}

export interface PaymentInput {
  amount: number;
  memo?: string;
  /** Stable per user intent; required by DirectFoafAdapter at runtime. */
  idempotencyKey?: string;
  toId?: LedgerId;
  toAddress?: string;
  [key: string]: unknown;
}

export interface FindPathInput {
  amount: number;
  toId?: LedgerId;
  toAddress?: string;
  [key: string]: unknown;
}

/**
 * Headless boundary used by shared UI. Apps retain state, navigation, and
 * domain-specific order data; implementations only translate ledger calls.
 */
export interface CreditLedgerDataSource {
  listTrustlines(): Promise<CreditTrustline[]>;
  getTrustline(id: LedgerId): Promise<CreditTrustline>;
  createTrustline(params: CreateTrustlineInput): Promise<CreditTrustline>;
  updateTrustline(id: LedgerId, params: UpdateTrustlineInput): Promise<CreditTrustline>;
  deactivateTrustline(id: LedgerId): Promise<void>;
  getSummary(): Promise<CreditLedgerSummary>;
  makeDirectPayment(id: LedgerId, params: PaymentInput): Promise<CreditPayment>;
  findPaymentPath(params: FindPathInput): Promise<CreditPaymentPath>;
  executePathPayment(params: PaymentInput & { path: LedgerId[] }): Promise<CreditPayment>;
}

export interface AxiosLikeClient {
  get<T>(url: string): Promise<{ data: T }>;
  post<T>(url: string, data?: unknown): Promise<{ data: T }>;
  put<T>(url: string, data?: unknown): Promise<{ data: T }>;
  delete<T>(url: string): Promise<{ data: T }>;
}
