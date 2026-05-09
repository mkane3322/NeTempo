import React, { useState } from 'react';
import { assetsApi, cryptoApi, propertyApi } from '../utils/api';
import { AssetType } from '../types';

interface Props { onClose: () => void; onAdded: () => void; }

const TYPES: { value: AssetType; label: string; icon: string }[] = [
  { value: 'bank', label: 'Bank account', icon: 'ti-building-bank' },
  { value: 'investment', label: 'Investment', icon: 'ti-chart-candle' },
  { value: 'crypto', label: 'Crypto', icon: 'ti-currency-bitcoin' },
  { value: 'real_estate', label: 'Real estate', icon: 'ti-home' },
  { value: 'vehicle', label: 'Vehicle', icon: 'ti-car' },
  { value: 'other', label: 'Other', icon: 'ti-circle-dot' },
];

export default function AddAssetModal({ onClose, onAdded }: Props) {
  const [type, setType] = useState<AssetType>('bank');
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [coinId, setCoinId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [address, setAddress] = useState('');
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (type === 'crypto') {
        await cryptoApi.add(coinId, name, parseFloat(quantity));
      } else if (type === 'real_estate') {
        await propertyApi.add({ name, address, zip, manualValue: parseFloat(value) || 0 });
      } else {
        await assetsApi.create({ name, type, value: parseFloat(value), currency, source: 'manual' });
      }
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div className="modal-title">Add asset</div>
          <button onClick={onClose} className="btn btn-sm"><i className="ti ti-x" /></button>
        </div>
        {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Asset type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setType(t.value)}
                  style={{
                    padding: '8px 6px', borderRadius: 6, border: `1px solid ${type === t.value ? 'var(--nt-green)' : 'var(--nt-border)'}`,
                    background: type === t.value ? 'rgba(0,212,160,.08)' : 'var(--nt-surface2)',
                    color: type === t.value ? 'var(--nt-green)' : 'var(--nt-muted)',
                    fontSize: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                  <i className={`ti ${t.icon}`} style={{ fontSize: 18 }} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Chase Savings" />
          </div>
          {type === 'crypto' ? (
            <>
              <div className="form-group">
                <label>CoinGecko ID</label>
                <input value={coinId} onChange={e => setCoinId(e.target.value)} required placeholder="e.g. bitcoin, ethereum, solana" />
              </div>
              <div className="form-group">
                <label>Quantity held</label>
                <input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} required placeholder="0.5" />
              </div>
            </>
          ) : type === 'real_estate' ? (
            <>
              <div className="form-group">
                <label>Street address</label>
                <input value={address} onChange={e => setAddress(e.target.value)} required placeholder="123 Main St" />
              </div>
              <div className="form-group">
                <label>ZIP code</label>
                <input value={zip} onChange={e => setZip(e.target.value)} placeholder="90210 (for ATTOM estimate)" />
              </div>
              <div className="form-group">
                <label>Manual value (fallback)</label>
                <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="500000" />
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
              <div className="form-group">
                <label>Current value</label>
                <input type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} required placeholder="10000" />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)}>
                  {['USD','EUR','GBP','CAD','AUD','JPY'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding…' : 'Add asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
