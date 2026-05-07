export type PaymentMethod = 'stars' | 'sbp' | 'crypto';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export type CryptoCurrency = 'BTC' | 'USDT' | 'TON' | 'ETH';

export interface DonationAmount {
  value: number;
  label: string;
  popular?: boolean;
}

export const DONATION_AMOUNT_PRESETS: DonationAmount[] = [
  { value: 100, label: 'Кофе' },
  { value: 300, label: 'Обед', popular: true },
  { value: 500, label: 'Ужин' },
  { value: 1000, label: 'Щедро' },
];

export const DONATION_AMOUNT_MIN = 50;
export const DONATION_AMOUNT_MAX = 10000;

export interface PaymentMethodInfo {
  id: PaymentMethod;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  amounts: DonationAmount[];
}

export interface CreateDonationRequest {
  amount: number;
  method: PaymentMethod;
  currency?: string;
  userId?: number;
}

export interface CreateDonationResponse {
  success: boolean;
  data?: {
    invoiceUrl?: string;
    paymentId?: string;
    qrCode?: string;
  };
  error?: string;
}

export interface Donation {
  id: number;
  userId: number;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paymentId?: string;
  txHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DonationStats {
  totalAmount: number;
  totalDonations: number;
  lastDonation?: Donation;
}
