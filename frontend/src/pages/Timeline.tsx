import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useNetWorth } from '../hooks/useNetWorth';
import { formatCurrency } from '../utils/api';
import { TimelineRange } from '../types';

export default function Timeline() {
  const [range, setRange] = useState<TimelineRange>('1y');
  const { snapshots, netWorth, totalAssets, totalLiabilities, loading } = useNetWorth(range);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && snapshots.length > 0) drawChart();
  }, [snapshots, loading]);

  function drawChart() {
    if (!svgRef.current || !snapshots.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const W = svgRef.current.parentElement!.clientWidth;
    const H = 360;
    svgRef.current.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svgRef.current.setAttribute('width', String(W));
    svgRef.current.setAttribute('height', String(H));

    const pad = { t: 20, r: 24, b: 36, l: 72 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;

    const data = snapshots.map(s => ({
      date: new Date(s.date),
      nw: s.netWorth,
      assets: s.totalAssets,
      liabilities: s.totalLiabilities,
    }));

    const xS = d3.scaleTime().domain(d3.extent(data, d => d.date) as [Date, Date]).range([0, iw]);
    const allVals = data.flatMap(d => [d.nw, d.assets]);
    const [minV, maxV] = d3.extent(allVals) as [number, number];
    const yS = d3.scaleLinear().domain([Math.min(0, minV * 0.94), maxV * 1.06]).range([ih, 0]);

    const g = svg.append('g').attr('transform', `translate(${pad.l},${pad.t})`);

    // Grid
    yS.ticks(5).forEach(tick => {
      g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', yS(tick)).attr('y2', yS(tick))
        .attr('stroke', 'rgba(255,255,255,0.05)').attr('stroke-width', 1);
      g.append('text').attr('x', -10).attr('y', yS(tick) + 4).attr('text-anchor', 'end')
        .attr('fill', '#6b7fa0').attr('font-size', 11).attr('font-family', 'DM Mono, monospace')
        .text('$' + (Math.abs(tick) >= 1000 ? Math.round(tick / 1000) + 'k' : tick));
    });

    xS.ticks(7).forEach(tick => {
      g.append('text').attr('x', xS(tick)).attr('y', ih + 22).attr('text-anchor', 'middle')
        .attr('fill', '#6b7fa0').attr('font-size', 11).attr('font-family', 'DM Mono, monospace')
        .text(d3.timeFormat(range === 'all' ? '%Y' : '%b %y')(tick));
    });

    const mkArea = (yFn: (d: any) => number) =>
      d3.area<any>().x(d => xS(d.date)).y0(ih).y1(d => yS(yFn(d))).curve(d3.curveCatmullRom);
    const mkLine = (yFn: (d: any) => number) =>
      d3.line<any>().x(d => xS(d.date)).y(d => yS(yFn(d))).curve(d3.curveCatmullRom);

    const defs = svg.append('defs');
    const gradNW = defs.append('linearGradient').attr('id', 'g-nw').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
    gradNW.append('stop').attr('offset', '0%').attr('stop-color', '#00d4a0').attr('stop-opacity', 0.15);
    gradNW.append('stop').attr('offset', '100%').attr('stop-color', '#00d4a0').attr('stop-opacity', 0);

    g.append('path').datum(data).attr('d', mkArea(d => d.nw)).attr('fill', 'url(#g-nw)');
    g.append('path').datum(data).attr('d', mkLine(d => d.assets)(data))
      .attr('fill', 'none').attr('stroke', '#3d8ef8').attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3').attr('opacity', 0.6);
    g.append('path').datum(data).attr('d', mkLine(d => d.nw)(data))
      .attr('fill', 'none').attr('stroke', '#00d4a0').attr('stroke-width', 2.5);

    // Tooltip
    const overlay = g.append('rect').attr('width', iw).attr('height', ih).attr('fill', 'transparent').style('cursor', 'crosshair');
    const vLine = g.append('line').attr('y1', 0).attr('y2', ih).attr('stroke', 'rgba(0,212,160,0.25)').attr('stroke-width', 1).attr('display', 'none');
    const dot = g.append('circle').attr('r', 4).attr('fill', '#00d4a0').attr('display', 'none');

    overlay.on('mousemove', function(event) {
      const [mx] = d3.pointer(event);
      const date = xS.invert(mx);
      const idx = d3.bisectLeft(data.map(d => d.date.getTime()), date.getTime());
      const pt = data[Math.max(0, Math.min(idx, data.length - 1))];
      if (!pt) return;
      const x = xS(pt.date), y = yS(pt.nw);
      vLine.attr('x1', x).attr('x2', x).attr('display', null);
      dot.attr('cx', x).attr('cy', y).attr('display', null);
      if (tooltipRef.current) {
        tooltipRef.current.style.display = 'block';
        tooltipRef.current.style.left = (x + pad.l + 14) + 'px';
        tooltipRef.current.style.top = (y + pad.t - 60) + 'px';
        tooltipRef.current.innerHTML = `
          <div style="color:#6b7fa0;font-size:10px;font-family:var(--font-mono);margin-bottom:6px">${pt.date.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
          <div style="display:flex;flex-direction:column;gap:3px">
            <div style="display:flex;justify-content:space-between;gap:20px;font-size:12px">
              <span style="color:#6b7fa0">Net worth</span><span style="color:#00d4a0;font-family:var(--font-mono)">${formatCurrency(pt.nw)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:20px;font-size:12px">
              <span style="color:#6b7fa0">Assets</span><span style="color:#3d8ef8;font-family:var(--font-mono)">${formatCurrency(pt.assets)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:20px;font-size:12px">
              <span style="color:#6b7fa0">Liabilities</span><span style="color:#ff5470;font-family:var(--font-mono)">${formatCurrency(pt.liabilities)}</span>
            </div>
          </div>`;
      }
    });
    overlay.on('mouseleave', () => {
      vLine.attr('display', 'none'); dot.attr('display', 'none');
      if (tooltipRef.current) tooltipRef.current.style.display = 'none';
    });
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Timeline</div>
        <div className="topbar-actions">
          {(['30d','90d','1y','all'] as TimelineRange[]).map(r => (
            <button key={r} className={`btn btn-sm${range === r ? ' btn-primary' : ''}`} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="stat-grid">
          <div className="stat-card green"><div className="stat-label">Current net worth</div><div className="stat-value">{formatCurrency(netWorth)}</div></div>
          <div className="stat-card blue"><div className="stat-label">Total assets</div><div className="stat-value">{formatCurrency(totalAssets)}</div></div>
          <div className="stat-card red"><div className="stat-label">Total liabilities</div><div className="stat-value">{formatCurrency(totalLiabilities)}</div></div>
          <div className="stat-card purple"><div className="stat-label">Data points</div><div className="stat-value">{snapshots.length}</div><div className="stat-delta">daily snapshots</div></div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title"><i className="ti ti-chart-line" style={{color:'var(--nt-green)'}} /> Net worth over time</div>
            <div style={{display:'flex',gap:12,fontSize:12,fontFamily:'var(--font-mono)',color:'var(--nt-muted)'}}>
              <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:20,height:2,background:'#00d4a0',display:'inline-block',borderRadius:1}}></span>Net worth</span>
              <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:20,height:2,background:'#3d8ef8',display:'inline-block',borderRadius:1,opacity:0.6,borderTop:'2px dashed #3d8ef8'}}></span>Assets</span>
            </div>
          </div>
          {loading ? <div style={{height:360,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--nt-muted)',fontFamily:'var(--font-mono)',fontSize:13}}>Loading…</div>
          : snapshots.length === 0 ? <div className="empty-state"><p>No snapshot data yet. Sync to create your first snapshot.</p></div>
          : <div style={{position:'relative'}}>
              <svg ref={svgRef} role="img" aria-label="Net worth timeline chart" />
              <div ref={tooltipRef} style={{position:'absolute',display:'none',background:'var(--nt-surface)',border:'1px solid var(--nt-border)',borderRadius:8,padding:'10px 14px',pointerEvents:'none',zIndex:10,minWidth:200}} />
            </div>
          }
        </div>
      </div>
    </>
  );
}
