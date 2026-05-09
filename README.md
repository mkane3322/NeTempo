# NeTempo — Net Worth Timeline

A full-stack net worth tracking application that connects real bank accounts, crypto wallets, real estate, and liabilities into a single timeline dashboard.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript |
| Styling | Custom CSS (no Tailwind) |
| Charts | D3.js (timeline) + Chart.js (donut) |
| Backend | Node.js + Express + TypeScript |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcrypt |
| Scheduling | node-cron |
| File Uploads | Cloudinary |
| APIs | Plaid, CoinGecko, ATTOM, Exchangerate.host |
| Hosting | Vercel (frontend) + Railway (backend + MongoDB) |

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- API keys: Plaid, ATTOM, Cloudinary (CoinGecko and Exchangerate.host are free/no-auth)

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Fill in your environment variables
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
# Set REACT_APP_API_URL=http://localhost:5000
npm start
```

## Environment Variables

### Backend (.env)
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/netempo
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Plaid
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox  # sandbox | development | production

# ATTOM
ATTOM_API_KEY=your_attom_api_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# CoinGecko (no auth required for free tier)
# Exchangerate.host (no auth required)
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_PLAID_ENV=sandbox
```

## MongoDB Collections

- **users** — Auth credentials and profile
- **assets** — All owned assets (bank, crypto, real estate, other)
- **liabilities** — Debts and obligations
- **snapshots** — Daily net worth snapshots (inserted by cron)
- **priceCache** — TTL-indexed cache for external price data (auto-expires in 24h)

## API Integrations

### Plaid
Used to connect bank and investment accounts. Implements Link flow to get access tokens, then fetches account balances on demand.

### CoinGecko
Free crypto price API. No API key required. Fetches current prices for BTC, ETH, and any other tracked crypto assets by coin ID.

### ATTOM Data
Property value estimates by address. Used for real estate asset valuation. Requires API key (free trial available).

### Exchangerate.host
Free currency conversion. Used to normalize all asset values to USD (or user's preferred currency).

## Scheduling (node-cron)

A daily cron job runs at midnight UTC to:
1. Fetch all users' current asset values (with cache-busting)
2. Compute total assets, liabilities, and net worth
3. Insert a new snapshot document for each user

This powers the timeline chart on the dashboard.

## Key Design Decisions

### MongoDB TTL Index on priceCache
```javascript
priceCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 86400 });
```
MongoDB automatically deletes stale price documents after 24 hours — no cleanup job needed. This is more elegant than SQL and worth highlighting in interviews.

### JWT Auth Flow
1. Register/Login → server returns signed JWT
2. Client stores in httpOnly cookie (not localStorage)
3. Every API request includes the cookie automatically
4. Middleware verifies and decodes JWT, attaches `req.user`

## Deployment

### Frontend → Vercel
```bash
cd frontend
npx vercel --prod
```

### Backend + MongoDB → Railway
1. Create new Railway project
2. Add MongoDB plugin
3. Deploy backend service
4. Set environment variables in Railway dashboard
