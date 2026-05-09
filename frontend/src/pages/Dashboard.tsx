import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { assetsApi, liabilitiesApi, snapshotsApi, plaidApi, formatCurrency } from '../utils/api';
import { Asset, Liability, Snapshot } from '../types';
import { usePlaidLink } from 'react-plaid-link';

ChartJS.register(ArcElement, Tooltip, Legend);

const TYPE_COLORS: Record<string, string> = {
  bank: '#3d8ef8',
  investment: '#9b6dff',
  crypto: '#f5a623',
  real_estate: '#20c4c8',
  vehicle: '#00d4a0',
  other: '#6b7fa0',
};

const TYPE_ICONS: Record<string, string> = {
  bank: 'ti-building-bank',
  investment: 'ti-chart-candle',
  crypto: 'ti-currency-bitcoin',
  real_estate: 'ti-home',
  vehicle: 'ti-car',
  other: 'ti-circle-dot',
};

export default function Dashboard() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [range, setRange] = useState<'30d' | '90d' | '1y' | 'all'>('90d');
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (snapshots.length > 0 && svgRef.current) drawTimeline();
  }, [snapshots, range]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [aRes, lRes, sRes] = await Promise.all([
        assetsApi.list(),
        liabilitiesApi.list(),
        snapshotsApi.list(range),
      ]);
      setAssets(aRes.data.assets);
      setLiabilities(lRes.data.liabilities);
      setSnapshots(sRes.data.snapshots);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await snapshotsApi.refresh();
      await fetchAll();
    } finally {
      setSyncing(false);
    }
  }

  // Plaid Link
  async function openPlaid() {
    try {
      const res = await plaidApi.createLinkToken();
      setLinkToken(res.data.linkToken);
    } catch (err) {
      console.error('Could not get Plaid link token:', err);
    }
  }

  const { open: openLink, ready } = usePlaidLink({
    token: linkToken || '',
    onSuccess: async (publicToken) => {
      await plaidApi.exchangeToken(publicToken);
      setLinkToken(null);
      await fetchAll();
    },
    onExit: () => setLinkToken(null),
  });

  useEffect(() => {
    if (linkToken && ready) openLink();
  }, [linkToken, ready]);

  // Derived numbers
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  // Net worth change vs oldest snapshot
  const oldest = snapshots[0];
  const nwChange = oldest ? netWorth - oldest.netWorth : 0;

  // Asset breakdown for donut
  const breakdown: Record<string, number> = {};
  assets.forEach((a) => {
    breakdown[a.type] = (breakdown[a.type] || 0) + a.value;
  });

  const donutData = {
    labels: Object.keys(breakdown).map((k) => k.replace('_', ' ')),
    datasets: [{
      data: Object.values(breakdown),
      backgroundColor: Object.keys(breakdown).map((k) => TYPE_COLORS[k] || '#6b7fa0'),
      borderColor: '#111827',
      borderWidth: 3,
      hoverOffset: 4,
    }],
  };

  // D3 timeline
  function drawTimeline() {
    if (!svgRef.current || !snapshots.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const el = svgRef.current.parentElement!;
    const W = el.clientWidth;
    const H = 200;
    svgRef.current.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svgRef.current.setAttribute('width', String(W));
    svgRef.current.setAttribute('height', String(H));

    const pad = { t: 16, r: 20, b: 28, l: 64 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;

    const data = snapshots.map((s) => ({ date: new Date(s.date), nw: s.netWorth }));
    const xS = d3.scaleTime().domain(d3.extent(data, (d) => d.date) as [Date, Date]).range([0, iw]);
    const [minNW, maxNW] = d3.extent(data, (d) => d.nw) as [number, number];
    const yS = d3.scaleLinear().domain([minNW * 0.96, maxNW * 1.04]).range([ih, 0]);

    const g = svg.append('g').attr('transform', `translate(${pad.l},${pad.t})`);

    // Grid lines
    yS.ticks(4).forEach((tick) => {
      g.append('line')
        .attr('x1', 0).attr('x2', iw).attr('y1', yS(tick)).attr('y2', yS(tick))
        .attr('stroke', 'rgba(255,255,255,0.04)').attr('stroke-width', 1);
      g.append('text')
        .attr('x', -8).attr('y', yS(tick) + 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#6b7fa0').attr('font-size', 11).attr('font-family', 'DM Mono, monospace')
        .text('$' + Math.round(tick / 1000) + 'k');
    });

    // X axis labels
    xS.ticks(6).forEach((tick) => {
      g.append('text')
        .attr('x', xS(tick)).attr('y', ih + 18)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7fa0').attr('font-size', 11).attr('font-family', 'DM Mono, monospace')
        .text(d3.timeFormat(range === '1y' || range === 'all' ? '%b %y' : '%b %d')(tick));
    });

    // Area fill
    const area = d3.area<{ date: Date; nw: number }>()
      .x((d) => xS(d.date))
      .y0(ih)
      .y1((d) => yS(d.nw))
      .curve(d3.curveCatmullRom);

    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id', 'nw-grad').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#00d4a0').attr('stop-opacity', 0.2);
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#00d4a0').attr('stop-opacity', 0);

    g.append('path').datum(data).attr('d', area).attr('fill', 'url(#nw-grad)');

    // Line
    const line = d3.line<{ date: Date; nw: number }>()
      .x((d) => xS(d.date))
      .y((d) => yS(d.nw))
      .curve(d3.curveCatmullRom);

    g.append('path').datum(data)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#00d4a0')
      .attr('stroke-width', 2);

    // Tooltip overlay
    const overlay = g.append('rect')
      .attr('width', iw).attr('height', ih)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    const vLine = g.append('line').attr('y1', 0).attr('y2', ih)
      .attr('stroke', 'rgba(0,212,160,0.3)').attr('stroke-width', 1).attr('display', 'none');

    const dot = g.append('circle').attr('r', 4).attr('fill', '#00d4a0').attr('display', 'none');

    overlay.on('mousemove', function (event) {
      const [mx] = d3.pointer(event);
      const date = xS.invert(mx);
      const idx = d3.bisectLeft(data.map((d) => d.date.getTime()), date.getTime());
      const pt = data[Math.max(0, Math.min(idx, data.length - 1))];
      if (!pt) return;

      const x = xS(pt.date);
      const y = yS(pt.nw);
      vLine.attr('x1', x).attr('x2', x).attr('display', null);
      dot.attr('cx', x).attr('cy', y).attr('display', null);

      if (tooltipRef.current) {
        const container = svgRef.current!.parentElement!.getBoundingClientRect();
        const svgRect = svgRef.current!.getBoundingClientRect();
        tooltipRef.current.style.display = 'block';
        tooltipRef.current.style.left = `${x + pad.l + 12}px`;
        tooltipRef.current.style.top = `${y + pad.t - 40}px`;
        tooltipRef.current.innerHTML = `
          <div style="color:#6b7fa0;font-size:11px;margin-bottom:4px;font-family:var(--font-mono)">${pt.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          <div style="color:#00d4a0;font-size:16px;font-family:var(--font-display)">${formatCurrency(pt.nw)}</div>
        `;
      }
    });

    overlay.on('mouseleave', () => {
      vLine.attr('display', 'none');
      dot.attr('display', 'none');
      if (tooltipRef.current) tooltipRef.current.style.display = 'none';
    });
  }

  if (loading) return <div className="loading-screen">Loading dashboard…</div>;

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Dashboard</div>
        <div className="topbar-actions">
          <button className="btn" onClick={handleSync} disabled={syncing}>
            <i className="ti ti-refresh" aria-hidden="true" />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <button className="btn btn-primary" onClick={openPlaid}>
            <i className="ti ti-plus" aria-hidden="true" />
            Connect bank
          </button>
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Stat cards */}
        <div className="stat-grid">
          <div className="stat-card green">
            <div className="stat-label">Net worth</div>
            <div className="stat-value">{formatCurrency(netWorth)}</div>
            <div className={`stat-delta ${nwChange >= 0 ? 'up' : 'down'}`}>
              {nwChange >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(nwChange))} total
            </div>
          </div>
          <div className="stat-card blue">
            <div className="stat-label">Total assets</div>
            <div className="stat-value">{formatCurrency(totalAssets)}</div>
            <div className="stat-delta">{assets.length} accounts</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Total debt</div>
            <div className="stat-value">{formatCurrency(totalLiabilities)}</div>
            <div className="stat-delta">{liabilities.length} liabilities</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-label">Debt ratio</div>
            <div className="stat-value">{debtRatio.toFixed(1)}%</div>
            <div className={`stat-delta ${debtRatio < 30 ? 'up' : 'down'}`}>
              {debtRatio < 30 ? '▲ Healthy' : '▼ High'}
            </div>
          </div>
        </div>

        {/* Timeline + Donut */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <i className="ti ti-timeline" style={{ color: 'var(--nt-green)' }} aria-hidden="true" />
                Net worth timeline
              </div>
              <div style={{ display: 'flex', gap: 2, background: 'var(--nt-surface2)', borderRadius: 6, padding: 3 }}>
                {(['30d', '90d', '1y', 'all'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => { setRange(r); snapshotsApi.list(r).then(res => setSnapshots(res.data.snapshots)); }}
                    style={{
                      padding: '4px 10px', borderRadius: 4,
                      background: range === r ? 'var(--nt-green)' : 'transparent',
                      color: range === r ? '#000' : 'var(--nt-muted)',
                      border: 'none', cursor: 'pointer',
                      fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: range === r ? 500 : 400,
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <svg ref={svgRef} aria-label="Net worth timeline" role="img" />
              <div ref={tooltipRef} style={{
                position: 'absolute', display: 'none',
                background: 'var(--nt-surface)', border: '1px solid var(--nt-border)',
                borderRadius: 6, padding: '8px 12px', pointerEvents: 'none', zIndex: 10,
              }} />
              {snapshots.length === 0 && (
                <div className="empty-state">
                  <div>No snapshot data yet.</div>
                  <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleSync}>
                    Create first snapshot
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <i className="ti ti-chart-donut-3" style={{ color: 'var(--nt-green)' }} aria-hidden="true" />
                Allocation
              </div>
            </div>
            {totalAssets > 0 ? (
              <>
                <div style={{ position: 'relative', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Doughnut data={donutData} options={{
                    responsive: false,
                    cutout: '68%',
                    plugins: { legend: { display: false }, tooltip: {
                      callbacks: { label: (c) => `${c.label}: ${formatCurrency(c.parsed)}` }
                    }},
                  }} width={160} height={160} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 12 }}>
                  {Object.entries(breakdown).map(([type, val]) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--nt-muted)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLORS[type], flexShrink: 0 }} />
                      {type.replace('_', ' ')} {totalAssets > 0 ? Math.round((val / totalAssets) * 100) : 0}%
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state"><p>No assets yet</p></div>
            )}
          </div>
        </div>

        {/* Asset list */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="ti ti-wallet" style={{ color: 'var(--nt-green)' }} aria-hidden="true" />
              Assets
            </div>
            <span className="badge badge-green">{assets.length} connected</span>
          </div>
          {assets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><i className="ti ti-wallet" /></div>
              <h3>No assets yet</h3>
              <p>Connect your bank with Plaid or add assets manually.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {assets.map((a) => (
                <div key={a._id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', background: 'var(--nt-surface2)',
                  borderRadius: 8, border: '1px solid transparent',
                  transition: 'border-color 0.15s', cursor: 'default',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${TYPE_COLORS[a.type]}20`,
                    }}>
                      <i className={`ti ${TYPE_ICONS[a.type]}`} style={{ color: TYPE_COLORS[a.type], fontSize: 15 }} aria-hidden="true" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--nt-muted)', fontFamily: 'var(--font-mono)' }}>
                        {a.type.replace('_', ' ')} · {a.source}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--nt-text)' }}>
                      {formatCurrency(a.value)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--nt-muted)' }}>
                      {totalAssets > 0 ? Math.round((a.value / totalAssets) * 100) : 0}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
