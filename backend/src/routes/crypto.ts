import { Router, Response } from 'express';
import axios from 'axios';
import { Asset, PriceCache } from '../models';
import { authenticate, AuthRequest } from '../middleware/authenticate';

const router = Router();
router.use(authenticate);

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// Fetch price with TTL cache — checks MongoDB before hitting API
export async function getCoinPrice(coinId: string): Promise<number> {
  // Check cache first
  try {
    const cached = await PriceCache.findOne({ identifier: coinId, source: 'coingecko' });
    if (cached) return cached.fetchedValue;
  } catch {
    // Cache miss, proceed to API
  }

  const res = await axios.get(`${COINGECKO_BASE}/simple/price`, {
    params: { ids: coinId, vs_currencies: 'usd' },
    timeout: 5000,
  });

  const price = res.data[coinId]?.usd;
  if (!price) throw new Error(`Price not found for coin: ${coinId}`);

  // Store in cache (TTL index will auto-delete after 24h)
  await PriceCache.findOneAndUpdate(
    { identifier: coinId, source: 'coingecko' },
    { fetchedValue: price, currency: 'USD', fetchedAt: new Date() },
    { upsert: true }
  );

  return price;
}

// GET /api/crypto/prices?ids=bitcoin,ethereum,solana
router.get('/prices', async (req: AuthRequest, res: Response) => {
  try {
    const ids = ((req.query.ids as string) || '').split(',').filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: 'ids query param required' });

    const prices: Record<string, number> = {};
    await Promise.all(
      ids.map(async (id) => {
        try {
          prices[id] = await getCoinPrice(id);
        } catch {
          prices[id] = 0;
        }
      })
    );

    res.json({ prices });
  } catch {
    res.status(500).json({ error: 'Failed to fetch crypto prices' });
  }
});

// GET /api/crypto/search?q=bitcoin — search CoinGecko coin list
router.get('/search', async (_req: AuthRequest, res: Response) => {
  try {
    const q = (_req.query.q as string) || '';
    const apiRes = await axios.get(`${COINGECKO_BASE}/search`, {
      params: { query: q },
      timeout: 5000,
    });
    const coins = apiRes.data.coins.slice(0, 10).map((c: any) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      thumb: c.thumb,
    }));
    res.json({ coins });
  } catch {
    res.status(500).json({ error: 'Failed to search coins' });
  }
});

// POST /api/crypto/add — add crypto asset (price auto-fetched)
router.post('/add', async (req: AuthRequest, res: Response) => {
  try {
    const { coinId, name, quantity } = req.body;
    if (!coinId || !quantity) return res.status(400).json({ error: 'coinId and quantity required' });

    const price = await getCoinPrice(coinId);
    const value = price * quantity;

    const asset = await Asset.findOneAndUpdate(
      { userId: req.user!.id, coinGeckoId: coinId },
      {
        userId: req.user!.id,
        name: name || coinId,
        type: 'crypto',
        value,
        currency: 'USD',
        source: 'coingecko',
        coinGeckoId: coinId,
        quantity,
        lastUpdated: new Date(),
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ asset, price, value });
  } catch {
    res.status(500).json({ error: 'Failed to add crypto asset' });
  }
});

// POST /api/crypto/sync — refresh all crypto asset prices
export async function syncCryptoAssets(userId: string): Promise<void> {
  const cryptoAssets = await Asset.find({ userId, source: 'coingecko', coinGeckoId: { $exists: true } });

  for (const asset of cryptoAssets) {
    try {
      const price = await getCoinPrice(asset.coinGeckoId!);
      asset.value = price * (asset.quantity || 1);
      asset.lastUpdated = new Date();
      await asset.save();
    } catch (err) {
      console.error(`Failed to sync crypto ${asset.coinGeckoId}:`, err);
    }
  }
}

router.post('/sync', async (req: AuthRequest, res: Response) => {
  try {
    await syncCryptoAssets(req.user!.id);
    res.json({ message: 'Crypto assets synced' });
  } catch {
    res.status(500).json({ error: 'Failed to sync crypto assets' });
  }
});

export default router;
