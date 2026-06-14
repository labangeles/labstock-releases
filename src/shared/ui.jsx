import { useState, useEffect, useRef } from "react";

/* ── TOKENS ──────────────────────────────────────────────── */
export const T = {
  teal:'var(--teal)', tealDk:'var(--teal-dark)', tealXL:'var(--teal-xlight)', tealL:'var(--teal-light)',
  canvas:'var(--bg-canvas)', surface:'var(--bg-surface)',
  hi:'var(--text-hi)', mid:'var(--text-mid)', lo:'var(--text-lo)',
  border:'var(--border)', borderMd:'var(--border-mid)',
  ok:'var(--ok)', okBg:'var(--ok-bg)',
  warn:'var(--warn)', warnBg:'var(--warn-bg)',
  crit:'var(--crit)', critBg:'var(--crit-bg)',
  out:'var(--out)', outBg:'var(--out-bg)',
};

/* ── ICONS ───────────────────────────────────────────────── */
export const Ico = {
  Home:        ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>),
  Box:         ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>),
  Bell:        ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>),
  Activity:    ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>),
  Users:       ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  Search:      ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>),
  Plus:        ({s=16,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  File:        ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
  Warn:        ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.29 3.86-8.66 15A1 1 0 0 0 2.5 20.5h19a1 1 0 0 0 .87-1.5l-8.66-15a1 1 0 0 0-1.74 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>),
  Check:       ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>),
  XCircle:     ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>),
  XClose:      ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  Edit:        ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  Trash:       ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
  Copy:        ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>),
  Sliders:     ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>),
  Upload:      ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16,16 12,12 8,16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>),
  Download:    ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="8,17 12,21 16,17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>),
  LogOut:      ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>),
  Map:         ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>),
  Cart:        ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>),
  Truck:       ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>),
  Inbox:       ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22,12 16,12 14,15 10,15 8,12 2,12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>),
  // Caja
  DollarSign:  ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>),
  CreditCard:  ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>),
  TrendingDown:({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23,18 13.5,8.5 8.5,13.5 1,6"/><polyline points="17,18 23,18 23,12"/></svg>),
  Lock:        ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>),
  Unlock:      ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>),
  Calendar:    ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  Banknote:    ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>),
  History:     ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>),
  ChevronDown:  ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,9 12,15 18,9"/></svg>),
  ChevronUp:    ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18,15 12,9 6,15"/></svg>),
  ChevronLeft:  ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6"/></svg>),
  ChevronRight: ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6"/></svg>),
  BarChart:     ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>),
  Receipt:      ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16l2-2 2 2 2-2 2 2 2-2 2 2V4a2 2 0 0 0-2-2z"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="14" y2="14"/></svg>),
  Wallet:       ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>),
  TrendingUp:   ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>),
  Layers:       ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 2,7 12,12 22,7"/><polyline points="2,17 12,22 22,17"/><polyline points="2,12 12,17 22,12"/></svg>),
  Sun:          ({s=16,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>),
  Moon:         ({s=16,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>),
  Eye:          ({s=16,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>),
  EyeOff:       ({s=16,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>),
};

/* ── UTILIDAD: formato moneda Guatemala ──────────────────── */
export const fmtQ = n =>
  new Intl.NumberFormat('es-GT', { style:'currency', currency:'GTQ' }).format(Number(n)||0);

/* ── COMPONENTES ─────────────────────────────────────────── */
export function Btn({children,variant='primary',icon,onClick,size='md',disabled,full,style:ext}) {
  const [hov,setHov]=useState(false);
  const sz={sm:{padding:'5px 12px',fontSize:12.5},md:{padding:'8px 16px',fontSize:14},lg:{padding:'10px 22px',fontSize:15}};
  const vs={
    primary: {bg:hov&&!disabled?T.tealDk:T.teal,color:'#fff',border:'none'},
    secondary:{bg:hov&&!disabled?T.border:T.canvas,color:T.mid,border:`1px solid ${T.border}`},
    ghost:   {bg:hov&&!disabled?T.tealXL:'transparent',color:hov&&!disabled?T.tealDk:T.mid,border:'none'},
    danger:  {bg:hov&&!disabled?'#FCD0D0':T.critBg,color:T.crit,border:'1px solid #F8C8C8'},
    success: {bg:'#DDFAEC',color:T.ok,border:'none'},
  };
  const v=vs[variant]||vs.primary;
  return (
    <button onMouseEnter={()=>!disabled&&setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={disabled?undefined:onClick} disabled={disabled}
      style={{display:'inline-flex',alignItems:'center',gap:6,
        justifyContent:full?'center':undefined,width:full?'100%':undefined,
        border:v.border,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',fontWeight:500,
        borderRadius:8,transition:'all 0.12s',background:v.bg,color:v.color,
        opacity:disabled?0.45:1,...sz[size],...ext}}>
      {icon}{children}
    </button>
  );
}

export function IconBtn({icon,onClick,danger,title}) {
  const [hov,setHov]=useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      title={title}
      style={{background:hov?(danger?T.critBg:T.tealXL):'transparent',border:'none',cursor:'pointer',
        padding:6,borderRadius:6,color:hov?(danger?T.crit:T.tealDk):T.lo,
        display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.1s'}}>
      {icon}
    </button>
  );
}

export function Modal({open,onClose,title,children,maxWidth=460}) {
  if (!open) return null;
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(10,20,28,0.45)',
      display:'flex',alignItems:'center',justifyContent:'center',
      zIndex:200,backdropFilter:'blur(2px)',padding:16,WebkitAppRegion:'no-drag'}}
>
      <div style={{background:T.surface,borderRadius:14,width:'100%',maxWidth,
        maxHeight:'92vh',overflowY:'auto',WebkitAppRegion:'no-drag',
        boxShadow:'0 20px 60px rgba(0,0,0,0.25)',border:`1px solid ${T.border}`}}>
        <div style={{padding:'18px 22px',borderBottom:`1px solid ${T.border}`,
          display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:14,fontWeight:600,color:T.hi}}>{title}</span>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',
            color:T.lo,padding:4,borderRadius:6,display:'flex'}}>
            <Ico.XClose/>
          </button>
        </div>
        <div style={{padding:'20px 22px'}}>{children}</div>
      </div>
    </div>
  );
}

export function Field({label,error,hint,children}) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:'block',fontSize:12,fontWeight:600,color:T.mid,marginBottom:5}}>{label}</label>
      {children}
      {error&&<p style={{fontSize:11,color:T.crit,margin:'3px 0 0'}}>{error}</p>}
      {hint&&!error&&<p style={{fontSize:11,color:T.lo,margin:'3px 0 0'}}>{hint}</p>}
    </div>
  );
}

/* TInput — workaround Electron: type="number" bloquea teclado en algunos builds */
export function TInput({value,onChange,placeholder,type='text',min,max,focusOnMount,disabled}) {
  const [foc,setFoc]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    if(focusOnMount){ const t=setTimeout(()=>ref.current?.focus(),80); return ()=>clearTimeout(t); }
  },[focusOnMount]);
  const isNum=type==='number';
  return (
    <input ref={ref} type={isNum?'text':type} inputMode={isNum?'numeric':undefined}
      value={value} onChange={onChange} disabled={disabled}
      placeholder={placeholder} min={min} max={max}
      onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
      style={{width:'100%',padding:'8px 11px',
        border:`1px solid ${foc?T.teal:T.border}`,
        borderRadius:8,fontFamily:'inherit',fontSize:13.5,color:T.hi,
        background:disabled?T.canvas:'var(--input-bg)',
        outline:'none',transition:'border-color 0.12s',boxSizing:'border-box',
        cursor:disabled?'not-allowed':'text'}}/>
  );
}

export function TSelect({value,onChange,options,disabled}) {
  const [foc,setFoc]=useState(false);
  return (
    <select value={value} onChange={onChange} disabled={disabled}
      onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
      style={{width:'100%',padding:'8px 11px',border:`1px solid ${foc?T.teal:T.border}`,
        borderRadius:8,fontFamily:'inherit',fontSize:13.5,color:T.hi,
        background:disabled?T.canvas:'var(--input-bg)',
        outline:'none',transition:'border-color 0.12s',boxSizing:'border-box',cursor:'pointer'}}>
      {options.map(o=>typeof o==='string'
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
  );
}

export function StatCard({icon,value,label,accent}) {
  const [hov,setHov]=useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{flex:1,background:T.surface,borderRadius:14,
        border:`1px solid ${hov?T.tealL:T.border}`,padding:'20px 22px',
        display:'flex',flexDirection:'column',gap:10,transition:'all 0.15s',
        boxShadow:hov?'0 4px 20px rgba(43,191,190,0.10)':'none'}}>
      <div style={{color:accent,opacity:0.85}}>{icon}</div>
      <div style={{fontSize:38,fontWeight:700,color:accent,lineHeight:1,letterSpacing:'-0.03em'}}>{value}</div>
      <div style={{fontSize:12,color:T.mid,fontWeight:500}}>{label}</div>
    </div>
  );
}
