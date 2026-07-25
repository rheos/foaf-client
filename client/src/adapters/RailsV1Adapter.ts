import type {
  AxiosLikeClient,
  CreditLedgerDataSource,
  CreditLedgerSummary,
  CreditPayment,
  CreditPaymentPath,
  CreditTrustline,
  CreateTrustlineInput,
  FindPathInput,
  LedgerId,
  PaymentInput,
  UpdateTrustlineInput,
} from './types';

/**
 * Rails /v1 translator. Response objects remain structurally compatible with
 * GrowOperative; the generic casts are confined here instead of leaking into UI.
 */
export class RailsV1Adapter implements CreditLedgerDataSource {
  constructor(private readonly http: AxiosLikeClient) {}

  async listTrustlines(): Promise<CreditTrustline[]> {
    const response = await this.http.get<CreditTrustline[] | { data: CreditTrustline[] }>(
      '/v1/trustlines',
    );
    return Array.isArray(response.data) ? response.data : response.data.data ?? [];
  }

  async getTrustline(id: LedgerId): Promise<CreditTrustline> {
    return (await this.http.get<CreditTrustline>(`/v1/trustlines/${id}`)).data;
  }

  async createTrustline(params: CreateTrustlineInput): Promise<CreditTrustline> {
    return (await this.http.post<CreditTrustline>('/v1/trustlines', params)).data;
  }

  async updateTrustline(id: LedgerId, params: UpdateTrustlineInput): Promise<CreditTrustline> {
    return (await this.http.put<CreditTrustline>(`/v1/trustlines/${id}`, params)).data;
  }

  async deactivateTrustline(id: LedgerId): Promise<void> {
    await this.http.delete(`/v1/trustlines/${id}`);
  }

  async getSummary(): Promise<CreditLedgerSummary> {
    return (await this.http.get<CreditLedgerSummary>('/v1/trustlines/summary')).data;
  }

  async makeDirectPayment(id: LedgerId, params: PaymentInput): Promise<CreditPayment> {
    return (await this.http.post<CreditPayment>(`/v1/trustlines/${id}/payment`, params)).data;
  }

  async findPaymentPath(params: FindPathInput): Promise<CreditPaymentPath> {
    return (await this.http.post<CreditPaymentPath>('/v1/trustlines/find_path', params)).data;
  }

  async executePathPayment(
    params: PaymentInput & { path: LedgerId[] },
  ): Promise<CreditPayment> {
    return (
      await this.http.post<CreditPayment>('/v1/trustlines/execute_path_payment', params)
    ).data;
  }
}
