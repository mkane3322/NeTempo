import React, { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authApi, uploadApi } from '../utils/api';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [currency, setCurrency] = useState(user?.currency || 'USD');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.updateProfile({ displayName, currency });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadApi.avatar(file);
      await refreshUser();
    } finally {
      setUploading(false);
    }
  };

  const initials = user?.displayName?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || user?.email?.[0].toUpperCase() || '?';

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Settings</div>
      </div>
      <div className="page-content" style={{maxWidth:520}}>
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header">
            <div className="card-title"><i className="ti ti-user" style={{color:'var(--nt-green)'}} /> Profile</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24}}>
            <div style={{position:'relative'}}>
              <div className="user-avatar" style={{width:64,height:64,fontSize:22}}>
                {user?.avatarUrl ? <img src={user.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} /> : initials}
              </div>
              <button onClick={() => fileRef.current?.click()}
                style={{position:'absolute',bottom:-4,right:-4,width:24,height:24,borderRadius:'50%',background:'var(--nt-green)',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#000'}}>
                <i className="ti ti-camera" style={{fontSize:13}} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarChange} />
            </div>
            <div>
              <div style={{fontWeight:500,fontSize:15}}>{user?.displayName || 'No name set'}</div>
              <div style={{fontSize:13,color:'var(--nt-muted)'}}>{user?.email}</div>
              {uploading && <div style={{fontSize:12,color:'var(--nt-green)',fontFamily:'var(--font-mono)',marginTop:4}}>Uploading…</div>}
            </div>
          </div>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Display name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Jordan" />
            </div>
            <div className="form-group">
              <label>Preferred currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}>
                {['USD','EUR','GBP','CAD','AUD','JPY','CHF','CNY'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saved ? <><i className="ti ti-check" /> Saved</> : saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title"><i className="ti ti-info-circle" style={{color:'var(--nt-muted)'}} /> API integrations</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[
              { name:'Plaid', desc:'Bank & investment accounts', status:'configured', color:'var(--nt-green)' },
              { name:'CoinGecko', desc:'Crypto prices (free, no key)', status:'active', color:'var(--nt-green)' },
              { name:'ATTOM Data', desc:'Property valuations', status:'requires key', color:'var(--nt-amber)' },
              { name:'Exchangerate.host', desc:'Currency conversion (free)', status:'active', color:'var(--nt-green)' },
              { name:'Cloudinary', desc:'Avatar uploads', status:'configured', color:'var(--nt-green)' },
            ].map(api => (
              <div key={api.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'0.5px solid var(--nt-border)'}}>
                <div>
                  <div style={{fontSize:14,fontWeight:500}}>{api.name}</div>
                  <div style={{fontSize:12,color:'var(--nt-muted)'}}>{api.desc}</div>
                </div>
                <span style={{fontSize:11,fontFamily:'var(--font-mono)',color:api.color,background:`${api.color}18`,padding:'2px 8px',borderRadius:4}}>{api.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
