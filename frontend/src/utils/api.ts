import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // send httpOnly cookie
});

// Intercept 401 responses — redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (email: string, password: string, displayName?: string) =>
    api.post('/auth/register', { email, password, displayName }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (data: { displayName?: string; currency?: string }) =>
    api.patch('/auth/me', data),
};

// ── Assets ────────────────────────────────────────────────────────────────────
export const assetsApi = {
  list: () => api.get('/assets'),
  summary: () => api.get('/assets/summary'),
  create: (data: object) => api.post('/assets', data),
  update: (id: string, data: object) => api.patch(`/assets/${id}`, data),
  delete: (id: string) => api.delete(`/assets/${id}`),
};

// ── Liabilities ───────────────────────────────────────────────────────────────
export const liabilitiesApi = {
  list: () => api.get('/liabilities'),
  create: (data: object) => api.post('/liabilities', data),
  update: (id: string, data: object) => api.patch(`/liabilities/${id}`, data),
  delete: (id: string) => api.delete(`/liabilities/${id}`),
};

// ── Snapshots ─────────────────────────────────────────────────────────────────
export const snapshotsApi = {
  list: (range: string) => api.get(`/snapshots?range=${range}`),
  latest: () => api.get('/snapshots/latest'),
  refresh: () => api.post('/snapshots/refresh'),
};

// ── Plaid ─────────────────────────────────────────────────────────────────────
export const plaidApi = {
  createLinkToken: () => api.post('/plaid/create-link-token'),
  exchangeToken: (publicToken: string) => api.post('/plaid/exchange-token', { publicToken }),
  sync: () => api.post('/plaid/sync'),
};

// ── Crypto ────────────────────────────────────────────────────────────────────
export const cryptoApi = {
  prices: (ids: string[]) => api.get(`/crypto/prices?ids=${ids.join(',')}`),
  search: (q: string) => api.get(`/crypto/search?q=${q}`),
  add: (coinId: string, name: string, quantity: number) =>
    api.post('/crypto/add', { coinId, name, quantity }),
  sync: () => api.post('/crypto/sync'),
};

// ── Property ──────────────────────────────────────────────────────────────────
export const propertyApi = {
  estimate: (address: string, zip: string) =>
    api.get(`/property/estimate?address=${encodeURIComponent(address)}&zip=${zip}`),
  add: (data: object) => api.post('/property/add', data),
};

// ── Upload ────────────────────────────────────────────────────────────────────
export const uploadApi = {
  avatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.post('/upload/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
