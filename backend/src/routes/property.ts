import { Router, Response } from 'express';
import axios from 'axios';
import { Asset, PriceCache } from '../models';
import { authenticate, AuthRequest } from '../middleware/authenticate';

const router = Router();
router.use(authenticate);

const ATTOM_BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

// GET /api/property/estimate?address=123+Main+St&zip=90210
router.get('/estimate', async (req: AuthRequest, res: Response) => {
  try {
    const { address, zip } = req.query;
    if (!address || !zip) return res.status(400).json({ error: 'address and zip required' });

    const cacheKey = `${address}-${zip}`;

    // Check cache
    const cached = await PriceCache.findOne({ identifier: cacheKey, source: 'attom' });
    if (cached) {
      return res.json({ estimatedValue: cached.fetchedValue, cached: true });
    }

    const response = await axios.get(`${ATTOM_BASE}/property/expandedprofile`, {
      params: { address1: address, address2: zip },
      headers: { apikey: process.env.ATTOM_API_KEY || '', Accept: 'application/json' },
      timeout: 10000,
    });

    const property = response.data?.property?.[0];
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const estimatedValue =
      property.avm?.amount?.value ||
      property.assessment?.assessed?.assdTtlValue ||
      null;

    if (!estimatedValue) {
      return res.status(404).json({ error: 'No estimate available for this address' });
    }

    // Cache the result
    await PriceCache.findOneAndUpdate(
      { identifier: cacheKey, source: 'attom' },
      { fetchedValue: estimatedValue, currency: 'USD', fetchedAt: new Date() },
      { upsert: true }
    );

    res.json({
      estimatedValue,
      address: property.address?.oneLine,
      bedrooms: property.building?.rooms?.beds,
      bathrooms: property.building?.rooms?.bathsFull,
      sqft: property.building?.size?.livingSize,
      yearBuilt: property.summary?.yearBuilt,
      cached: false,
    });
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404) return res.status(404).json({ error: 'Property not found' });
    if (status === 403) return res.status(403).json({ error: 'ATTOM API key invalid or expired' });
    res.status(500).json({ error: 'Failed to fetch property estimate' });
  }
});

// POST /api/property/add — add real estate asset with ATTOM valuation
router.post('/add', async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, zip, manualValue } = req.body;
    if (!name || !address) return res.status(400).json({ error: 'name and address required' });

    let value = manualValue || 0;

    if (zip && process.env.ATTOM_API_KEY) {
      try {
        const cacheKey = `${address}-${zip}`;
        const cached = await PriceCache.findOne({ identifier: cacheKey, source: 'attom' });
        if (cached) {
          value = cached.fetchedValue;
        } else {
          const response = await axios.get(`${ATTOM_BASE}/property/expandedprofile`, {
            params: { address1: address, address2: zip },
            headers: { apikey: process.env.ATTOM_API_KEY, Accept: 'application/json' },
            timeout: 10000,
          });
          const property = response.data?.property?.[0];
          const estValue = property?.avm?.amount?.value;
          if (estValue) {
            value = estValue;
            await PriceCache.findOneAndUpdate(
              { identifier: cacheKey, source: 'attom' },
              { fetchedValue: estValue, currency: 'USD', fetchedAt: new Date() },
              { upsert: true }
            );
          }
        }
      } catch {
        // Fall back to manual value
      }
    }

    const asset = await Asset.create({
      userId: req.user!.id,
      name,
      type: 'real_estate',
      value,
      currency: 'USD',
      source: 'attom',
      address: `${address}, ${zip}`,
      lastUpdated: new Date(),
    });

    res.status(201).json({ asset });
  } catch {
    res.status(500).json({ error: 'Failed to add property' });
  }
});

export default router;
