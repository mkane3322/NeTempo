import React, { useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { plaidApi } from '../utils/api';

interface Props { onConnected: () => void; className?: string; }

export default function ConnectBankButton({ onConnected, className = 'btn btn-primary' }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { open, ready } = usePlaidLink({
    token: linkToken || '',
    onSuccess: async (publicToken) => {
      setLoading(true);
      try {
        await plaidApi.exchangeToken(publicToken);
        onConnected();
      } finally {
        setLoading(false);
        setLinkToken(null);
      }
    },
    onExit: () => setLinkToken(null),
  });

  useEffect(() => { if (linkToken && ready) open(); }, [linkToken, ready]);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await plaidApi.createLinkToken();
      setLinkToken(res.data.linkToken);
    } catch {
      setLoading(false);
    }
  };

  return (
    <button className={className} onClick={handleClick} disabled={loading}>
      <i className="ti ti-building-bank" aria-hidden="true" />
      {loading ? 'Connecting…' : 'Connect bank'}
    </button>
  );
}
