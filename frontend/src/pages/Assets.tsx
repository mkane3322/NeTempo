import React, { useState } from 'react';
import { useNetWorth } from '../hooks/useNetWorth';
import { assetsApi, formatCurrency } from '../utils/api';
import AddAssetModal from '../components/AddAssetModal';
import ConnectBankButton from '../components/ConnectBankButton';
import { Asset } from '../types';

const TYPE_COLORS: Record<string, string> = {
  bank:'#3d8ef8', investment:'#9b6dff', crypto:'#f5a623',
  real_estate:'#20c4c8', vehicle:'#00d4a0', other:'#6b7fa0',
};
const TYPE_ICONS: Record<string, string> = {
  bank:'ti-building-bank', investment:'ti-chart-candle', crypto:'ti-currency-bitcoin',
  real_estate:'ti-home', vehicle:'ti-car', other:'ti-circle-dot',
};

export default function Assets() {
  const { assets, totalAssets, loading, refresh } = useNetWorth();
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this asset?')) return;
    setDeleting(id);
    try { await assetsApi.delete(id); await refresh(); }
    finally { setDeleting(null); }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Assets</div>
        <div className="topbar-actions">
          <ConnectBankButton onConnected={refresh} />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <i className="ti ti-plus" aria-hidden="true" /> Add asset
          </button>
        </div>
      </div>
      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <div className="card-title"><i className="ti ti-wallet" style={{color:'var(--nt-green)'}} /> All assets</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--nt-muted)'}}>{formatCurrency(totalAssets)} total</div>
          </div>
          {loading ? <div style={{padding:40,textAlign:'center',color:'var(--nt-muted)',fontFamily:'var(--font-mono)'}}>Loading…</div>
          : assets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><i className="ti ti-wallet" /></div>
              <h3>No assets yet</h3>
              <p>Connect a bank account with Plaid or add assets manually.</p>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {assets.map((a: Asset) => (
                <div key={a._id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'var(--nt-surface2)',borderRadius:8,border:'1px solid var(--nt-border)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:36,height:36,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:`${TYPE_COLORS[a.type]}18`}}>
                      <i className={`ti ${TYPE_ICONS[a.type]}`} style={{color:TYPE_COLORS[a.type],fontSize:17}} />
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:500}}>{a.name}</div>
                      <div style={{fontSize:11,color:'var(--nt-muted)',fontFamily:'var(--font-mono)'}}>
                        {a.type.replace('_',' ')} · {a.source} · updated {new Date(a.lastUpdated).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:16}}>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:15,fontWeight:500,fontFamily:'var(--font-mono)'}}>{formatCurrency(a.value)}</div>
                      <div style={{fontSize:11,color:'var(--nt-muted)'}}>{totalAssets > 0 ? Math.round((a.value/totalAssets)*100) : 0}% of assets</div>
                    </div>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a._id)} disabled={deleting === a._id}>
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {showModal && <AddAssetModal onClose={() => setShowModal(false)} onAdded={refresh} />}
    </>
  );
}
