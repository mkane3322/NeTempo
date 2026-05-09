// services/exchangeRate.ts
import axios from 'axios';
import { PriceCache } from '../models';

const EXCHANGE_BASE = 'https://api.exchangerate.host/convert';

export async function convertToUSD(amount: number, fromCurrency: string): Promise<number> {
  if (fromCurrency === 'USD') return amount;

  const cacheKey = `${fromCurrency}_USD`;

  // Check cache
  try {
    const cached = await PriceCache.findOne({ identifier: cacheKey, source: 'exchangerate' });
    if (cached) return amount * cached.fetchedValue;
  } catch {
    // Cache miss
  }

  const res = await axios.get(EXCHANGE_BASE, {
    params: { from: fromCurrency, to: 'USD', amount: 1 },
    timeout: 5000,
  });

  const rate = res.data?.result;
  if (!rate) throw new Error(`Could not convert ${fromCurrency} to USD`);

  // Cache the rate
  await PriceCache.findOneAndUpdate(
    { identifier: cacheKey, source: 'exchangerate' },
    { fetchedValue: rate, currency: 'USD', fetchedAt: new Date() },
    { upsert: true }
  );

  return amount * rate;
}
