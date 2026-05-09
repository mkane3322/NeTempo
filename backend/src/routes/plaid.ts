import { Router, Response } from 'express';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';
import { User, Asset } from '../models';
import { authenticate, AuthRequest } from '../middleware/authenticate';

const router = Router();
router.use(authenticate);

function getPlaidClient() {
  const config = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
        'PLAID-SECRET': process.env.PLAID_SECRET || '',
      },
    },
  });
  return new PlaidApi(config);
}

// POST /api/plaid/create-link-token
// Called when user clicks "Connect Bank" — returns a token for Plaid Link UI
router.post('/create-link-token', async (req: AuthRequest, res: Response) => {
  try {
    const client = getPlaidClient();
    const response = await client.linkTokenCreate({
      user: { client_user_id: req.user!.id },
      client_name: 'NeTempo',
      products: [Products.Transactions, Products.Investments],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json({ linkToken: response.data.link_token });
  } catch (err: any) {
    console.error('Plaid link token error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create Plaid link token' });
  }
});

// POST /api/plaid/exchange-token
// Called after user completes Plaid Link — exchanges public token for access token
router.post('/exchange-token', async (req: AuthRequest, res: Response) => {
  try {
    const { publicToken } = req.body;
    if (!publicToken) return res.status(400).json({ error: 'publicToken required' });

    const client = getPlaidClient();
    const exchangeRes = await client.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = exchangeRes.data.access_token;

    // Store access token securely (in a real app, consider encrypting at rest)
    await User.findByIdAndUpdate(req.user!.id, {
      $addToSet: { plaidAccessTokens: accessToken },
    });

    // Immediately sync balances
    await syncPlaidBalances(req.user!.id, [accessToken]);

    res.json({ message: 'Bank account connected successfully' });
  } catch (err: any) {
    console.error('Plaid exchange error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to connect bank account' });
  }
});

// POST /api/plaid/sync — refresh all Plaid-sourced balances
router.post('/sync', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const count = await syncPlaidBalances(req.user!.id, user.plaidAccessTokens);
    res.json({ message: `Synced ${count} accounts` });
  } catch {
    res.status(500).json({ error: 'Failed to sync Plaid balances' });
  }
});

// Internal helper used by cron job and sync endpoint
export async function syncPlaidBalances(userId: string, accessTokens: string[]): Promise<number> {
  const client = getPlaidClient();
  let count = 0;

  for (const token of accessTokens) {
    try {
      const res = await client.accountsBalanceGet({ access_token: token });
      const accounts = res.data.accounts;

      for (const account of accounts) {
        const value = account.balances.current || account.balances.available || 0;
        const type = account.type === 'investment' ? 'investment' : 'bank';

        await Asset.findOneAndUpdate(
          { userId, plaidAccountId: account.account_id },
          {
            userId,
            name: `${account.name} (${account.mask || '****'})`,
            type,
            value,
            currency: account.balances.iso_currency_code || 'USD',
            source: 'plaid',
            plaidAccountId: account.account_id,
            lastUpdated: new Date(),
          },
          { upsert: true, new: true }
        );
        count++;
      }
    } catch (err) {
      console.error('Plaid balance sync error for token:', err);
    }
  }

  return count;
}

export default router;
