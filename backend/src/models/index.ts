import mongoose, { Schema, Document, Model } from 'mongoose';

// ── User ──────────────────────────────────────────────────────────────────────
export interface IUser extends Document {
  email: string;
  passwordHash: string;
  displayName?: string;
  avatarUrl?: string;
  currency: string;
  plaidAccessTokens: string[];
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, trim: true },
    avatarUrl: { type: String },
    currency: { type: String, default: 'USD' },
    plaidAccessTokens: [{ type: String }],
  },
  { timestamps: true }
);

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

// ── Asset ─────────────────────────────────────────────────────────────────────
export type AssetType = 'bank' | 'investment' | 'crypto' | 'real_estate' | 'vehicle' | 'other';
export type AssetSource = 'plaid' | 'coingecko' | 'attom' | 'manual';

export interface IAsset extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  type: AssetType;
  value: number;
  currency: string;
  source: AssetSource;
  // source-specific identifiers
  plaidAccountId?: string;
  coinGeckoId?: string;    // e.g. "bitcoin", "ethereum"
  attomPropertyId?: string;
  address?: string;        // for real estate
  quantity?: number;       // for crypto (e.g. 0.5 BTC)
  lastUpdated: Date;
}

const assetSchema = new Schema<IAsset>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['bank', 'investment', 'crypto', 'real_estate', 'vehicle', 'other'],
      required: true,
    },
    value: { type: Number, required: true, default: 0 },
    currency: { type: String, default: 'USD' },
    source: {
      type: String,
      enum: ['plaid', 'coingecko', 'attom', 'manual'],
      required: true,
    },
    plaidAccountId: { type: String },
    coinGeckoId: { type: String },
    attomPropertyId: { type: String },
    address: { type: String },
    quantity: { type: Number },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Asset: Model<IAsset> = mongoose.models.Asset || mongoose.model<IAsset>('Asset', assetSchema);

// ── Liability ─────────────────────────────────────────────────────────────────
export type LiabilityType = 'mortgage' | 'auto_loan' | 'student_loan' | 'credit_card' | 'personal_loan' | 'other';

export interface ILiability extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  type: LiabilityType;
  balance: number;
  currency: string;
  interestRate?: number; // APR as decimal, e.g. 0.065 for 6.5%
  minimumPayment?: number;
  dueDate?: number; // day of month, 1-31
  lastUpdated: Date;
}

const liabilitySchema = new Schema<ILiability>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['mortgage', 'auto_loan', 'student_loan', 'credit_card', 'personal_loan', 'other'],
      required: true,
    },
    balance: { type: Number, required: true, default: 0 },
    currency: { type: String, default: 'USD' },
    interestRate: { type: Number },
    minimumPayment: { type: Number },
    dueDate: { type: Number, min: 1, max: 31 },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Liability: Model<ILiability> =
  mongoose.models.Liability || mongoose.model<ILiability>('Liability', liabilitySchema);

// ── Snapshot ──────────────────────────────────────────────────────────────────
// One document per user per day — powers the D3 timeline chart
export interface ISnapshot extends Document {
  userId: mongoose.Types.ObjectId;
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
  date: Date;
}

const snapshotSchema = new Schema<ISnapshot>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  totalAssets: { type: Number, required: true },
  totalLiabilities: { type: Number, required: true },
  netWorth: { type: Number, required: true },
  breakdown: {
    bank: { type: Number, default: 0 },
    investment: { type: Number, default: 0 },
    crypto: { type: Number, default: 0 },
    real_estate: { type: Number, default: 0 },
    vehicle: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },
  date: { type: Date, required: true },
});

// Compound unique index: one snapshot per user per day
snapshotSchema.index({ userId: 1, date: 1 }, { unique: true });

export const Snapshot: Model<ISnapshot> =
  mongoose.models.Snapshot || mongoose.model<ISnapshot>('Snapshot', snapshotSchema);

// ── PriceCache ────────────────────────────────────────────────────────────────
// TTL index auto-expires documents after 24 hours — no cleanup job needed.
// This is a MongoDB strength: the storage engine handles it natively.
export interface IPriceCache extends Document {
  identifier: string;  // coin id, account id, property id
  source: 'coingecko' | 'attom' | 'exchangerate' | 'plaid';
  fetchedValue: number;
  currency: string;
  fetchedAt: Date;
}

const priceCacheSchema = new Schema<IPriceCache>({
  identifier: { type: String, required: true },
  source: {
    type: String,
    enum: ['coingecko', 'attom', 'exchangerate', 'plaid'],
    required: true,
  },
  fetchedValue: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  fetchedAt: { type: Date, default: Date.now },
});

// Compound index for lookups
priceCacheSchema.index({ identifier: 1, source: 1 }, { unique: true });

// ★ TTL index — MongoDB automatically deletes documents 24 hours after fetchedAt
// This is more elegant than a SQL cleanup job and worth highlighting in interviews
priceCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 86400 });

export const PriceCache: Model<IPriceCache> =
  mongoose.models.PriceCache || mongoose.model<IPriceCache>('PriceCache', priceCacheSchema);
