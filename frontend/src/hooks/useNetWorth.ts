import { useState, useEffect } from 'react';
import { assetsApi, liabilitiesApi, snapshotsApi } from '../utils/api';
import { Asset, Liability, Snapshot } from '../types';

export interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  debtRatio: number;
  assets: Asset[];
  liabilities: Liability[];
  snapshots: Snapshot[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useNetWorth(range = '90d'): NetWorthSummary {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const [aRes, lRes, sRes] = await Promise.all([
        assetsApi.list(),
        liabilitiesApi.list(),
        snapshotsApi.list(range),
      ]);
      setAssets(aRes.data.assets);
      setLiabilities(lRes.data.liabilities);
      setSnapshots(sRes.data.snapshots);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [range]);

  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  return { totalAssets, totalLiabilities, netWorth, debtRatio, assets, liabilities, snapshots, loading, error, refresh: fetch };
}
