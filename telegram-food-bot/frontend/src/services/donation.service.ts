import { apiService, ApiResponse } from './api.service';

export interface CreateStarsInvoiceResponse {
  invoiceUrl: string;
  donationId: string;
  amountStars: number;
}

class DonationService {
  /**
   * Создать Telegram Stars инвойс на сумму в Stars.
   * Возвращает invoiceUrl, который надо открыть через Telegram.WebApp.openInvoice.
   */
  async createStarsInvoice(
    amountStars: number
  ): Promise<ApiResponse<CreateStarsInvoiceResponse>> {
    return apiService.post<CreateStarsInvoiceResponse>('/donations/stars', {
      amountStars,
    });
  }
}

export const donationService = new DonationService();
