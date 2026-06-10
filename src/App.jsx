import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import logoTeal from "./assets/logo-icon-teal.png";
import { supabase } from "./lib/supabase";
import { useAuth } from "./contexts/AuthContext";

/* ── TOKENS ─────────────────────────────────────────────── */
const T = {
  teal:'#2BBFBE', tealDk:'#1A9696', tealXL:'#EAF8F8', tealL:'#B8E8E8',
  canvas:'#EDF2F4', surface:'#FFFFFF',
  hi:'#152028', mid:'#50606C', lo:'#8899A4',
  border:'#DCE8EC', borderMd:'#C4D8DC',
  ok:'#12A050', okBg:'#DDFAEC',
  warn:'#B07400', warnBg:'#FFF0D0',
  crit:'#D41E1E', critBg:'#FFEAEA',
  out:'#6C7C88', outBg:'#EEF2F4',
};

/* ── ICONS ───────────────────────────────────────────────── */
const Ico = {
  Home: ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>),
  Box:  ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>),
  Bell: ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>),
  Activity: ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>),
  Users: ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  Search: ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>),
  Plus:   ({s=16,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  File:   ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
  Warn:   ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.29 3.86-8.66 15A1 1 0 0 0 2.5 20.5h19a1 1 0 0 0 .87-1.5l-8.66-15a1 1 0 0 0-1.74 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>),
  Check:  ({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>),
  XCircle:({s=18,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>),
  XClose: ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  Edit:   ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  Trash:  ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
  Copy:   ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>),
  Sliders:({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>),
  Upload: ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16,16 12,12 8,16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>),
  Download:({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="8,17 12,21 16,17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>),
  LogOut: ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>),
  Map:    ({s=14,c='currentColor'}) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>),
};

/* ── DATOS ───────────────────────────────────────────────── */
const CATEGORIES = [
  "Reactivos","Consumibles desechables","Material de vidrio",
  "Controles y calibradores","Equipos y accesorios",
  "Papelería y formularios","Soluciones y buffer","Otros",
];
const UNITS = [
  "frascos","unidades","cajas","paquetes","rollos","pares",
  "litros","mL","tubos","tiras reactivas","láminas","resmas","bidones","kits",
];

/* ── STATUS ──────────────────────────────────────────────── */
const getStatus = i => {
  if (i.current === 0) return "out";
  const r = i.current / i.minimum;
  if (r <= 0.5) return "crit";
  if (r <= 1.0) return "warn";
  return "ok";
};
const SM = {
  ok:   { label:"OK",         c:T.ok,   bg:T.okBg   },
  warn: { label:"Precaución", c:T.warn, bg:T.warnBg },
  crit: { label:"Crítico",    c:T.crit, bg:T.critBg },
  out:  { label:"Agotado",    c:T.out,  bg:T.outBg  },
};
const fmt = iso => iso
  ? new Date(iso).toLocaleString("es-GT",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})
  : "—";

/* ── DB HELPERS ──────────────────────────────────────────── */
const fromDB = r => ({
  id: r.id, name: r.nombre, category: r.categoria, unit: r.unidad,
  current: r.cantidad_actual, minimum: r.cantidad_minima, maximum: r.cantidad_maxima,
  lastUpdated: r.updated_at, sede_id: r.sede_id,
});
const toDB = (item, sedeId, userId) => ({
  nombre: item.name.trim(), categoria: item.category, unidad: item.unit,
  cantidad_actual: Number(item.current), cantidad_minima: Number(item.minimum),
  cantidad_maxima: Number(item.maximum), sede_id: sedeId, created_by: userId,
});

const logAct = (sedeId, sedeName, itemId, itemName, userId, userName, accion, qA, qN, nota) =>
  supabase.from('actividad').insert({
    sede_id: sedeId, item_id: itemId || null, user_id: userId,
    nombre_item: itemName, nombre_usuario: userName, sede_nombre: sedeName,
    accion, cantidad_anterior: qA ?? null, cantidad_nueva: qN ?? null,
    nota: nota || null,
  });

/* ── CSV ─────────────────────────────────────────────────── */
// ﻿ = BOM UTF-8: le dice a Excel que abra el archivo en UTF-8 y separe por comas
const BOM = '﻿';
const CSV_SEP = 'sep=,';
const CSV_COLS = 'nombre,categoria,unidad,cantidad_actual,cantidad_minima,cantidad_maxima';

function itemsToCSV(items) {
  const rows = items.map(i =>
    `"${i.name}","${i.category}","${i.unit}",${i.current},${i.minimum},${i.maximum}`
  );
  return `${BOM}${CSV_SEP}\n${CSV_COLS}\n${rows.join('\n')}`;
}

function parseCSV(text) {
  // Limpiar BOM y línea sep= si vienen de Excel
  const clean = text.replace(/^﻿/, '').replace(/^sep=.*\n/i, '');
  const lines = clean.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('El archivo está vacío.');
  const header = lines[0].toLowerCase();
  if (!header.includes('nombre') || !header.includes('categoria'))
    throw new Error('Encabezado CSV incorrecto. Usa la plantilla descargada.');
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.replace(/^"|"$/g,'').trim());
    const [nombre, categoria, unidad, ca, cm, cx] = cols;
    if (!nombre) return null;
    return {
      name: nombre, category: categoria || CATEGORIES[0], unit: unidad || UNITS[0],
      current: Math.max(0, parseInt(ca)||0),
      minimum: Math.max(1, parseInt(cm)||5),
      maximum: Math.max(1, parseInt(cx)||20),
    };
  }).filter(Boolean);
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTES UI
═══════════════════════════════════════════════════════════ */

function StatusBadge({status}) {
  const s = SM[status]||SM.ok;
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 9px',
      borderRadius:20,background:s.bg,color:s.c,fontSize:11.5,fontWeight:600,whiteSpace:'nowrap'}}>
      <span style={{width:5,height:5,borderRadius:'50%',background:s.c,flexShrink:0}}/>
      {s.label}
    </span>
  );
}

function StatCard({icon,value,label,accent}) {
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

function TitleBar({profile, sedeName, onSignOut}) {
  return (
    <div style={{height:32,flexShrink:0,background:'#F5FAFA',borderBottom:`1px solid ${T.border}`,
      display:'flex',alignItems:'center',padding:'0 12px',
      userSelect:'none',WebkitAppRegion:'drag',position:'relative'}}>
      <span style={{position:'absolute',left:'50%',transform:'translateX(-50%)',
        fontSize:11.5,color:T.lo,letterSpacing:'0.015em',pointerEvents:'none'}}>
        {sedeName ? `${sedeName} — LabStock` : 'LabStock — Lab. Clínico Los Ángeles'}
      </span>
      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,WebkitAppRegion:'no-drag'}}>
        {profile && (
          <span style={{fontSize:11,color:T.lo,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {profile.nombre}
          </span>
        )}
        {onSignOut && (
          <button onClick={onSignOut} title="Cerrar sesión"
            style={{background:'none',border:'none',cursor:'pointer',color:T.lo,padding:'2px 4px',
              display:'flex',alignItems:'center',gap:4,borderRadius:4,fontFamily:'inherit',fontSize:11}}>
            <Ico.LogOut s={12}/>
          </button>
        )}
        {['#E6ECED','#E6ECED','#FF6058'].map((bg,i)=>(
          <div key={i} style={{width:11,height:11,borderRadius:'50%',background:bg}}/>
        ))}
      </div>
    </div>
  );
}

function NavBtn({id,label,Icon,badge,active,onNav}) {
  const [hov,setHov]=useState(false);
  return (
    <button onClick={()=>onNav(id)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'9px 10px',
        borderRadius:8,border:'none',cursor:'pointer',marginBottom:1,position:'relative',
        background:active?T.tealXL:hov?'#F0F5F7':'transparent',
        color:active?T.tealDk:hov?T.hi:T.mid,fontFamily:'inherit',fontSize:13.5,
        fontWeight:active?600:400,transition:'all 0.12s',textAlign:'left'}}>
      {active&&<span style={{position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',
        width:3,height:18,borderRadius:'0 2px 2px 0',background:T.teal}}/>}
      <Icon s={16} c={active?T.teal:undefined}/>
      <span style={{flex:1}}>{label}</span>
      {badge>0&&<span style={{minWidth:18,height:18,borderRadius:9,padding:'0 5px',
        background:T.crit,color:'#fff',fontSize:10.5,fontWeight:700,
        display:'flex',alignItems:'center',justifyContent:'center'}}>{badge}</span>}
    </button>
  );
}

function Sidebar({view,onNav,alertCount,profile,sedes,selectedSede,onSedeChange}) {
  const isAdmin = profile?.rol==='admin';
  const nav = [
    {id:'inicio',     label:'Inicio',     Icon:Ico.Home},
    {id:'inventario', label:'Inventario', Icon:Ico.Box},
    {id:'alertas',    label:'Alertas',    Icon:Ico.Bell, badge:alertCount},
    {id:'actividad',  label:'Registro',   Icon:Ico.Activity},
    ...(isAdmin?[{id:'usuarios',label:'Usuarios',Icon:Ico.Users}]:[]),
  ];
  return (
    <aside style={{width:214,flexShrink:0,background:T.surface,
      borderRight:`1px solid ${T.border}`,display:'flex',flexDirection:'column'}}>
      <div style={{padding:'20px 16px 18px',borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <img src={logoTeal} alt="" style={{width:32,height:32,objectFit:'contain',flexShrink:0}}/>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:T.hi,letterSpacing:'-0.015em',lineHeight:1.2}}>LabStock</div>
            <div style={{fontSize:10.5,color:T.lo,marginTop:2}}>Los Ángeles</div>
          </div>
        </div>
      </div>

      {/* Selector de sede para admin */}
      {isAdmin && sedes.length>0 && (
        <div style={{padding:'10px 12px 0',borderBottom:`1px solid ${T.border}`,paddingBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,color:T.lo,textTransform:'uppercase',
            letterSpacing:'0.07em',marginBottom:5}}>Sede</div>
          <select value={selectedSede||''} onChange={e=>onSedeChange(e.target.value||null)}
            style={{width:'100%',padding:'6px 8px',border:`1px solid ${T.border}`,borderRadius:6,
              fontFamily:'inherit',fontSize:12,color:T.hi,background:T.canvas,outline:'none',cursor:'pointer'}}>
            <option value="">Todas las sedes</option>
            {sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      )}

      <nav style={{flex:1,padding:'10px 8px'}}>
        <div style={{fontSize:10,fontWeight:700,color:T.lo,textTransform:'uppercase',
          letterSpacing:'0.08em',padding:'4px 10px 6px'}}>Módulos</div>
        {nav.map(({id,label,Icon,badge})=>(
          <NavBtn key={id} id={id} label={label} Icon={Icon} badge={badge||0}
            active={view===id} onNav={onNav}/>
        ))}
      </nav>

      <div style={{padding:'10px 16px 14px',borderTop:`1px solid ${T.border}`}}>
        <div style={{fontSize:11.5,fontWeight:600,color:T.mid,marginBottom:2}}>{profile?.nombre}</div>
        <div style={{fontSize:10.5,color:T.lo}}>
          {profile?.rol==='admin' ? '⚑ Administrador' : profile?.sedes?.nombre || 'Técnico'}
        </div>
      </div>
    </aside>
  );
}

function Btn({children,variant='primary',icon,onClick,size='md',disabled,full,style:ext}) {
  const [hov,setHov]=useState(false);
  const sz={sm:{padding:'5px 12px',fontSize:12},md:{padding:'8px 16px',fontSize:13.5},lg:{padding:'10px 22px',fontSize:14.5}};
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

function IconBtn({icon,onClick,danger}) {
  const [hov,setHov]=useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:hov?(danger?T.critBg:T.tealXL):'transparent',border:'none',cursor:'pointer',
        padding:6,borderRadius:6,color:hov?(danger?T.crit:T.tealDk):T.lo,
        display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.1s'}}>
      {icon}
    </button>
  );
}

function Modal({open,onClose,title,children,maxWidth=460}) {
  if (!open) return null;
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(10,20,28,0.45)',
      display:'flex',alignItems:'center',justifyContent:'center',
      zIndex:200,backdropFilter:'blur(2px)',padding:16,WebkitAppRegion:'no-drag'}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
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

function Field({label,error,hint,children}) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:'block',fontSize:12,fontWeight:600,color:T.mid,marginBottom:5}}>{label}</label>
      {children}
      {error&&<p style={{fontSize:11,color:T.crit,margin:'3px 0 0'}}>{error}</p>}
      {hint&&!error&&<p style={{fontSize:11,color:T.lo,margin:'3px 0 0'}}>{hint}</p>}
    </div>
  );
}

/* TInput sin autoFocus nativo — usa ref con setTimeout para evitar bug Electron */
function TInput({value,onChange,placeholder,type='text',min,max,focusOnMount}) {
  const [foc,setFoc]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    if(focusOnMount){ const t=setTimeout(()=>ref.current?.focus(),80); return ()=>clearTimeout(t); }
  },[focusOnMount]);
  return (
    <input ref={ref} type={type} value={value} onChange={onChange}
      placeholder={placeholder} min={min} max={max}
      onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
      style={{width:'100%',padding:'8px 11px',border:`1px solid ${foc?T.teal:T.border}`,
        borderRadius:8,fontFamily:'inherit',fontSize:13,color:T.hi,background:'#F8FAFB',
        outline:'none',transition:'border-color 0.12s',boxSizing:'border-box'}}/>
  );
}

function TSelect({value,onChange,options}) {
  const [foc,setFoc]=useState(false);
  return (
    <select value={value} onChange={onChange} onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
      style={{width:'100%',padding:'8px 11px',border:`1px solid ${foc?T.teal:T.border}`,
        borderRadius:8,fontFamily:'inherit',fontSize:13,color:T.hi,background:'#F8FAFB',
        outline:'none',transition:'border-color 0.12s',boxSizing:'border-box',cursor:'pointer'}}>
      {options.map(o=><option key={o}>{o}</option>)}
    </select>
  );
}

function Meter({current,minimum,maximum,status}) {
  const pct=Math.min(100,Math.max(0,(current/maximum)*100));
  const minPct=Math.min(100,(minimum/maximum)*100);
  const color=SM[status]?.c||T.ok;
  return (
    <div style={{position:'relative',height:5,background:'#E8EEF2',borderRadius:3}}>
      <div style={{position:'absolute',left:`${minPct}%`,top:-3,width:2,height:11,
        background:T.borderMd,borderRadius:1,zIndex:2}} title={`Mínimo: ${minimum}`}/>
      <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:3,transition:'width 0.4s ease'}}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODALES
═══════════════════════════════════════════════════════════ */

function ItemFormModal({initial,onSave,onClose,sedes=[],initialSedeId=null}) {
  const needsSede = sedes.length>0 && !initialSedeId;
  const [f,setF]=useState(initial?{...initial,sedeId:initialSedeId||''}:{
    name:'',category:CATEGORIES[0],unit:UNITS[0],current:0,minimum:5,maximum:20,
    sedeId: initialSedeId || (sedes.length===1?sedes[0].id:''),
  });
  const [err,setErr]=useState({});
  const set=(k,v)=>{setF(p=>({...p,[k]:v}));setErr(e=>({...e,[k]:null}));};
  const validate=()=>{
    const e={};
    if(!f.name.trim()) e.name="Nombre requerido";
    if(needsSede&&!f.sedeId) e.sedeId="Selecciona la sede";
    if(isNaN(f.current)||+f.current<0) e.current="No puede ser negativo";
    if(isNaN(f.minimum)||+f.minimum<1) e.minimum="Mínimo 1";
    if(isNaN(f.maximum)||+f.maximum<1) e.maximum="Mínimo 1";
    if(!e.minimum&&!e.maximum&&+f.minimum>=+f.maximum) e.minimum="Debe ser menor al máximo";
    if(!e.current&&!e.maximum&&+f.current>+f.maximum) e.current=`No puede superar el máximo (${f.maximum})`;
    setErr(e); return !Object.keys(e).length;
  };
  return (
    <div>
      {needsSede&&(
        <Field label="Sede" error={err.sedeId}>
          <select value={f.sedeId} onChange={e=>set('sedeId',e.target.value)}
            style={{width:'100%',padding:'8px 11px',border:`1px solid ${err.sedeId?T.crit:T.border}`,
              borderRadius:8,fontFamily:'inherit',fontSize:13,color:T.hi,background:'#F8FAFB',
              outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
            <option value="">Seleccionar sede...</option>
            {sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </Field>
      )}
      <Field label="Nombre del insumo" error={err.name}>
        <TInput value={f.name} onChange={e=>set("name",e.target.value)}
          placeholder="Ej: Glucosa Enzimática" focusOnMount={!needsSede}/>
      </Field>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="Categoría"><TSelect value={f.category} onChange={e=>set("category",e.target.value)} options={CATEGORIES}/></Field>
        <Field label="Unidad de medida"><TSelect value={f.unit} onChange={e=>set("unit",e.target.value)} options={UNITS}/></Field>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <Field label="Cantidad actual" error={err.current} hint="¿Cuántos hay?">
          <TInput type="number" value={f.current} onChange={e=>set("current",e.target.value)} min={0}/>
        </Field>
        <Field label="Stock mínimo" error={err.minimum} hint="Umbral alerta">
          <TInput type="number" value={f.minimum} onChange={e=>set("minimum",e.target.value)} min={1}/>
        </Field>
        <Field label="Stock máximo" error={err.maximum} hint="Capacidad">
          <TInput type="number" value={f.maximum} onChange={e=>set("maximum",e.target.value)} min={1}/>
        </Field>
      </div>
      <div style={{background:'#EFF6FF',borderRadius:8,padding:'10px 12px',fontSize:12.5,
        color:'#1D4ED8',display:'flex',gap:8,marginBottom:18}}>
        <span style={{flexShrink:0}}>💡</span>
        <span>Alarma al bajar del <strong>mínimo</strong>. Alerta crítica al 50% del mínimo.</span>
      </div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>validate()&&onSave({...f,current:+f.current,minimum:+f.minimum,maximum:+f.maximum})}
          icon={<Ico.Check s={14}/>}>Guardar insumo</Btn>
      </div>
    </div>
  );
}

function UpdateStockModal({item,onSave,onClose}) {
  const [qty,setQty]=useState(item.current);
  const [editing,setEditing]=useState(false);
  const [raw,setRaw]=useState(String(item.current));
  const [note,setNote]=useState("");
  const add=n=>setQty(q=>Math.min(item.maximum,Math.max(0,q+n)));
  const commit=()=>{
    const v=parseInt(raw,10);
    if(!isNaN(v)&&v>=0&&v<=item.maximum) setQty(v); else setRaw(String(qty));
    setEditing(false);
  };
  const st=getStatus({...item,current:qty});
  const s=SM[st];
  const adjStyle=(n,isAdd)=>{
    const dis=isAdd?qty+n>item.maximum:qty+n<0;
    return {width:40,height:40,borderRadius:8,border:`1px solid ${T.border}`,
      fontWeight:700,fontSize:12.5,fontFamily:'inherit',
      cursor:dis?'not-allowed':'pointer',
      background:dis?T.canvas:(isAdd?T.okBg:T.critBg),
      color:dis?T.lo:(isAdd?T.ok:T.crit),transition:'all 0.1s'};
  };
  return (
    <div>
      <div style={{textAlign:'center',marginBottom:16}}>
        <div style={{fontSize:15,fontWeight:700,color:T.hi}}>{item.name}</div>
        <div style={{fontSize:12,color:T.lo,marginTop:2}}>{item.category}</div>
      </div>
      <div style={{background:s.bg,borderRadius:10,padding:'9px 16px',textAlign:'center',
        marginBottom:16,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        <span style={{width:6,height:6,borderRadius:'50%',background:s.c,flexShrink:0}}/>
        <span style={{fontWeight:700,color:s.c,fontSize:13.5}}>{s.label}</span>
      </div>
      <div style={{background:T.canvas,borderRadius:10,padding:'12px 14px',marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:T.lo,marginBottom:7}}>
          <span>0</span><span>Mín: {item.minimum}</span><span>Máx: {item.maximum} {item.unit}</span>
        </div>
        <Meter current={qty} minimum={item.minimum} maximum={item.maximum} status={st}/>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:18}}>
        {[-10,-5,-1].map(n=>(
          <button key={n} onClick={()=>add(n)} disabled={qty+n<0} style={adjStyle(n,false)}>{n}</button>
        ))}
        {editing?(
          <input type="number" value={raw} min={0} max={item.maximum}
            onChange={e=>setRaw(e.target.value)} onBlur={commit}
            onKeyDown={e=>e.key==="Enter"&&commit()} autoFocus
            style={{width:80,height:80,borderRadius:14,background:T.teal,border:`2px solid ${T.tealL}`,
              color:'#fff',fontSize:28,fontWeight:700,textAlign:'center',outline:'none',
              fontFamily:'inherit',boxSizing:'border-box'}}/>
        ):(
          <div onClick={()=>{setEditing(true);setRaw(String(qty));}}
            title="Clic para editar directamente"
            style={{width:80,height:80,borderRadius:14,background:T.teal,color:'#fff',
              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
              cursor:'text',userSelect:'none',boxShadow:'0 4px 14px rgba(43,191,190,0.30)'}}>
            <span style={{fontSize:30,fontWeight:800,lineHeight:1}}>{qty}</span>
            <span style={{fontSize:10.5,opacity:0.75,marginTop:2}}>{item.unit}</span>
          </div>
        )}
        {[1,5,10].map(n=>(
          <button key={n} onClick={()=>add(n)} disabled={qty+n>item.maximum} style={adjStyle(n,true)}>+{n}</button>
        ))}
      </div>
      <div style={{marginBottom:16}}>
        <TInput value={note} onChange={e=>setNote(e.target.value)}
          placeholder="Nota opcional: ej. 'pedido recibido lunes'"/>
      </div>
      <div style={{display:'flex',gap:8}}>
        <Btn variant="secondary" onClick={onClose} style={{flex:1,justifyContent:'center'}}>Cancelar</Btn>
        <Btn onClick={()=>onSave(qty,note)} style={{flex:2,justifyContent:'center'}}>
          Confirmar: {qty} {item.unit}
        </Btn>
      </div>
    </div>
  );
}

function DeleteModal({item,onDelete,onClose}) {
  return (
    <div>
      <div style={{background:'#FFF8EC',border:'1px solid #F5DEBA',borderRadius:10,
        padding:'14px 16px',marginBottom:20}}>
        <p style={{margin:0,fontWeight:700,color:'#92400E',fontSize:14}}>¿Eliminar "{item.name}"?</p>
        <p style={{margin:'6px 0 0',fontSize:13,color:'#92400E'}}>Esta acción no se puede deshacer.</p>
      </div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn variant="danger" onClick={onDelete} icon={<Ico.Trash s={13}/>}>Sí, eliminar</Btn>
      </div>
    </div>
  );
}

function ReportModal({items,sedeName,onClose}) {
  const [copied,setCopied]=useState(false);
  const now=new Date().toLocaleString("es-GT",{weekday:"long",day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const bySt={
    out:items.filter(i=>getStatus(i)==="out"),crit:items.filter(i=>getStatus(i)==="crit"),
    warn:items.filter(i=>getStatus(i)==="warn"),ok:items.filter(i=>getStatus(i)==="ok"),
  };
  const alerts=[...bySt.out,...bySt.crit,...bySt.warn];
  const pad=(s,n)=>String(s).slice(0,n).padEnd(n);
  const text=[
    "╔══════════════════════════════════════╗",
    "    LABORATORIO CLÍNICO LOS ÁNGELES",
    `         ${sedeName||'REPORTE DE INVENTARIO'}`,
    "╚══════════════════════════════════════╝",
    `Generado: ${now}`,
    "──────────────────────────────────────",
    `Total: ${items.length}  OK: ${bySt.ok.length}  Precaución: ${bySt.warn.length}  Crítico: ${bySt.crit.length}  Agotado: ${bySt.out.length}`,
    "──────────────────────────────────────",
    ...(alerts.length>0?[
      "⚠ REQUIEREN ATENCIÓN:",
      ...(bySt.out.length>0?[`⛔ AGOTADOS:`,...bySt.out.map(i=>`  • ${i.name} — ${i.current}/${i.minimum} ${i.unit}`)]:[]),
      ...(bySt.crit.length>0?[`🔴 CRÍTICOS:`,...bySt.crit.map(i=>`  • ${i.name} — ${i.current}/${i.minimum} ${i.unit}`)]:[]),
      ...(bySt.warn.length>0?[`⚠️  PRECAUCIÓN:`,...bySt.warn.map(i=>`  • ${i.name} — ${i.current}/${i.minimum} ${i.unit}`)]:[]),
    ]:["✅ Todos los insumos en niveles óptimos.",""]),
    "──────────────────────────────────────",
    "INVENTARIO COMPLETO:",
    ...items.map(i=>`  ${pad(SM[getStatus(i)].label,10)} ${pad(i.name,26)} ${String(i.current).padStart(3)} ${i.unit} (min:${i.minimum})`),
    "──────────────────────────────────────",
    "Lab. Clínico Los Ángeles — Guatemala",
  ].join("\n");
  const copy=()=>{
    navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);}).catch(()=>{});
  };
  return (
    <div>
      {alerts.length>0&&(
        <div style={{background:T.warnBg,borderRadius:10,padding:'11px 14px',marginBottom:14,
          display:'flex',gap:8,alignItems:'center'}}>
          <Ico.Warn s={14} c={T.warn}/>
          <span style={{fontSize:13,color:T.warn,fontWeight:600}}>{alerts.length} insumo(s) requieren reposición</span>
        </div>
      )}
      <pre style={{background:'#0F172A',color:'#CBD5E0',borderRadius:10,padding:'14px 16px',
        fontSize:10.5,lineHeight:1.65,whiteSpace:'pre-wrap',
        fontFamily:"'Courier New',Courier,monospace",maxHeight:300,overflowY:'auto',margin:'0 0 14px'}}>
        {text}
      </pre>
      <div style={{display:'flex',gap:8}}>
        <Btn variant="secondary" onClick={onClose} style={{flex:1,justifyContent:'center'}}>Cerrar</Btn>
        <Btn onClick={copy} variant={copied?'success':'primary'}
          icon={copied?<Ico.Check s={14}/>:<Ico.Copy s={14}/>}
          style={{flex:2,justifyContent:'center'}}>
          {copied?'¡Copiado!':'Copiar reporte'}
        </Btn>
      </div>
    </div>
  );
}

function ImportModal({onImport,onClose}) {
  const [rows,setRows]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);

  const download=async()=>{
    const template=`${BOM}${CSV_SEP}\n${CSV_COLS}\nGlucosa Enzimatica,Reactivos,frascos,4,5,20\nCreatinina,Reactivos,frascos,8,5,20`;
    if(window.electronAPI?.saveFile){
      await window.electronAPI.saveFile({defaultPath:'plantilla-labstock.csv',content:template});
    } else {
      const a=document.createElement('a');
      a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(template);
      a.download='plantilla-labstock.csv'; a.click();
    }
  };

  const pick=async()=>{
    setError('');
    try {
      let text='';
      if(window.electronAPI?.openFile){
        const r=await window.electronAPI.openFile();
        if(r.canceled) return;
        text=r.content;
      } else {
        text=await new Promise((res,rej)=>{
          const inp=document.createElement('input');
          inp.type='file'; inp.accept='.csv';
          inp.onchange=e=>{
            const f=e.target.files[0]; if(!f){rej();return;}
            const reader=new FileReader();
            reader.onload=ev=>res(ev.target.result);
            reader.readAsText(f);
          };
          inp.click();
        });
      }
      setRows(parseCSV(text));
    } catch(e) {
      setError(e.message||'Error al leer el archivo.');
    }
  };

  const confirm=async()=>{
    if(!rows?.length) return;
    setLoading(true);
    await onImport(rows);
    setLoading(false);
    onClose();
  };

  return (
    <div>
      <p style={{fontSize:13,color:T.mid,marginBottom:16}}>
        Carga masiva de insumos desde un archivo CSV. Primero descarga la plantilla, complétala y súbela.
      </p>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <Btn variant="secondary" icon={<Ico.Download s={13}/>} onClick={download} size="sm">
          Descargar plantilla
        </Btn>
        <Btn variant="ghost" icon={<Ico.Upload s={13}/>} onClick={pick} size="sm">
          Seleccionar archivo CSV
        </Btn>
      </div>
      {error&&<div style={{background:T.critBg,borderRadius:8,padding:'10px 12px',
        fontSize:12.5,color:T.crit,marginBottom:12}}>{error}</div>}
      {rows&&(
        <div style={{background:T.canvas,borderRadius:10,padding:12,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:600,color:T.mid,marginBottom:8}}>
            {rows.length} insumo(s) listos para importar
          </div>
          <div style={{maxHeight:160,overflowY:'auto'}}>
            {rows.slice(0,10).map((r,i)=>(
              <div key={i} style={{fontSize:12,color:T.hi,padding:'3px 0',
                borderBottom:`1px solid ${T.border}`}}>
                {r.name} — {r.current} {r.unit}
              </div>
            ))}
            {rows.length>10&&<div style={{fontSize:11,color:T.lo,marginTop:4}}>...y {rows.length-10} más</div>}
          </div>
        </div>
      )}
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={confirm} disabled={!rows?.length||loading}
          icon={<Ico.Upload s={13}/>}>
          {loading?'Importando...`':`Importar ${rows?.length||0} insumos`}
        </Btn>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PANTALLA: INICIO
═══════════════════════════════════════════════════════════ */
function InicioScreen({items,onGoAlerts,onReport,sedeName,isAdmin,sedes,itemsBySede}) {
  const counts={
    ok:items.filter(i=>getStatus(i)==="ok").length,
    warn:items.filter(i=>getStatus(i)==="warn").length,
    crit:items.filter(i=>getStatus(i)==="crit").length,
    out:items.filter(i=>getStatus(i)==="out").length,
  };
  const alertN=counts.warn+counts.crit+counts.out;
  const cats=CATEGORIES.filter(cat=>items.some(i=>i.category===cat));
  const catSt=cat=>{
    const ci=items.filter(i=>i.category===cat);
    if(ci.some(i=>getStatus(i)==="out")) return "out";
    if(ci.some(i=>getStatus(i)==="crit")) return "crit";
    if(ci.some(i=>getStatus(i)==="warn")) return "warn";
    return "ok";
  };
  const fecha=new Date().toLocaleDateString("es-MX",{weekday:"long",year:"numeric",month:"long",day:"numeric"});

  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>
      <div>
        <h1 style={{fontSize:21,fontWeight:700,color:T.hi,letterSpacing:'-0.025em',margin:0}}>
          {sedeName||'Todas las sedes'}
        </h1>
        <p style={{fontSize:12.5,color:T.lo,marginTop:4,textTransform:'capitalize'}}>{fecha}</p>
      </div>

      {alertN>0&&(
        <div style={{background:'#FFF5F5',border:'1px solid #F5CECE',borderRadius:10,
          padding:'11px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <Ico.Warn s={15} c={T.crit}/>
            <span style={{fontSize:13,fontWeight:500,color:'#B81818'}}>
              {alertN} insumo{alertN>1?'s':''} requieren atención urgente
            </span>
          </div>
          <button onClick={onGoAlerts} style={{background:'none',border:'none',cursor:'pointer',
            color:T.crit,fontSize:12,fontWeight:600,fontFamily:'inherit'}}>Ver alertas →</button>
        </div>
      )}

      <div style={{display:'flex',gap:12}}>
        <StatCard icon={<Ico.Box s={21}/>}       value={items.length}           label="Total insumos"      accent={T.teal}/>
        <StatCard icon={<Ico.Check s={21}/>}      value={counts.ok}              label="Stock óptimo"       accent={T.ok}/>
        <StatCard icon={<Ico.Warn s={21}/>}       value={counts.warn}            label="Precaución"         accent={T.warn}/>
        <StatCard icon={<Ico.XCircle s={21}/>}    value={counts.crit+counts.out} label="Crítico / Agotado"  accent={T.crit}/>
      </div>

      {/* Vista multi-sede para admin sin sede seleccionada */}
      {isAdmin && !sedeName && sedes?.length>0 && (
        <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',
            alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:13.5,fontWeight:600,color:T.hi}}>Estado por sede</span>
          </div>
          {sedes.map((sede,i)=>{
            const si=itemsBySede?.[sede.id]||[];
            const alerts=si.filter(it=>getStatus(it)!=='ok').length;
            return (
              <div key={sede.id} style={{display:'flex',alignItems:'center',padding:'11px 20px',gap:14,
                borderBottom:i<sedes.length-1?`1px solid ${T.border}`:'none'}}>
                <Ico.Map s={14} c={T.lo}/>
                <span style={{flex:1,fontSize:13,fontWeight:500,color:T.hi}}>{sede.nombre}</span>
                <span style={{fontSize:12,color:T.lo,marginRight:4}}>{si.length} insumos</span>
                <StatusBadge status={alerts>0?(si.some(it=>getStatus(it)==='out'||getStatus(it)==='crit')?'crit':'warn'):'ok'}/>
              </div>
            );
          })}
        </div>
      )}

      {cats.length>0&&(
        <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',
            alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:13.5,fontWeight:600,color:T.hi}}>Estado por categoría</span>
            <span style={{fontSize:11.5,color:T.lo}}>{cats.length} categorías</span>
          </div>
          {cats.map((cat,i)=>{
            const ci=items.filter(it=>it.category===cat);
            return (
              <div key={cat} style={{display:'flex',alignItems:'center',padding:'11px 20px',gap:14,
                borderBottom:i<cats.length-1?`1px solid ${T.border}`:'none'}}>
                <span style={{flex:1,fontSize:13,fontWeight:500,color:T.hi}}>{cat}</span>
                <span style={{fontSize:12,color:T.lo,marginRight:4}}>{ci.length} insumo{ci.length>1?'s':''}</span>
                <StatusBadge status={catSt(cat)}/>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <Btn icon={<Ico.File s={13}/>} variant="secondary" onClick={onReport}>
          Generar reporte para jefatura
        </Btn>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PANTALLA: INVENTARIO
═══════════════════════════════════════════════════════════ */
function InventarioScreen({items,filter,setFilter,filtered,onAdd,onEdit,onUpdate,onDelete,onImport,onExport,canEdit}) {
  const chips=[
    {id:'Todos',label:'Todos',n:items.length},
    {id:'ok',label:'OK',n:items.filter(i=>getStatus(i)==='ok').length},
    {id:'warn',label:'Precaución',n:items.filter(i=>getStatus(i)==='warn').length},
    {id:'crit',label:'Crítico',n:items.filter(i=>['crit','out'].includes(getStatus(i))).length},
  ];
  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:21,fontWeight:700,color:T.hi,letterSpacing:'-0.025em',margin:0}}>Inventario</h1>
          <p style={{fontSize:12.5,color:T.lo,marginTop:4}}>{items.length} insumos registrados</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Btn variant="secondary" size="sm" icon={<Ico.Download s={13}/>} onClick={onExport}>Exportar</Btn>
          <Btn variant="secondary" size="sm" icon={<Ico.Upload s={13}/>} onClick={onImport}>Importar</Btn>
          {canEdit&&<Btn icon={<Ico.Plus s={14}/>} onClick={onAdd}>Agregar insumo</Btn>}
        </div>
      </div>

      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,
        padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
        <div style={{position:'relative'}}>
          <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',
            color:T.lo,pointerEvents:'none'}}><Ico.Search s={14}/></span>
          <input value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))}
            placeholder="Buscar insumo o categoría..."
            style={{width:'100%',padding:'8px 12px 8px 34px',border:`1px solid ${T.border}`,
              borderRadius:8,fontFamily:'inherit',fontSize:13,color:T.hi,background:'#F6FAFB',
              outline:'none',boxSizing:'border-box'}}
            onFocus={e=>e.target.style.borderColor=T.teal}
            onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
        <div style={{display:'flex',gap:6}}>
          {chips.map(ch=>{
            const on=filter.status===ch.id;
            return (
              <button key={ch.id} onClick={()=>setFilter(f=>({...f,status:ch.id}))}
                style={{padding:'4px 12px',borderRadius:20,border:'none',cursor:'pointer',
                  fontFamily:'inherit',fontSize:11.5,fontWeight:500,
                  background:on?T.teal:T.canvas,color:on?'#fff':T.mid,transition:'all 0.12s'}}>
                {ch.label} · {ch.n}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1.1fr 0.7fr 0.55fr 1fr 84px',
          padding:'8px 18px',borderBottom:`1px solid ${T.border}`,background:'#F4F8FA'}}>
          {['Insumo','Categoría','Stock','Mín.','Estado',''].map((h,i)=>(
            <span key={i} style={{fontSize:10.5,fontWeight:700,color:T.lo,
              textTransform:'uppercase',letterSpacing:'0.07em'}}>{h}</span>
          ))}
        </div>
        {filtered.length===0?(
          <div style={{padding:'52px 20px',textAlign:'center'}}>
            <Ico.Search s={30} c={T.border}/>
            <div style={{fontSize:13.5,color:T.lo,marginTop:10}}>Sin resultados</div>
          </div>
        ):filtered.map((item,i)=>{
          const st=getStatus(item);
          const low=item.current<=item.minimum;
          return (
            <div key={item.id}
              style={{display:'grid',gridTemplateColumns:'2fr 1.1fr 0.7fr 0.55fr 1fr 84px',
                padding:'12px 18px',alignItems:'center',
                borderBottom:i<filtered.length-1?`1px solid ${T.border}`:'none',transition:'background 0.1s'}}
              onMouseEnter={e=>e.currentTarget.style.background='#F5F9FB'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div>
                <div style={{fontSize:13,fontWeight:500,color:T.hi}}>{item.name}</div>
                {item.lastUpdated&&(
                  <div style={{fontSize:10.5,color:T.lo,marginTop:1}}>{fmt(item.lastUpdated)}</div>
                )}
              </div>
              <span style={{fontSize:12,color:T.mid}}>{item.category}</span>
              <span style={{fontSize:13,fontWeight:600,color:low?T.crit:T.hi}}>
                {item.current}&nbsp;<span style={{fontSize:10.5,color:T.lo,fontWeight:400}}>{item.unit}</span>
              </span>
              <span style={{fontSize:12.5,color:T.mid}}>{item.minimum}</span>
              <StatusBadge status={st}/>
              <div style={{display:'flex',gap:2,justifyContent:'flex-end'}}>
                <IconBtn icon={<Ico.Sliders s={13}/>} onClick={()=>onUpdate(item)}/>
                {canEdit&&<IconBtn icon={<Ico.Edit s={13}/>} onClick={()=>onEdit(item)}/>}
                {canEdit&&<IconBtn icon={<Ico.Trash s={13}/>} danger onClick={()=>onDelete(item)}/>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PANTALLA: ALERTAS
═══════════════════════════════════════════════════════════ */
function AlertasScreen({items,onUpdate,onReport}) {
  const crit=items.filter(i=>['crit','out'].includes(getStatus(i)));
  const warn=items.filter(i=>getStatus(i)==='warn');
  const all=[...crit,...warn];
  if(all.length===0) return (
    <div style={{paddingTop:80,display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
      <div style={{width:60,height:60,borderRadius:'50%',background:T.okBg,
        display:'flex',alignItems:'center',justifyContent:'center'}}>
        <Ico.Check s={28} c={T.ok}/>
      </div>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:17,fontWeight:700,color:T.hi}}>¡Todo en orden!</div>
        <div style={{fontSize:13,color:T.lo,marginTop:5}}>Todos los insumos tienen stock suficiente</div>
      </div>
    </div>
  );
  return (
    <div style={{display:'flex',flexDirection:'column',gap:26}}>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:21,fontWeight:700,color:T.hi,letterSpacing:'-0.025em',margin:0}}>Alertas</h1>
          <p style={{fontSize:12.5,color:T.lo,marginTop:4}}>
            {all.length} insumo{all.length>1?'s':''} requieren atención
          </p>
        </div>
        <Btn icon={<Ico.File s={13}/>} variant="secondary" size="sm" onClick={onReport}>Generar reporte</Btn>
      </div>
      {crit.length>0&&<AlertSection label="Crítico · Agotado" items={crit} onUpdate={onUpdate}/>}
      {warn.length>0&&<AlertSection label="Precaución" items={warn} onUpdate={onUpdate}/>}
    </div>
  );
}
function AlertSection({label,items,onUpdate}) {
  return (
    <div>
      <div style={{fontSize:10.5,fontWeight:700,color:T.lo,textTransform:'uppercase',
        letterSpacing:'0.08em',marginBottom:10}}>{label}</div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {items.map(item=><AlertCard key={item.id} item={item} onUpdate={onUpdate}/>)}
      </div>
    </div>
  );
}
function AlertCard({item,onUpdate}) {
  const st=getStatus(item);
  const isCrit=st==='crit'||st==='out';
  const cm=isCrit?T.crit:T.warn;
  const cbg=isCrit?T.critBg:T.warnBg;
  const pct=item.minimum>0?Math.round((item.current/item.minimum)*100):0;
  return (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,
      borderLeft:`3px solid ${cm}`,borderRadius:12,padding:'14px 18px',
      display:'flex',alignItems:'center',gap:14}}>
      <div style={{width:36,height:36,borderRadius:10,background:cbg,flexShrink:0,
        display:'flex',alignItems:'center',justifyContent:'center'}}>
        {isCrit?<Ico.XCircle s={16} c={cm}/>:<Ico.Warn s={15} c={cm}/>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13.5,fontWeight:600,color:T.hi}}>{item.name}</div>
        <div style={{fontSize:12,color:T.mid,marginTop:3}}>
          {st==='out'?'Sin stock — reabastecer urgente'
            :`${item.current} ${item.unit} disponibles · Mínimo: ${item.minimum}`}
        </div>
        {st!=='out'&&(
          <div style={{marginTop:8,display:'flex',alignItems:'center',gap:8}}>
            <div style={{flex:1,height:4,borderRadius:2,background:cbg,overflow:'hidden'}}>
              <div style={{width:`${Math.min(pct,100)}%`,height:'100%',background:cm,borderRadius:2}}/>
            </div>
            <span style={{fontSize:11,color:cm,fontWeight:600,whiteSpace:'nowrap'}}>{pct}%</span>
          </div>
        )}
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8,flexShrink:0}}>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:24,fontWeight:700,color:cm,lineHeight:1}}>{item.current}</div>
          <div style={{fontSize:11,color:T.lo,marginTop:2}}>{item.unit}</div>
        </div>
        <Btn size="sm" onClick={()=>onUpdate(item)}>Actualizar</Btn>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PANTALLA: REGISTRO DE ACTIVIDAD
═══════════════════════════════════════════════════════════ */
function ActividadScreen({sedeId,isAdmin}) {
  const [logs,setLogs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filtro,setFiltro]=useState('');

  useEffect(()=>{
    let q=supabase.from('actividad').select('*').order('created_at',{ascending:false}).limit(200);
    if(sedeId) q=q.eq('sede_id',sedeId);
    q.then(({data})=>{setLogs(data||[]);setLoading(false);});
  },[sedeId]);

  const icons={agregar:'➕',actualizar:'🔄',editar:'✏️',eliminar:'🗑️',importar:'📥',exportar:'📤'};
  const filtered=filtro?logs.filter(l=>
    l.nombre_item?.toLowerCase().includes(filtro.toLowerCase())||
    l.nombre_usuario?.toLowerCase().includes(filtro.toLowerCase())||
    l.accion?.toLowerCase().includes(filtro.toLowerCase())
  ):logs;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <div>
        <h1 style={{fontSize:21,fontWeight:700,color:T.hi,letterSpacing:'-0.025em',margin:0}}>Registro de actividad</h1>
        <p style={{fontSize:12.5,color:T.lo,marginTop:4}}>Historial de cambios en inventario</p>
      </div>
      <div style={{position:'relative'}}>
        <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',
          color:T.lo,pointerEvents:'none'}}><Ico.Search s={14}/></span>
        <input value={filtro} onChange={e=>setFiltro(e.target.value)}
          placeholder="Buscar por insumo, usuario o acción..."
          style={{width:'100%',padding:'8px 12px 8px 34px',border:`1px solid ${T.border}`,
            borderRadius:8,fontFamily:'inherit',fontSize:13,color:T.hi,background:T.surface,
            outline:'none',boxSizing:'border-box'}}
          onFocus={e=>e.target.style.borderColor=T.teal}
          onBlur={e=>e.target.style.borderColor=T.border}/>
      </div>
      {loading?(
        <div style={{textAlign:'center',padding:'40px 0',color:T.lo}}>Cargando registro...</div>
      ):(
        <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'140px 1fr 100px 80px 80px 1fr',
            padding:'8px 18px',borderBottom:`1px solid ${T.border}`,background:'#F4F8FA'}}>
            {['Fecha','Insumo','Usuario','Acción','Cambio','Nota/Sede'].map((h,i)=>(
              <span key={i} style={{fontSize:10.5,fontWeight:700,color:T.lo,
                textTransform:'uppercase',letterSpacing:'0.07em'}}>{h}</span>
            ))}
          </div>
          {filtered.length===0?(
            <div style={{padding:'40px 20px',textAlign:'center',color:T.lo,fontSize:13}}>
              Sin registros encontrados
            </div>
          ):filtered.map((log,i)=>(
            <div key={log.id}
              style={{display:'grid',gridTemplateColumns:'140px 1fr 100px 80px 80px 1fr',
                padding:'11px 18px',alignItems:'center',fontSize:12,
                borderBottom:i<filtered.length-1?`1px solid ${T.border}`:'none',
                background:i%2===0?'transparent':'#FAFCFD'}}>
              <span style={{color:T.lo,fontSize:11}}>{fmt(log.created_at)}</span>
              <span style={{fontWeight:500,color:T.hi}}>{log.nombre_item}</span>
              <span style={{color:T.mid}}>{log.nombre_usuario}</span>
              <span style={{display:'flex',alignItems:'center',gap:4}}>
                <span>{icons[log.accion]||'•'}</span>
                <span style={{color:T.mid,fontSize:11}}>{log.accion}</span>
              </span>
              <span style={{color:T.mid}}>
                {log.cantidad_anterior!==null&&log.cantidad_nueva!==null
                  ?`${log.cantidad_anterior}→${log.cantidad_nueva}`
                  :log.cantidad_nueva!==null?`+${log.cantidad_nueva}`:'—'}
              </span>
              <span style={{color:T.lo,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {log.nota||log.sede_nombre||'—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PANTALLA: GESTIÓN DE USUARIOS (solo admin)
═══════════════════════════════════════════════════════════ */
function UsuariosScreen({sedes}) {
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(false);
  const [toast,setToast]=useState('');
  const [form,setForm]=useState({nombre:'',codigo:'',password:'',rol:'tecnico',sedeId:''});
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');

  const load=()=>{
    supabase.from('profiles').select('*,sedes(nombre)').order('created_at')
      .then(({data})=>{setUsers(data||[]);setLoading(false);});
  };
  useEffect(()=>load(),[]);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(''),3000);};

  const create=async()=>{
    setErr('');
    if(!form.nombre.trim()||!form.codigo.trim()||!form.password.trim()){
      setErr('Todos los campos son obligatorios.'); return;
    }
    if(!/^[a-z0-9._-]+$/i.test(form.codigo.trim())){
      setErr('El código solo puede tener letras, números, puntos y guiones.'); return;
    }
    if(form.password.length<6){setErr('La contraseña debe tener al menos 6 caracteres.'); return;}
    if(form.rol==='tecnico'&&!form.sedeId){setErr('Selecciona la sede del técnico.'); return;}
    setSaving(true);
    const emailInterno=form.codigo.trim().toLowerCase()+'@labstock.gt';
    const r=await window.electronAPI?.createUser({
      email:emailInterno, password:form.password, nombre:form.nombre,
      rol:form.rol, sedeId:form.rol==='admin'?null:form.sedeId,
    });
    setSaving(false);
    if(r?.error){setErr(r.error);return;}
    setModal(false);
    setForm({nombre:'',codigo:'',password:'',rol:'tecnico',sedeId:''});
    load();
    showToast('✅ Usuario creado correctamente');
  };

  const disable=async(u)=>{
    if(!window.confirm(`¿Deshabilitar a ${u.nombre}?`)) return;
    const r=await window.electronAPI?.disableUser(u.id);
    if(r?.error){showToast('❌ '+r.error);return;}
    load();
    showToast('Usuario deshabilitado');
  };

  const rolBadge=rol=>({
    admin:{bg:'#EEF2FF',c:'#3730A3',label:'Admin'},
    tecnico:{bg:T.tealXL,c:T.tealDk,label:'Técnico'},
  }[rol]||{bg:T.canvas,c:T.mid,label:rol});

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      {toast&&(
        <div style={{position:'fixed',top:48,right:20,background:T.hi,color:'#fff',
          padding:'10px 18px',borderRadius:10,fontSize:13,zIndex:300,
          boxShadow:'0 4px 20px rgba(0,0,0,0.25)'}}>{toast}</div>
      )}
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:21,fontWeight:700,color:T.hi,letterSpacing:'-0.025em',margin:0}}>Gestión de usuarios</h1>
          <p style={{fontSize:12.5,color:T.lo,marginTop:4}}>{users.length} usuario(s) registrados</p>
        </div>
        <Btn icon={<Ico.Plus s={14}/>} onClick={()=>setModal(true)}>Agregar usuario</Btn>
      </div>

      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1.5fr 80px 1fr 60px',
          padding:'8px 18px',borderBottom:`1px solid ${T.border}`,background:'#F4F8FA'}}>
          {['Nombre','Código acceso','Rol','Sede',''].map((h,i)=>(
            <span key={i} style={{fontSize:10.5,fontWeight:700,color:T.lo,textTransform:'uppercase',letterSpacing:'0.07em'}}>{h}</span>
          ))}
        </div>
        {loading?(
          <div style={{padding:'40px 20px',textAlign:'center',color:T.lo}}>Cargando...</div>
        ):users.map((u,i)=>{
          const rb=rolBadge(u.rol);
          return (
            <div key={u.id}
              style={{display:'grid',gridTemplateColumns:'1fr 1.5fr 80px 1fr 60px',
                padding:'12px 18px',alignItems:'center',
                borderBottom:i<users.length-1?`1px solid ${T.border}`:'none',
                opacity:u.activo?1:0.45}}>
              <span style={{fontWeight:500,color:T.hi,fontSize:13}}>{u.nombre}</span>
              <span style={{fontSize:12,color:T.mid,fontFamily:'monospace'}}>{u.codigo||'—'}</span>
              <span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',
                borderRadius:20,background:rb.bg,color:rb.c,fontSize:11,fontWeight:600}}>{rb.label}</span>
              <span style={{fontSize:12,color:T.mid}}>{u.sedes?.nombre||'—'}</span>
              <div style={{display:'flex',justifyContent:'flex-end'}}>
                {u.activo&&(
                  <IconBtn icon={<Ico.Trash s={13}/>} danger onClick={()=>disable(u)}/>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={modal} onClose={()=>{setModal(false);setErr('');}} title="Crear usuario" maxWidth={420}>
        <Field label="Nombre completo">
          <TInput value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}
            placeholder="Ej: María García" focusOnMount/>
        </Field>
        <Field label="Código de acceso" hint="Con esto el usuario iniciará sesión. Ej: sta01, maria.g, adm">
          <TInput value={form.codigo} onChange={e=>setForm(f=>({...f,codigo:e.target.value.toLowerCase()}))}
            placeholder="Ej: sta01"/>
        </Field>
        <Field label="Contraseña (mínimo 6 caracteres)">
          <TInput type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}
            placeholder="Contraseña segura"/>
        </Field>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Field label="Rol">
            <TSelect value={form.rol} onChange={e=>setForm(f=>({...f,rol:e.target.value,sedeId:''}))}
              options={['tecnico','admin']}/>
          </Field>
          {form.rol==='tecnico'&&(
            <Field label="Sede asignada">
              <select value={form.sedeId} onChange={e=>setForm(f=>({...f,sedeId:e.target.value}))}
                style={{width:'100%',padding:'8px 11px',border:`1px solid ${T.border}`,borderRadius:8,
                  fontFamily:'inherit',fontSize:13,color:T.hi,background:'#F8FAFB',
                  outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
                <option value="">Seleccionar...</option>
                {sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Field>
          )}
        </div>
        {err&&<div style={{background:T.critBg,borderRadius:8,padding:'10px 12px',
          fontSize:12.5,color:T.crit,marginBottom:12}}>{err}</div>}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <Btn variant="secondary" onClick={()=>{setModal(false);setErr('');}}>Cancelar</Btn>
          <Btn onClick={create} disabled={saving} icon={<Ico.Plus s={14}/>}>
            {saving?'Creando...':'Crear usuario'}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PANTALLA: LOGIN
═══════════════════════════════════════════════════════════ */
const DOMAIN = '@labstock.gt';
const toEmail = c => c.trim().toLowerCase() + DOMAIN;

function LoginScreen() {
  const {signIn}=useAuth();
  const [codigo,setCodigo]=useState('');
  const [password,setPassword]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  const login=async(e)=>{
    e.preventDefault();
    if(!codigo.trim()||!password.trim()){setError('Ingresa tu código y contraseña.');return;}
    setLoading(true); setError('');
    const {error:err}=await signIn(toEmail(codigo),password);
    setLoading(false);
    if(err) setError(
      err.message==='Invalid login credentials'
        ?'Código o contraseña incorrectos.'
        :err.message.includes('fetch')
        ?'Sin conexión. Verifica que el .env tiene las credenciales de Supabase.'
        :err.message
    );
  };

  return (
    <div style={{minHeight:'100vh',background:T.canvas,display:'flex',
      alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:T.surface,borderRadius:16,padding:'40px 36px',width:'100%',maxWidth:380,
        boxShadow:'0 20px 60px rgba(0,0,0,0.12)',border:`1px solid ${T.border}`}}>

        <div style={{textAlign:'center',marginBottom:32}}>
          <img src={logoTeal} alt="" style={{width:52,height:52,objectFit:'contain',marginBottom:12}}/>
          <div style={{fontSize:22,fontWeight:700,color:T.hi,letterSpacing:'-0.025em'}}>LabStock</div>
          <div style={{fontSize:12.5,color:T.lo,marginTop:4}}>Laboratorio Clínico Los Ángeles</div>
        </div>

        <form onSubmit={login}>
          <Field label="Código de acceso">
            <TInput value={codigo}
              onChange={e=>{setCodigo(e.target.value.toLowerCase());setError('');}}
              placeholder="Ej: sta01 · adm · maria.garcia" focusOnMount/>
          </Field>
          <Field label="Contraseña">
            <TInput type="password" value={password}
              onChange={e=>{setPassword(e.target.value);setError('');}}
              placeholder="••••••••"/>
          </Field>

          {error&&(
            <div style={{background:T.critBg,borderRadius:8,padding:'10px 12px',
              fontSize:12.5,color:T.crit,marginBottom:14}}>{error}</div>
          )}

          <button type="submit" disabled={loading}
            style={{width:'100%',padding:'11px 16px',background:loading?T.tealL:T.teal,
              color:'#fff',border:'none',borderRadius:8,fontFamily:'inherit',fontSize:14,
              fontWeight:600,cursor:loading?'not-allowed':'pointer',
              transition:'background 0.15s',marginTop:4}}>
            {loading?'Ingresando...':'Iniciar sesión'}
          </button>
        </form>

        <p style={{textAlign:'center',fontSize:11,color:T.lo,marginTop:20,lineHeight:1.5}}>
          Sistema de gestión de inventario<br/>
          Acceso restringido al personal autorizado
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════════════════════ */
export default function App() {
  const {session,profile,sedes,loading:authLoading,signOut}=useAuth();

  const [items,setItems]     = useState([]);
  const [itemsBySede,setIBS] = useState({});
  const [view,setView]       = useState("inicio");
  const [modal,setModal]     = useState(null);
  const [sel,setSel]         = useState(null);
  const [filter,setFilter]   = useState({search:"",status:"Todos"});
  const [dbLoading,setDbL]   = useState(false);
  const [selectedSede,setSede] = useState(null);

  const isAdmin = profile?.rol==='admin';
  const currentSedeId = isAdmin ? selectedSede : profile?.sede_id;
  const currentSedeName = sedes.find(s=>s.id===currentSedeId)?.nombre || (isAdmin&&!currentSedeId?null:profile?.sedes?.nombre);

  /* ── Cargar items de Supabase ─────────────────────────── */
  const loadItems = useCallback(async()=>{
    if(!profile) return;
    setDbL(true);
    let q = supabase.from('items').select('*').eq('activo',true).order('nombre');
    if(currentSedeId) q=q.eq('sede_id',currentSedeId);
    const {data,error}=await q;
    if(!error) setItems((data||[]).map(fromDB));
    setDbL(false);
  },[profile,currentSedeId]);

  /* Cargar todos los items por sede para la vista global del admin */
  const loadAllBySede = useCallback(async()=>{
    if(!isAdmin||currentSedeId) return;
    const {data}=await supabase.from('items').select('*').eq('activo',true);
    if(data){
      const map={};
      data.forEach(r=>{ if(!map[r.sede_id]) map[r.sede_id]=[]; map[r.sede_id].push(fromDB(r)); });
      setIBS(map);
    }
  },[isAdmin,currentSedeId]);

  useEffect(()=>{ if(profile){loadItems();loadAllBySede();} },[profile,currentSedeId]);

  /* ── Realtime subscription ───────────────────────────── */
  useEffect(()=>{
    if(!profile) return;
    const ch=supabase.channel('items-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'items'},()=>{
        loadItems(); loadAllBySede();
      })
      .subscribe();
    return ()=>supabase.removeChannel(ch);
  },[profile,currentSedeId]);

  /* ── Badge de alertas ────────────────────────────────── */
  const alertCount=useMemo(()=>items.filter(i=>getStatus(i)!=='ok').length,[items]);

  useEffect(()=>{
    if(!profile) return;
    document.title=alertCount>0?`⚠️ LabStock (${alertCount})`:'LabStock — Lab. Clínico Los Ángeles';
    if(window.electronAPI){
      window.electronAPI.updateAlertBadge(alertCount);
    }
  },[alertCount,profile]);

  /* ── Filtered items ──────────────────────────────────── */
  const filtered=useMemo(()=>items.filter(i=>{
    const q=filter.search.toLowerCase();
    if(q&&!i.name.toLowerCase().includes(q)&&!i.category.toLowerCase().includes(q)) return false;
    if(filter.status==='Todos') return true;
    const st=getStatus(i);
    if(filter.status==='crit') return st==='crit'||st==='out';
    return st===filter.status;
  }),[items,filter]);

  const close=()=>{setModal(null);setSel(null);};

  /* ── CRUD handlers ───────────────────────────────────── */
  const handleAdd=async(data)=>{
    const sedeId = data.sedeId || currentSedeId;
    const sedeName = sedes.find(s=>s.id===sedeId)?.nombre || currentSedeName;
    if(!sedeId){alert('Selecciona una sede.');return;}
    const {data:row,error}=await supabase.from('items').insert(toDB(data,sedeId,profile.id)).select().single();
    if(error){alert('Error al guardar: '+error.message);return;}
    await logAct(sedeId,sedeName,row.id,data.name,profile.id,profile.nombre,'agregar',undefined,data.current,null);
    loadItems(); close();
  };

  const handleEdit=async(data)=>{
    const {error}=await supabase.from('items').update({
      nombre:data.name.trim(), categoria:data.category, unidad:data.unit,
      cantidad_actual:Number(data.current), cantidad_minima:Number(data.minimum), cantidad_maxima:Number(data.maximum),
    }).eq('id',sel.id);
    if(error){alert('Error al editar: '+error.message);return;}
    await logAct(currentSedeId,currentSedeName,sel.id,data.name,profile.id,profile.nombre,'editar',sel.current,data.current,null);
    loadItems(); close();
  };

  const handleUpdateStock=async(qty,note)=>{
    const {error}=await supabase.from('items').update({cantidad_actual:qty}).eq('id',sel.id);
    if(error){alert('Error: '+error.message);return;}
    await logAct(currentSedeId,currentSedeName,sel.id,sel.name,profile.id,profile.nombre,'actualizar',sel.current,qty,note);
    loadItems(); close();
  };

  const handleDelete=async()=>{
    const {error}=await supabase.from('items').update({activo:false}).eq('id',sel.id);
    if(error){alert('Error: '+error.message);return;}
    await logAct(currentSedeId,currentSedeName,sel.id,sel.name,profile.id,profile.nombre,'eliminar',sel.current,null,null);
    loadItems(); close();
  };

  const handleImport=async(rows)=>{
    if(!currentSedeId){alert('Selecciona una sede antes de importar.');return;}
    const inserts=rows.map(r=>({...toDB(r,currentSedeId,profile.id)}));
    const {error}=await supabase.from('items').insert(inserts);
    if(error){alert('Error al importar: '+error.message);return;}
    await logAct(currentSedeId,currentSedeName,null,`${rows.length} insumos`,profile.id,profile.nombre,'importar',undefined,rows.length,null);
    loadItems();
  };

  const handleExport=async()=>{
    const csv=itemsToCSV(items);
    const name=`labstock-${currentSedeName||'inventario'}-${new Date().toISOString().split('T')[0]}.csv`;
    if(window.electronAPI?.saveFile){
      await window.electronAPI.saveFile({defaultPath:name,content:csv});
    } else {
      const a=document.createElement('a');
      a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
      a.download=name; a.click();
    }
    await logAct(currentSedeId,currentSedeName,null,'Exportación CSV',profile.id,profile.nombre,'exportar',undefined,items.length,null);
  };

  /* ── Pantallas ───────────────────────────────────────── */
  if(authLoading) return (
    <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:T.canvas}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:48,height:48,borderRadius:12,background:T.tealXL,display:'flex',
          alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
          <Ico.Box s={26} c={T.teal}/>
        </div>
        <p style={{color:T.teal,fontWeight:700,fontSize:14}}>Cargando LabStock...</p>
      </div>
    </div>
  );

  if(!session||!profile) return <LoginScreen/>;

  return (
    <div className="app-shell">
      <TitleBar profile={profile} sedeName={currentSedeName} onSignOut={signOut}/>
      <div className="app-body">
        <Sidebar view={view} onNav={setView} alertCount={alertCount}
          profile={profile} sedes={sedes}
          selectedSede={selectedSede} onSedeChange={setSede}/>
        <main className="main-content">
          {dbLoading&&(
            <div style={{position:'fixed',top:36,right:16,background:T.teal,color:'#fff',
              padding:'5px 12px',borderRadius:20,fontSize:11.5,zIndex:100}}>
              Sincronizando...
            </div>
          )}
          {view==="inicio"&&(
            <InicioScreen items={items} onGoAlerts={()=>setView("alertas")}
              onReport={()=>setModal("report")} sedeName={currentSedeName}
              isAdmin={isAdmin} sedes={sedes} itemsBySede={itemsBySede}/>
          )}
          {view==="inventario"&&(
            <InventarioScreen items={items} filter={filter} setFilter={setFilter} filtered={filtered}
              canEdit={!!(currentSedeId||isAdmin)}
              onAdd={()=>setModal("add")}
              onEdit={i=>{setSel(i);setModal("edit");}}
              onUpdate={i=>{setSel(i);setModal("update");}}
              onDelete={i=>{setSel(i);setModal("delete");}}
              onImport={()=>setModal("import")}
              onExport={handleExport}/>
          )}
          {view==="alertas"&&(
            <AlertasScreen items={items}
              onUpdate={i=>{setSel(i);setModal("update");}}
              onReport={()=>setModal("report")}/>
          )}
          {view==="actividad"&&(
            <ActividadScreen sedeId={currentSedeId} isAdmin={isAdmin}/>
          )}
          {view==="usuarios"&&isAdmin&&(
            <UsuariosScreen sedes={sedes}/>
          )}
        </main>
      </div>

      <Modal open={modal==="add"} onClose={close} title="Agregar insumo" maxWidth={500}>
        <ItemFormModal onSave={handleAdd} onClose={close}
          sedes={isAdmin?sedes:[]} initialSedeId={currentSedeId}/>
      </Modal>
      <Modal open={modal==="edit"&&!!sel} onClose={close} title="Editar insumo">
        {sel&&<ItemFormModal initial={sel} onSave={handleEdit} onClose={close}/>}
      </Modal>
      <Modal open={modal==="update"&&!!sel} onClose={close} title="Actualizar stock" maxWidth={420}>
        {sel&&<UpdateStockModal item={sel} onSave={handleUpdateStock} onClose={close}/>}
      </Modal>
      <Modal open={modal==="delete"&&!!sel} onClose={close} title="Confirmar eliminación" maxWidth={400}>
        {sel&&<DeleteModal item={sel} onDelete={handleDelete} onClose={close}/>}
      </Modal>
      <Modal open={modal==="report"} onClose={close} title="Reporte para jefatura">
        {<ReportModal items={items} sedeName={currentSedeName} onClose={close}/>}
      </Modal>
      <Modal open={modal==="import"} onClose={close} title="Importar inventario desde CSV" maxWidth={500}>
        <ImportModal onImport={handleImport} onClose={close}/>
      </Modal>
    </div>
  );
}
