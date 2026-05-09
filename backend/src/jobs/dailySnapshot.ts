import cron from 'node-cron';
import mongoose from 'mongoose';
import { User, Asset, Liability, Snapshot, ISnapshot } from '../models';
import { syncPlaidBalances } from '../routes/plaid';
import { syncCryptoAssets } from '../routes/crypto';

/**
 * Build a net worth snapshot for a single user.
 * Used by both the cron job and the manual /snapshots/refresh endpoint.
 */
export async function buildSnapshot(userId: string): Promise<ISnapshot> {
  // 1. Sync live data sources
  try {
    const user = await User.findById(userId);
    if (user?.plaidAccessTokens?.length) {
      await syncPlaidBalances(userId, user.plaidAccessTokens);
    }
    await syncCryptoAssets(userId);
  } catch (err) {
    console.error(`[Snapshot] Data sync warning for user ${userId}:`, err);
    // Continue with existing values if sync fails
  }

  // 2. Aggregate assets by type
  const assetAgg = await Asset.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: '$type', total: { $sum: '$value' } } },
  ]);

  const breakdown = {
    bank: 0,
    investment: 0,
    crypto: 0,
    real_estate: 0,
    vehicle: 0,
    other: 0,
  };
  let totalAssets = 0;

  for (const { _id, total } of assetAgg) {
    if (_id in breakdown) {
      (breakdown as Record<string, number>)[_id] = total;
    }
    totalAssets += total;
  }

  // 3. Sum liabilities
  const liabilityAgg = await Liability.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: '$balance' } } },
  ]);
  const totalLiabilities = liabilityAgg[0]?.total || 0;

  // 4. Upsert today's snapshot (idempotent — safe to run multiple times per day)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const snapshot = await Snapshot.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId), date: today },
    {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      breakdown,
      date: today,
    },
    { upsert: true, new: true }
  );

  return snapshot;
}

/**
 * Schedules the daily snapshot job.
 * Runs every day at 00:05 UTC (5 min buffer for DB availability).
 *
 * node-cron syntax: second(opt) minute hour day month weekday
 */
export function startDailySnapshotJob(): void {
  cron.schedule('5 0 * * *', async () => {
    console.log('[Cron] Starting daily net worth snapshot job...');

    try {
      const users = await User.find({}, '_id').lean();
      let success = 0;
      let failed = 0;

      for (const user of users) {
        try {
          await buildSnapshot(user._id.toString());
          success++;
        } catch (err) {
          console.error(`[Cron] Snapshot failed for user ${user._id}:`, err);
          failed++;
        }
      }

      console.log(`[Cron] Snapshot complete — ${success} succeeded, ${failed} failed`);
    } catch (err) {
      console.error('[Cron] Fatal snapshot job error:', err);
    }
  });

  console.log('⏰ Daily snapshot cron job scheduled (00:05 UTC)');
}
