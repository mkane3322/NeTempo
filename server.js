require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const axios = require("axios");
const cron = require("node-cron");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    displayName: String,
  },
  { timestamps: true },
);
const assetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ["bank", "investment", "crypto", "real_estate", "vehicle", "other"],
    required: true,
  },
  value: { type: Number, default: 0 },
  currency: { type: String, default: "USD" },
  source: {
    type: String,
    enum: ["manual", "coingecko", "plaid", "attom"],
    default: "manual",
  },
  coinGeckoId: String,
  quantity: Number,
  lastUpdated: { type: Date, default: Date.now },
});
const liabilitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "mortgage",
        "auto_loan",
        "student_loan",
        "credit_card",
        "personal_loan",
        "other",
      ],
      required: true,
    },
    balance: { type: Number, default: 0 },
    interestRate: Number,
  },
  { timestamps: true },
);
const snapshotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  totalAssets: Number,
  totalLiabilities: Number,
  netWorth: Number,
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
snapshotSchema.index({ userId: 1, date: 1 }, { unique: true });
const priceCacheSchema = new mongoose.Schema({
  identifier: { type: String, required: true, unique: true },
  price: Number,
  fetchedAt: { type: Date, default: Date.now },
});
priceCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 86400 }); // TTL — auto-deletes after 24h
const User = mongoose.model("User", userSchema);
const Asset = mongoose.model("Asset", assetSchema);
const Liability = mongoose.model("Liability", liabilitySchema);
const Snapshot = mongoose.model("Snapshot", snapshotSchema);
const PriceCache = mongoose.model("PriceCache", priceCacheSchema);
function auth(req, res, next) {
  const token =
    req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
function signToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
}
const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });
    if (password.length < 8)
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ error: "Email already registered" });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash, displayName });
    res.cookie("token", signToken(user), COOKIE);
    res
      .status(201)
      .json({
        user: {
          id: user._id,
          email: user.email,
          displayName: user.displayName,
        },
      });
  } catch (e) {
    res.status(500).json({ error: "Registration failed" });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.cookie("token", signToken(user), COOKIE);
    res.json({
      user: { id: user._id, email: user.email, displayName: user.displayName },
    });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});
app.get("/api/auth/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("-passwordHash");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});
app.get("/api/assets", auth, async (req, res) => {
  const assets = await Asset.find({ userId: req.user.id }).sort({ value: -1 });
  res.json({ assets });
});
app.post("/api/assets", auth, async (req, res) => {
  try {
    const asset = await Asset.create({
      ...req.body,
      userId: req.user.id,
      lastUpdated: new Date(),
    });
    res.status(201).json({ asset });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
app.patch("/api/assets/:id", auth, async (req, res) => {
  const asset = await Asset.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { ...req.body, lastUpdated: new Date() },
    { new: true },
  );
  if (!asset) return res.status(404).json({ error: "Not found" });
  res.json({ asset });
});
app.delete("/api/assets/:id", auth, async (req, res) => {
  await Asset.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.json({ message: "Deleted" });
});
app.get("/api/liabilities", auth, async (req, res) => {
  const liabilities = await Liability.find({ userId: req.user.id }).sort({
    balance: -1,
  });
  res.json({ liabilities });
});
app.post("/api/liabilities", auth, async (req, res) => {
  try {
    const liability = await Liability.create({
      ...req.body,
      userId: req.user.id,
    });
    res.status(201).json({ liability });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
app.patch("/api/liabilities/:id", auth, async (req, res) => {
  const liability = await Liability.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    req.body,
    { new: true },
  );
  if (!liability) return res.status(404).json({ error: "Not found" });
  res.json({ liability });
});
app.delete("/api/liabilities/:id", auth, async (req, res) => {
  await Liability.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.json({ message: "Deleted" });
});
async function buildSnapshot(userId) {
  const assets = await Asset.find({ userId });
  const liabilities = await Liability.find({ userId });
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
  const breakdown = {
    bank: 0,
    investment: 0,
    crypto: 0,
    real_estate: 0,
    vehicle: 0,
    other: 0,
  };
  for (const a of assets)
    breakdown[a.type] = (breakdown[a.type] || 0) + a.value;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Snapshot.findOneAndUpdate(
    { userId, date: today },
    {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      breakdown,
      date: today,
    },
    { upsert: true, new: true },
  );
}
app.get("/api/snapshots", auth, async (req, res) => {
  const days = { "30d": 30, "90d": 90, "1y": 365 }[req.query.range] || 90;
  const since = new Date(Date.now() - days * 86400000);
  const snapshots = await Snapshot.find({
    userId: req.user.id,
    date: { $gte: since },
  }).sort({ date: 1 });
  res.json({ snapshots });
});
app.post("/api/snapshots/refresh", auth, async (req, res) => {
  try {
    const snapshot = await buildSnapshot(req.user.id);
    res.json({ snapshot });
  } catch (e) {
    res.status(500).json({ error: "Snapshot failed" });
  }
});
app.get("/api/crypto/price/:coinId", auth, async (req, res) => {
  try {
    const { coinId } = req.params;
    const cached = await PriceCache.findOne({ identifier: coinId });
    if (cached) return res.json({ price: cached.price, cached: true });
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price`,
      {
        params: { ids: coinId, vs_currencies: "usd" },
        timeout: 5000,
      },
    );
    const price = response.data[coinId]?.usd;
    if (!price) return res.status(404).json({ error: "Coin not found" });
    await PriceCache.findOneAndUpdate(
      { identifier: coinId },
      { price, fetchedAt: new Date() },
      { upsert: true },
    );
    res.json({ price, cached: false });
  } catch {
    res.status(500).json({ error: "Failed to fetch price" });
  }
});
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
cron.schedule("5 0 * * *", async () => {
  console.log("[Cron] Running daily snapshots...");
  const users = await User.find({}, "_id");
  for (const u of users) {
    try {
      await buildSnapshot(u._id.toString());
    } catch (e) {
      console.error(e);
    }
  }
  console.log(`[Cron] Done — ${users.length} users`);
});
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/netempo")
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () =>
      console.log(`🚀 NeTempo running at http://localhost:${PORT}`),
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB error:", err);
    process.exit(1);
  });
