import React, { useState } from 'react';
import { liabilitiesApi } from '../utils/api';
import { LiabilityType } from '../types';

interface Props { onClose: () => void; onAdded: () => void; }

const TYPES: { value: LiabilityType; label: string }[] = [
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'auto_loan', label: 'Auto loan' },
  { value: 'student_loan', label: 'Student loan' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'personal_loan', label: 'Personal loan' },
  { value: 'other', label: 'Other' },
];

export default function AddLiabilityModal({ onClose, onAdded }: Props) {
  const [type, setType] = useState<LiabilityType>('credit_card');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [minimumPayment, setMinimumPayment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await liabilitiesApi.create({
        name, type,
        balance: parseFloat(balance),
        interestRate: interestRate ? parseFloat(interestRate) / 100 : undefined,
        minimumPayment: minimumPayment ? parseFloat(minimumPayment) : undefined,
      });
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add liability');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div className="modal-title">Add liability</div>
          <button onClick={onClose} className="btn btn-sm"><i className="ti ti-x" /></button>
        </div>
        {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Type</label>
            <select value={type} onChange={e => setType(e.target.value as LiabilityType)}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Chase Sapphire" />
          </div>
          <div className="form-group">
            <label>Current balance</label>
            <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} required placeholder="5000" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="form-group">
              <label>APR (%)</label>
              <input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="19.99" />
            </div>
            <div className="form-group">
              <label>Min. payment</label>
              <input type="number" step="0.01" value={minimumPayment} onChange={e => setMinimumPayment(e.target.value)} placeholder="25" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding…' : 'Add liability'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
