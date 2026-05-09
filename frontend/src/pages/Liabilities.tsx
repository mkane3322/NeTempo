import React, { useState } from 'react';
import { useNetWorth } from '../hooks/useNetWorth';
import { liabilitiesApi, formatCurrency } from '../utils/api';
import AddLiabilityModal from '../components/AddLiabilityModal';
import { Liability } from '../types';

const TYPE_ICONS: Record<string, string> = {
  mortgage:'ti-home', auto_loan:'ti-car', student_loan:'ti-school',
  credit_card:'ti-credit-card', personal_loan:'ti-cash', other:'ti-receipt',
};

export default function Liabilities() {
  const { liabilities, totalLiabilities, loading, refresh } = useNetWorth();
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this liability?')) return;
    setDeleting(id);
    try { await liabilitiesApi.delete(id); await refresh(); }
    finally { setDeleting(null); }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Liabilities</div>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <i className="ti ti-plus" aria-hidden="true" /> Add liability
          </button>
        </div>
      </div>
      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <div className="card-title"><i className="ti ti-receipt" style={{color:'var(--nt-red)'}} /> All liabilities</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--nt-red)'}}>{formatCurrency(totalLiabilities)} total debt</div>
          </div>
          {loading ? <div style={{padding:40,textAlign:'center',color:'var(--nt-muted)',fontFamily:'var(--font-mono)'}}>Loading…</div>
          : liabilities.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><i className="ti ti-circle-check" /></div>
              <h3>No liabilities</h3>
              <p>Add debts like mortgages, credit cards, or student loans to track your full net worth.</p>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {liabilities.map((l: Liability) => (
                <div key={l._id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'var(--nt-surface2)',borderRadius:8,border:'1px solid var(--nt-border)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:36,height:36,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,84,112,0.1)'}}>
                      <i className={`ti ${TYPE_ICONS[l.type] || 'ti-receipt'}`} style={{color:'var(--nt-red)',fontSize:17}} />
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:500}}>{l.name}</div>
                      <div style={{fontSize:11,color:'var(--nt-muted)',fontFamily:'var(--font-mono)'}}>
                        {l.type.replace('_',' ')}
                        {l.interestRate ? ` · ${(l.interestRate*100).toFixed(2)}% APR` : ''}
                        {l.minimumPayment ? ` · $${l.minimumPayment}/mo min` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:16}}>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:15,fontWeight:500,fontFamily:'var(--font-mono)',color:'var(--nt-red)'}}>{formatCurrency(l.balance)}</div>
                      <div style={{fontSize:11,color:'var(--nt-muted)'}}>{totalLiabilities > 0 ? Math.round((l.balance/totalLiabilities)*100) : 0}% of debt</div>
                    </div>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(l._id)} disabled={deleting === l._id}>
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {showModal && <AddLiabilityModal onClose={() => setShowModal(false)} onAdded={refresh} />}
    </>
  );
}
