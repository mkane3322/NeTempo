export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  currency: string;
}

export type AssetType = 'bank' | 'investment' | 'crypto' | 'real_estate' | 'vehicle' | 'other';
export type AssetSource = 'plaid' | 'coingecko' | 'attom' | 'manual';

export interface Asset {
  _id: string;
  name: string;
  type: AssetType;
  value: number;
  currency: string;
  source: AssetSource;
  coinGeckoId?: string;
  address?: string;
  quantity?: number;
  lastUpdated: string;
}

export type LiabilityType =
  | 'mortgage'
  | 'auto_loan'
  | 'student_loan'
  | 'credit_card'
  | 'personal_loan'
  | 'other';

export interface Liability {
  _id: string;
  name: string;
  type: LiabilityType;
  balance: number;
  currency: string;
  interestRate?: number;
  minimumPayment?: number;
  dueDate?: number;
}

export interface Snapshot {
  _id: string;
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  breakdown: {
    bank: number;
    investment: number;
    crypto: number;
    real_estate: number;
    vehicle: number;
    other: number;
  };
}

export type TimelineRange = '30d' | '90d' | '1y' | 'all';
