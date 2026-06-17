// src/components/Emblem.jsx — Emblemas de reconocimiento (SVG, sin dependencias)
// LabStock · Lab. Clínico Los Ángeles
//
// Medallas dibujadas con acabado metálico y 3 niveles:
//   · gold  → "Honor"      (distinciones máximas)
//   · steel → "Distinción" (calidad / cumplimiento)
//   · teal  → "Mérito"     (marca, la mayoría)
//
// USO RÁPIDO
//   import Emblem from '../components/Emblem';
//   <Emblem shape="medallion" glyph="trophy" palette="gold" ribbon size={92} />

import { useState } from 'react';

/* ── PALETAS METÁLICAS ──────────────────────────────────────── */
export const PAL = {
  gold:  { tier:'Honor',      rim:['#FBEFA6','#E9BC3F','#9C6E16'], chan:'#7E550F',
           face:['#FFF8DD','#F0CE6A'], edge:'#C99A2E', glyph:'#6E4B0C', spark:'#FFFCEB', ribbon:'#C8901F', ribbonDk:'#9A6B12' },
  steel: { tier:'Distinción', rim:['#F4F9FB','#BBCCD2','#76909A'], chan:'#5E767F',
           face:['#FCFEFF','#D2E0E5'], edge:'#9DB4BB', glyph:'#3C5660', spark:'#FFFFFF', ribbon:'#9FB4BB', ribbonDk:'#74909A' },
  teal:  { tier:'Mérito',     rim:['#9BF0EF','#2BBFBE','#0E6F6E'], chan:'#0B5857',
           face:['#E9FCFC','#8FE4E3'], edge:'#34AFAE', glyph:'#0A5453', spark:'#F2FFFF', ribbon:'#1FA6A5', ribbonDk:'#0E6F6E' },
  lock:  { tier:'Bloqueado',  rim:['#EAEFF1','#CBD6DA','#9DABB1'], chan:'#A9B6BB',
           face:['#F4F7F8','#DDE5E8'], edge:'#C2CDD1', glyph:'#A6B2B7', spark:'#FFFFFF', ribbon:'#CBD6DA', ribbonDk:'#AFBCC1' },
};

/* ── GLIFOS (rejilla 24×24) ─────────────────────────────────── */
function Glyph({ name, c }) {
  const S = { fill:'none', stroke:c, strokeWidth:1.7, strokeLinecap:'round', strokeLinejoin:'round' };
  const F = { fill:c };
  switch (name) {
    case 'star':   return <path {...F} d="M12 2.6l2.6 5.7 6.2.7-4.6 4.2 1.2 6.1L12 16.9 6.6 19.3l1.2-6.1L3.2 9l6.2-.7z"/>;
    case 'clock':  return <g {...S}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 2"/></g>;
    case 'trophy': return <g {...S}><path d="M8 20.5h8M12 16.5v4M7.2 4.5h9.6v3.8a4.8 4.8 0 0 1-9.6 0z"/><path d="M7.2 6.4H4.3v1.7a2.9 2.9 0 0 0 2.9 2.9M16.8 6.4h2.9v1.7a2.9 2.9 0 0 1-2.9 2.9"/></g>;
    case 'team':   return <g {...S}><circle cx="9" cy="8.4" r="2.9"/><path d="M15 5.8a2.9 2.9 0 0 1 0 5.6"/><path d="M4 19v-1a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v1"/><path d="M15 14.2a4 4 0 0 1 3.3 3.9V19"/></g>;
    case 'flask':  return <g {...S}><path d="M9.3 3.2h5.4M10.2 3.2v5.6L5.4 17.6a1.9 1.9 0 0 0 1.7 2.9h9.8a1.9 1.9 0 0 0 1.7-2.9L13.8 8.8V3.2"/><path d="M7.6 14.4h8.8"/></g>;
    case 'bulb':   return <g {...S}><path d="M9.2 18.2h5.6M10.4 21h3.2M12 3.2a6.1 6.1 0 0 0-3.9 10.8c1 .9 1.4 1.8 1.4 2.6h5c0-.8.4-1.7 1.4-2.6A6.1 6.1 0 0 0 12 3.2z"/></g>;
    case 'laurel': return <g {...S}><path d="M11.4 5C8.4 6 6.5 9 6.5 12.6S8.4 19 11.4 20"/><path d="M12.6 5c3 1 4.9 4 4.9 7.6S15.6 19 12.6 20"/><path {...F} stroke="none" d="M12 9.4l.9 1.9 2 .2-1.5 1.4.4 2L12 13.9l-1.8 1 .4-2L9.1 11.5l2-.2z"/></g>;
    case 'heart':  return <g {...S}><path d="M12 19.6C9.6 18.2 4 14.6 4 10.2A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 8 2c0 1.2-.4 2.3-1.1 3.3"/><path d="M11 13.5h2.2l1.2-2 1.6 3.2 1-1.4h2.6"/></g>;
    case 'target': return <g {...S}><path d="M20.5 12A8.5 8.5 0 1 1 12 3.5"/><circle cx="12" cy="12" r="4.2"/><path d="M12 12l5.4-5.4M14.6 6.4h3V3.4"/></g>;
    case 'sun':    return <g {...S}><circle cx="12" cy="12" r="4"/><path d="M12 3.4V5M12 19v1.6M3.4 12H5M19 12h1.6M5.9 5.9l1.1 1.1M17 17l1.1 1.1M5.9 18.1l1.1-1.1M17 7l1.1-1.1"/></g>;
    case 'shield': return <g {...S}><path d="M12 3.2l7 2.9v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9v-5z"/><path d="M9 12.2l2.1 2.1 4-4.2"/></g>;
    case 'gear':   return <g {...S}><circle cx="12" cy="12" r="2.7"/><path d="M19.1 13.3a7.2 7.2 0 0 0 0-2.6l1.9-1.4-1.9-3.3-2.2 1a7.2 7.2 0 0 0-2.3-1.3L14.2 3h-3.8l-.4 2.4a7.2 7.2 0 0 0-2.3 1.3l-2.2-1L3.6 9l1.9 1.4a7.2 7.2 0 0 0 0 2.6L3.6 14.7l1.9 3.3 2.2-1a7.2 7.2 0 0 0 2.3 1.3l.4 2.4h3.8l.4-2.4a7.2 7.2 0 0 0 2.3-1.3l2.2 1 1.9-3.3z"/></g>;
    default:       return null;
  }
}

/* ── EMBLEMA ────────────────────────────────────────────────── */
let _uid = 0;
export default function Emblem({ shape = 'medallion', glyph, palette = 'teal', ribbon = false, size = 96 }) {
  const [id] = useState(() => 'em' + (++_uid));
  const p = PAL[palette] || PAL.teal;
  const cx = 50, cy = 49, R = 43;

  const dots = [];
  const N = 48;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    dots.push(<circle key={i} cx={cx + Math.cos(a) * 37.5} cy={cy + Math.sin(a) * 37.5} r="0.7" fill={p.rim[0]} opacity="0.55" />);
  }

  const hex = (r) => {
    let d = '';
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1) + ' ';
    }
    return d + 'Z';
  };

  const shieldPath = (s) => {
    const t = cy - s, b = cy + s * 1.18, w = s * 0.92;
    return `M${cx} ${t} L${cx + w} ${t + s * 0.34} L${cx + w} ${cy + s * 0.18} Q${cx + w} ${b - s * 0.2} ${cx} ${b} Q${cx - w} ${b - s * 0.2} ${cx - w} ${cy + s * 0.18} L${cx - w} ${t + s * 0.34} Z`;
  };

  let frame;
  if (shape === 'hexagon') {
    frame = (<g>
      <path d={hex(R)} fill={`url(#${id}r)`} stroke={p.rim[2]} strokeWidth="0.6" />
      <path d={hex(R - 5)} fill={p.chan} />
      <path d={hex(R - 7)} fill={`url(#${id}f)`} stroke={p.edge} strokeWidth="0.8" />
    </g>);
  } else if (shape === 'shield') {
    frame = (<g>
      <path d={shieldPath(R)} fill={`url(#${id}r)`} stroke={p.rim[2]} strokeWidth="0.6" />
      <path d={shieldPath(R - 5)} fill={p.chan} />
      <path d={shieldPath(R - 7)} fill={`url(#${id}f)`} stroke={p.edge} strokeWidth="0.8" />
    </g>);
  } else {
    frame = (<g>
      <circle cx={cx} cy={cy} r={R} fill={`url(#${id}r)`} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={p.rim[0]} strokeWidth="0.8" opacity="0.6" />
      <circle cx={cx} cy={cy} r={R - 4.5} fill={p.chan} />
      {dots}
      <circle cx={cx} cy={cy} r={R - 9} fill={`url(#${id}f)`} stroke={p.edge} strokeWidth="0.8" />
    </g>);
  }

  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 100 112" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.rim[0]} /><stop offset="0.5" stopColor={p.rim[1]} /><stop offset="1" stopColor={p.rim[2]} />
        </linearGradient>
        <radialGradient id={`${id}f`} cx="0.5" cy="0.36" r="0.75">
          <stop offset="0" stopColor={p.face[0]} /><stop offset="1" stopColor={p.face[1]} />
        </radialGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.rim[1]} /><stop offset="1" stopColor={p.rim[2]} />
        </linearGradient>
        <filter id={`${id}sh`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="1.6" floodColor="#1A3038" floodOpacity="0.22" />
        </filter>
      </defs>

      {shape === 'sunburst' && (
        <g opacity="0.95">
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (i / 16) * Math.PI * 2, r1 = 40, r2 = 51, w = 0.13;
            const x1 = cx + Math.cos(a - w) * r1, y1 = cy + Math.sin(a - w) * r1;
            const x2 = cx + Math.cos(a) * r2,     y2 = cy + Math.sin(a) * r2;
            const x3 = cx + Math.cos(a + w) * r1, y3 = cy + Math.sin(a + w) * r1;
            return <path key={i} d={`M${x1} ${y1} L${x2} ${y2} L${x3} ${y3} Z`} fill={`url(#${id}s)`} />;
          })}
        </g>
      )}

      {ribbon && (
        <g filter={`url(#${id}sh)`}>
          <path d="M42 76 L34 108 L46 100 L50 86 Z" fill={p.ribbonDk} />
          <path d="M58 76 L66 108 L54 100 L50 86 Z" fill={p.ribbon} />
        </g>
      )}

      <g filter={`url(#${id}sh)`}>
        {frame}
        <ellipse cx={cx} cy={cy - 11} rx="20" ry="12" fill={p.spark} opacity="0.34" />
        <g transform={`translate(${cx} ${cy + 1}) scale(1.42) translate(-12 -12)`}>
          <g transform="translate(0 0.6)" opacity="0.5"><Glyph name={glyph} c={p.spark} /></g>
          <Glyph name={glyph} c={p.glyph} />
        </g>
      </g>
    </svg>
  );
}
