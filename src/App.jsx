import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import logoTeal from "./assets/logo-icon-teal.png";
import { supabase } from "./lib/supabase";
import { useAuth } from "./contexts/AuthContext";
import { useTheme } from "./contexts/ThemeContext";
import { useOnline } from "./contexts/OnlineContext";
import { T, Ico, Btn, IconBtn, Modal, Field, TInput, TSelect, StatCard } from "./shared/ui";
import { CajaScreen } from "./features/caja/CajaScreen";
import { HistorialCajaScreen } from "./features/caja/HistorialCajaScreen";
import { AuditorDashboard } from "./features/caja/AuditorDashboard";
import { ComprasScreen } from "./features/compras/ComprasScreen";
import { GastosFijosScreen } from "./features/admin/GastosFijosScreen";
import { AnalisisFinancieroScreen } from "./features/admin/AnalisisFinancieroScreen";
import { InicioScreen } from "./features/inicio/InicioScreen";

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
const CAT_PREFIX = {
  "Reactivos":"REA", "Consumibles desechables":"CON", "Material de vidrio":"VID",
  "Controles y calibradores":"CAL", "Equipos y accesorios":"EQU",
  "Papelería y formularios":"PAP", "Soluciones y buffer":"SOL", "Otros":"OTR",
};

const fromDB = r => ({
  id: r.id, code: r.codigo||'', name: r.nombre, category: r.categoria, unit: r.unidad,
  current: r.cantidad_actual, minimum: r.cantidad_minima, maximum: r.cantidad_maxima,
  lastUpdated: r.updated_at, sede_id: r.sede_id,
});
const toDB = (item, sedeId, userId) => ({
  codigo: item.code||null, nombre: item.name.trim(), categoria: item.category, unidad: item.unit,
  cantidad_actual: Number(item.current), cantidad_minima: Number(item.minimum),
  cantidad_maxima: Number(item.maximum), sede_id: sedeId, created_by: userId,
});

/* ── PEDIDOS ─────────────────────────────────────────────── */
const SANTA_LUCIA_NAME = 'Santa Lucía';
const ORDER_STATUS = {
  pendiente:  { label:'Pendiente',   c:'#B07400', bg:'#FFF0D0' },
  en_proceso: { label:'En proceso',  c:'#1D4ED8', bg:'#EEF2FF' },
  enviado:    { label:'Enviado',     c:'#7C3AED', bg:'#F5F3FF' },
  recibido:   { label:'Recibido',    c:T.ok,      bg:T.okBg    },
  cancelado:  { label:'Cancelado',   c:T.lo,      bg:T.outBg   },
};

async function generateOrderRef() {
  const {data}=await supabase.from('pedidos').select('referencia').like('referencia','PED-%');
  let max=0;
  (data||[]).forEach(r=>{
    const n=parseInt(r.referencia?.split('-')[1]||'0');
    if(!isNaN(n)&&n>max) max=n;
  });
  return `PED-${String(max+1).padStart(4,'0')}`;
}

async function generateCode(category) {
  const prefix = CAT_PREFIX[category] || 'OTR';
  const { data } = await supabase.rpc('next_item_code', { cat_prefix: prefix });
  return data || `${prefix}-0001`;
}

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
const CSV_COLS = 'codigo,nombre,categoria,unidad,cantidad_actual,cantidad_minima,cantidad_maxima';

function itemsToCSV(items) {
  const rows = items.map(i =>
    `"${i.code||''}","${i.name}","${i.category}","${i.unit}",${i.current},${i.minimum},${i.maximum}`
  );
  return `${BOM}${CSV_SEP}\r\n${CSV_COLS}\r\n${rows.join('\r\n')}`;
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


function TitleBar({profile, sedeName, onSignOut}) {
  const [hovLogout,setHovLogout]=useState(false);
  const [hovTheme,setHovTheme]=useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { isOnline, syncing, pendingOps } = useOnline();

  return (
    <div style={{height:34,flexShrink:0,background:'var(--bg-titlebar)',borderBottom:`1px solid ${T.border}`,
      display:'flex',alignItems:'center',padding:'0 12px',
      userSelect:'none',WebkitAppRegion:'drag',position:'relative'}}>
      <span style={{position:'absolute',left:'50%',transform:'translateX(-50%)',
        fontSize:12,color:T.mid,letterSpacing:'0.015em',fontWeight:500,pointerEvents:'none'}}>
        {sedeName ? `${sedeName} — LabStock` : 'LabStock — Lab. Clínico Los Ángeles'}
      </span>
      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,WebkitAppRegion:'no-drag'}}>
        {profile && (
          <span style={{fontSize:12,color:T.mid,fontWeight:500,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {profile.nombre}
          </span>
        )}
        <button onClick={toggleTheme}
          onMouseEnter={()=>setHovTheme(true)} onMouseLeave={()=>setHovTheme(false)}
          title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          style={{background:hovTheme?T.tealXL:'transparent',
            border:`1px solid ${hovTheme?T.tealL:T.border}`,
            cursor:'pointer',color:hovTheme?T.tealDk:T.lo,
            padding:'3px 8px',display:'flex',alignItems:'center',gap:5,
            borderRadius:6,fontFamily:'inherit',fontSize:12,fontWeight:500,
            transition:'all 0.15s',WebkitAppRegion:'no-drag'}}>
          {isDark ? <Ico.Sun s={13}/> : <Ico.Moon s={13}/>}
          <span>{isDark ? 'Claro' : 'Oscuro'}</span>
        </button>
        {onSignOut && (
          <button onClick={onSignOut}
            onMouseEnter={()=>setHovLogout(true)} onMouseLeave={()=>setHovLogout(false)}
            style={{background:hovLogout?T.critBg:'transparent',
              border:`1px solid ${hovLogout?T.crit:T.border}`,
              cursor:'pointer',color:hovLogout?T.crit:T.mid,padding:'3px 10px',
              display:'flex',alignItems:'center',gap:5,borderRadius:6,
              fontFamily:'inherit',fontSize:12,fontWeight:500,transition:'all 0.15s',
              WebkitAppRegion:'no-drag'}}>
            <Ico.LogOut s={13}/>
            <span>Salir</span>
          </button>
        )}
        {/* Semáforo: solo 1 encendido según estado */}
        {(() => {
          const dim = 'var(--border)';
          const isGreen  = isOnline && !syncing;
          const isYellow = syncing;
          const isRed    = !isOnline && !syncing;
          const label = isYellow
            ? `Sincronizando… (${pendingOps} pendiente${pendingOps>1?'s':''})`
            : isGreen ? 'En línea' : 'Sin conexión';
          return (
            <div title={label} style={{display:'flex',gap:5,alignItems:'center'}}>
              <div style={{width:11,height:11,borderRadius:'50%',
                background: isGreen ? T.ok : dim,
                boxShadow: isGreen ? `0 0 6px ${T.ok}` : 'none',
                transition:'background 0.4s, box-shadow 0.4s'}}/>
              <div style={{width:11,height:11,borderRadius:'50%',
                background: isYellow ? T.warn : dim,
                boxShadow: isYellow ? `0 0 6px ${T.warn}` : 'none',
                animation: isYellow ? 'pulse 1s infinite' : 'none',
                transition:'background 0.4s, box-shadow 0.4s'}}/>
              <div style={{width:11,height:11,borderRadius:'50%',
                background: isRed ? T.crit : dim,
                boxShadow: isRed ? `0 0 6px ${T.crit}` : 'none',
                transition:'background 0.4s, box-shadow 0.4s'}}/>
            </div>
          );
        })()}
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
        background:active?T.tealXL:hov?'var(--nav-hover)':'transparent',
        color:active?T.tealDk:hov?T.hi:T.mid,fontFamily:'inherit',fontSize:14,
        fontWeight:active?600:400,transition:'all 0.12s',textAlign:'left'}}>
      {active&&<span style={{position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',
        width:3,height:18,borderRadius:'0 2px 2px 0',background:T.teal}}/>}
      <Icon s={16} c={active?T.teal:undefined}/>
      <span style={{flex:1}}>{label}</span>
      {badge>0&&<span style={{minWidth:18,height:18,borderRadius:9,padding:'0 5px',
        background:T.crit,color:'#fff',fontSize:11,fontWeight:700,
        display:'flex',alignItems:'center',justifyContent:'center'}}>{badge}</span>}
    </button>
  );
}

function SectionLabel({label}) {
  return (
    <div style={{fontSize:11,fontWeight:700,color:T.lo,textTransform:'uppercase',
      letterSpacing:'0.07em',padding:'12px 10px 5px'}}>
      {label}
    </div>
  );
}

function Sidebar({view,onNav,alertCount,pedidosBadge,profile,sedes,selectedSede,onSedeChange}) {
  const isAdmin      = profile?.rol==='admin';
  const isAuditor    = profile?.rol==='auditor';
  const isTecnico    = profile?.rol==='tecnico';
  const isSecretaria = profile?.rol==='secretaria';
  const cajaPerm     = isAdmin || isAuditor || profile?.permisos?.caja===true;
  const bodegaPerm   = isAdmin || (isTecnico && profile?.permisos?.bodega!==false);
  const compraPerm   = isAdmin || isAuditor || isSecretaria;

  const navBodega = bodegaPerm && !isAuditor ? [
    {id:'resumen',    label:'Resumen',    Icon:Ico.Layers},
    {id:'inventario', label:'Inventario', Icon:Ico.Box},
    {id:'alertas',    label:'Alertas',    Icon:Ico.Bell,  badge:alertCount},
    {id:'pedidos',    label:'Pedidos',    Icon:Ico.Cart,  badge:pedidosBadge},
    {id:'actividad',  label:'Registro',   Icon:Ico.Activity},
  ] : isSecretaria ? [
    {id:'inventario', label:'Inventario', Icon:Ico.Box},
  ] : [];

  const navAdmin = isAdmin ? [
    {id:'usuarios',    label:'Usuarios',            Icon:Ico.Users},
    {id:'gastos_fijos',label:'Gastos Fijos',        Icon:Ico.Wallet},
    {id:'analisis',    label:'Análisis Financiero', Icon:Ico.TrendingUp},
  ] : isAuditor ? [
    {id:'gastos_fijos',label:'Gastos Fijos',        Icon:Ico.Wallet},
  ] : [];

  const navCaja = cajaPerm ? [
    ...(!isAuditor ? [{id:'caja_dia', label:'Cuadre del día', Icon:Ico.DollarSign}] : []),
    ...(isAuditor  ? [{id:'auditoria', label:'Resumen', Icon:Ico.BarChart}] : []),
    {id:'caja_historial', label:'Historial', Icon:Ico.History},
  ] : [];

  const navCompras = compraPerm ? [
    {id:'compras', label:'Registro de Compras', Icon:Ico.Receipt},
  ] : [];

  return (
    <aside style={{width:214,flexShrink:0,background:T.surface,
      borderRight:`1px solid ${T.border}`,display:'flex',flexDirection:'column'}}>
      <div style={{padding:'20px 16px 18px',borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <img src={logoTeal} alt="" style={{width:32,height:32,objectFit:'contain',flexShrink:0}}/>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:T.hi,letterSpacing:'-0.015em',lineHeight:1.2}}>LabStock</div>
            <div style={{fontSize:11.5,color:T.lo,marginTop:2}}>Los Ángeles</div>
          </div>
        </div>
      </div>

      {/* Selector de sede — solo admin (no auditor) */}
      {isAdmin && sedes.length>0 && (
        <div style={{padding:'10px 12px',borderBottom:`1px solid ${T.border}`}}>
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

      <nav style={{flex:1,padding:'4px 8px',overflowY:'auto'}}>
        <NavBtn id="inicio" label="Inicio" Icon={Ico.Home} badge={0}
          active={view==='inicio'} onNav={onNav}/>
        {navBodega.length>0 && (
          <>
            <SectionLabel label="Bodega"/>
            {navBodega.map(({id,label,Icon,badge})=>(
              <NavBtn key={id} id={id} label={label} Icon={Icon} badge={badge||0}
                active={view===id} onNav={onNav}/>
            ))}
          </>
        )}
        {navCaja.length>0 && (
          <>
            <SectionLabel label={isAuditor ? 'Auditoría' : 'Caja'}/>
            {navCaja.map(({id,label,Icon,badge})=>(
              <NavBtn key={id} id={id} label={label} Icon={Icon} badge={badge||0}
                active={view===id} onNav={onNav}/>
            ))}
          </>
        )}
        {navCompras.length>0 && (
          <>
            <SectionLabel label="Compras"/>
            {navCompras.map(({id,label,Icon,badge})=>(
              <NavBtn key={id} id={id} label={label} Icon={Icon} badge={badge||0}
                active={view===id} onNav={onNav}/>
            ))}
          </>
        )}
        {navAdmin.length>0 && (
          <>
            <SectionLabel label="Administración"/>
            {navAdmin.map(({id,label,Icon,badge})=>(
              <NavBtn key={id} id={id} label={label} Icon={Icon} badge={badge||0}
                active={view===id} onNav={onNav}/>
            ))}
          </>
        )}
      </nav>

      <div style={{padding:'10px 16px 14px',borderTop:`1px solid ${T.border}`}}>
        <div style={{fontSize:12.5,fontWeight:600,color:T.mid,marginBottom:2}}>{profile?.nombre}</div>
        <div style={{fontSize:11.5,color:T.lo}}>
          {isAdmin ? '⚑ Administrador' : isAuditor ? '◎ Auditor' : isSecretaria ? '✦ Secretaria' : profile?.sedes?.nombre || 'Técnico'}
        </div>
      </div>

      {/* Sello de desarrollo */}
      <div style={{
        padding:'7px 16px 10px',
        borderTop:`1px solid ${T.border}`,
        display:'flex', alignItems:'center', justifyContent:'center', gap:5,
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke={T.tealDk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        <span style={{fontSize:10.5, color:T.mid, letterSpacing:'0.03em'}}>
          Desarrollado por
        </span>
        <span style={{fontSize:11, fontWeight:800, letterSpacing:'0.07em', color:T.tealDk}}>
          TELOXIS
        </span>
      </div>
    </aside>
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
              borderRadius:8,fontFamily:'inherit',fontSize:13,color:T.hi,background:'var(--input-bg)',
              outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
            <option value="">Seleccionar sede...</option>
            {sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </Field>
      )}
      {/* Código — solo lectura al editar, oculto al agregar (se genera al guardar) */}
      {initial?.code&&(
        <div style={{background:'#F0FAFA',border:`1px solid ${T.tealL}`,borderRadius:8,
          padding:'8px 12px',marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:10.5,fontWeight:700,color:T.lo,textTransform:'uppercase',
            letterSpacing:'0.06em'}}>Código</span>
          <span style={{fontFamily:'monospace',fontSize:14,fontWeight:700,color:T.tealDk,
            letterSpacing:'0.05em'}}>{initial.code}</span>
          <span style={{fontSize:11,color:T.lo,marginLeft:'auto'}}>No se puede modificar</span>
        </div>
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
    const template=`${BOM}${CSV_SEP}\r\n${CSV_COLS}\r\nGlucosa Enzimatica,Reactivos,frascos,4,5,20\r\nCreatinina,Reactivos,frascos,8,5,20`;
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
function ResumenBodegaScreen({items,onGoAlerts,onReport,sedeName,isAdmin,sedes,itemsBySede}) {
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
          <p style={{fontSize:13,color:T.lo,marginTop:4}}>{items.length} insumos registrados</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Btn variant="secondary" size="sm" icon={<Ico.Download s={13}/>} onClick={onExport}>Exportar</Btn>
          {canEdit&&<Btn variant="secondary" size="sm" icon={<Ico.Upload s={13}/>} onClick={onImport}>Importar</Btn>}
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
              borderRadius:8,fontFamily:'inherit',fontSize:13,color:T.hi,background:'var(--input-bg)',
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
        <div style={{display:'grid',gridTemplateColumns:'90px 2fr 1.1fr 0.7fr 0.55fr 1fr 84px',
          padding:'8px 18px',borderBottom:`1px solid ${T.border}`,background:'var(--table-head-bg)'}}>
          {['Código','Insumo','Categoría','Stock','Mín.','Estado',''].map((h,i)=>(
            <span key={i} style={{fontSize:11,fontWeight:700,color:T.lo,
              textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</span>
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
              style={{display:'grid',gridTemplateColumns:'90px 2fr 1.1fr 0.7fr 0.55fr 1fr 84px',
                padding:'12px 18px',alignItems:'center',
                borderBottom:i<filtered.length-1?`1px solid ${T.border}`:'none',transition:'background 0.1s'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--row-hover)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <span style={{fontFamily:'monospace',fontSize:11.5,fontWeight:700,
                color:item.code?T.tealDk:T.border,letterSpacing:'0.04em'}}>
                {item.code||'—'}
              </span>
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
                {canEdit&&<IconBtn icon={<Ico.Sliders s={13}/>} onClick={()=>onUpdate(item)}/>}
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
          <p style={{fontSize:13,color:T.lo,marginTop:4}}>
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
        <p style={{fontSize:13,color:T.lo,marginTop:4}}>Historial de cambios en inventario</p>
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
            padding:'8px 18px',borderBottom:`1px solid ${T.border}`,background:'var(--table-head-bg)'}}>
            {['Fecha','Insumo','Usuario','Acción','Cambio','Nota/Sede'].map((h,i)=>(
              <span key={i} style={{fontSize:11,fontWeight:700,color:T.lo,
                textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</span>
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
                background:i%2===0?'transparent':'var(--row-stripe)'}}>
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
  const [users,setUsers]     = useState([]);
  const [loading,setLoading] = useState(true);
  const [modal,setModal]     = useState(false);
  const [editModal,setEditModal] = useState(null); // user object or null
  const [toast,setToast]     = useState('');
  const [form,setForm]       = useState({nombre:'',codigo:'',password:'',rol:'tecnico',sedeId:'',permBodega:true,permCaja:false});
  const [editForm,setEditForm] = useState({nombre:'',rol:'tecnico',sedeId:'',permBodega:true,permCaja:false});
  const [saving,setSaving]   = useState(false);
  const [err,setErr]         = useState('');
  const [editErr,setEditErr] = useState('');

  const load=()=>{
    supabase.from('profiles').select('*,sedes(nombre)').order('created_at')
      .then(({data})=>{setUsers(data||[]);setLoading(false);});
  };
  useEffect(()=>load(),[]);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(''),3000);};

  const openEdit=(u)=>{
    setEditErr('');
    setEditForm({
      nombre:    u.nombre||'',
      rol:       u.rol||'tecnico',
      sedeId:    u.sede_id||'',
      permBodega: u.permisos?.bodega!==false,
      permCaja:   u.permisos?.caja===true,
    });
    setEditModal(u);
  };

  const create=async()=>{
    setErr('');
    if(!form.nombre.trim()||!form.codigo.trim()||!form.password.trim()){
      setErr('Todos los campos son obligatorios.'); return;
    }
    if(!/^[a-z0-9._-]+$/i.test(form.codigo.trim())){
      setErr('El código solo puede tener letras, números, puntos y guiones.'); return;
    }
    if(form.password.length<6){setErr('La contraseña debe tener al menos 6 caracteres.'); return;}
    if((form.rol==='tecnico'||form.rol==='secretaria')&&!form.sedeId){setErr('Selecciona la sede asignada.'); return;}
    setSaving(true);
    const emailInterno=form.codigo.trim().toLowerCase()+'@labstock.gt';
    const permisos=form.rol==='tecnico'
      ?{bodega:form.permBodega,caja:form.permCaja}
      :form.rol==='secretaria'
      ?{caja:form.permCaja}
      :null;
    const r=await window.electronAPI?.createUser({
      email:emailInterno, password:form.password, nombre:form.nombre,
      rol:form.rol,
      sedeId:(form.rol==='tecnico'||form.rol==='secretaria')?form.sedeId:null,
      permisos,
    });
    setSaving(false);
    if(r?.error){setErr(r.error);return;}
    setModal(false);
    setForm({nombre:'',codigo:'',password:'',rol:'tecnico',sedeId:'',permBodega:true,permCaja:false});
    load();
    showToast('✅ Usuario creado correctamente');
  };

  const update=async()=>{
    setEditErr('');
    if(!editForm.nombre.trim()){setEditErr('El nombre es obligatorio.');return;}
    if((editForm.rol==='tecnico'||editForm.rol==='secretaria')&&!editForm.sedeId){setEditErr('Selecciona la sede asignada.');return;}
    setSaving(true);
    const permisos=editForm.rol==='tecnico'
      ?{bodega:editForm.permBodega,caja:editForm.permCaja}
      :editForm.rol==='secretaria'
      ?{caja:editForm.permCaja}
      :null;
    const r=await window.electronAPI?.updateUser({
      userId:  editModal.id,
      nombre:  editForm.nombre,
      rol:     editForm.rol,
      sedeId:  (editForm.rol==='tecnico'||editForm.rol==='secretaria')?editForm.sedeId:null,
      permisos,
    });
    setSaving(false);
    if(r?.error){setEditErr(r.error);return;}
    setEditModal(null);
    load();
    showToast('✅ Usuario actualizado');
  };

  const disable=async(u)=>{
    if(!window.confirm(`¿Deshabilitar a ${u.nombre}?`)) return;
    const r=await window.electronAPI?.disableUser(u.id);
    if(r?.error){showToast('❌ '+r.error);return;}
    load();
    showToast('Usuario deshabilitado');
  };

  const rolBadge=rol=>({
    admin:     {bg:'#EEF2FF',c:'#3730A3',label:'Admin'},
    tecnico:   {bg:T.tealXL, c:T.tealDk, label:'Técnico'},
    auditor:   {bg:'#F0FDF4',c:'#15803D', label:'Auditor'},
    secretaria:{bg:'#FDF4FF',c:'#7E22CE', label:'Secretaria'},
  }[rol]||{bg:T.canvas,c:T.mid,label:rol});

  const RolInfo = ({rol}) => {
    if(rol==='auditor') return (
      <div style={{background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:8,
        padding:'9px 12px',fontSize:12.5,color:'#15803D',marginBottom:6}}>
        El auditor tiene acceso de solo lectura al módulo de Caja y Compras en todas las sedes.
      </div>
    );
    if(rol==='admin') return (
      <div style={{background:'#EEF2FF',border:'1px solid #A5B4FC',borderRadius:8,
        padding:'9px 12px',fontSize:12.5,color:'#3730A3',marginBottom:6}}>
        El administrador tiene acceso completo a todas las sedes y módulos.
      </div>
    );
    if(rol==='secretaria') return (
      <div style={{background:'#FDF4FF',border:'1px solid #E9D5FF',borderRadius:8,
        padding:'9px 12px',fontSize:12.5,color:'#7E22CE',marginBottom:6}}>
        La secretaria registra facturas de compras. Solo disponible en sedes habilitadas (La Gomera y Santa Lucía). El acceso a Caja es opcional.
      </div>
    );
    return null;
  };

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
          <p style={{fontSize:13,color:T.lo,marginTop:4}}>{users.length} usuario(s) registrados</p>
        </div>
        <Btn icon={<Ico.Plus s={14}/>} onClick={()=>setModal(true)}>Agregar usuario</Btn>
      </div>

      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1.5fr 80px 1fr 72px',
          padding:'8px 18px',borderBottom:`1px solid ${T.border}`,background:'var(--table-head-bg)'}}>
          {['Nombre','Código acceso','Rol','Sede',''].map((h,i)=>(
            <span key={i} style={{fontSize:11,fontWeight:700,color:T.lo,textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</span>
          ))}
        </div>
        {loading?(
          <div style={{padding:'40px 20px',textAlign:'center',color:T.lo}}>Cargando...</div>
        ):users.map((u,i)=>{
          const rb=rolBadge(u.rol);
          return (
            <div key={u.id}
              style={{display:'grid',gridTemplateColumns:'1fr 1.5fr 80px 1fr 72px',
                padding:'12px 18px',alignItems:'center',
                borderBottom:i<users.length-1?`1px solid ${T.border}`:'none',
                opacity:u.activo?1:0.45}}>
              <span style={{fontWeight:500,color:T.hi,fontSize:13}}>{u.nombre}</span>
              <span style={{fontSize:12,color:T.mid,fontFamily:'monospace'}}>{u.codigo||'—'}</span>
              <span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',
                borderRadius:20,background:rb.bg,color:rb.c,fontSize:11,fontWeight:600}}>{rb.label}</span>
              <span style={{fontSize:12,color:T.mid}}>{u.sedes?.nombre||'—'}</span>
              <div style={{display:'flex',gap:2,justifyContent:'flex-end'}}>
                {u.activo&&(
                  <IconBtn icon={<Ico.Edit s={13}/>} onClick={()=>openEdit(u)} title="Editar rol y permisos"/>
                )}
                {u.activo && u.machine_id && (
                  <IconBtn icon={<Ico.Unlock s={13}/>} title="Resetear dispositivo vinculado"
                    onClick={async()=>{
                      if(!window.confirm(`¿Resetear el dispositivo de ${u.nombre}? Podrá iniciar sesión desde cualquier PC una vez.`)) return;
                      const r = await window.electronAPI?.resetMachineId(u.id);
                      if(r?.error){ showToast('❌ '+r.error); return; }
                      load(); showToast('✅ Dispositivo reseteado — el usuario podrá registrar un nuevo equipo');
                    }}/>
                )}
                {u.activo&&(
                  <IconBtn icon={<Ico.Trash s={13}/>} danger onClick={()=>disable(u)}/>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Crear usuario */}
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
            <TSelect value={form.rol}
              onChange={e=>setForm(f=>({...f,rol:e.target.value,sedeId:'',permBodega:true,permCaja:false}))}
              options={[
                {value:'tecnico',    label:'Técnico'},
                {value:'secretaria', label:'Secretaria'},
                {value:'admin',      label:'Administrador'},
                {value:'auditor',    label:'Auditor'},
              ]}/>
          </Field>
          {(form.rol==='tecnico'||form.rol==='secretaria')&&(
            <Field label="Sede asignada">
              <select value={form.sedeId} onChange={e=>setForm(f=>({...f,sedeId:e.target.value}))}
                style={{width:'100%',padding:'8px 11px',border:`1px solid ${T.border}`,borderRadius:8,
                  fontFamily:'inherit',fontSize:13,color:T.hi,background:'var(--input-bg)',
                  outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
                <option value="">Seleccionar...</option>
                {(form.rol==='secretaria'?sedes.filter(s=>s.permite_compras):sedes)
                  .map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Field>
          )}
        </div>
        {form.rol==='tecnico'&&(
          <Field label="Permisos de acceso">
            <div style={{display:'flex',gap:20,padding:'8px 0'}}>
              {[{key:'permBodega',label:'Acceso a Bodega'},{key:'permCaja',label:'Acceso a Caja'}].map(({key,label})=>(
                <label key={key} style={{display:'flex',alignItems:'center',gap:7,fontSize:13,color:T.hi,cursor:'pointer'}}>
                  <input type="checkbox" checked={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.checked}))}
                    style={{width:15,height:15,accentColor:T.teal,cursor:'pointer'}}/>
                  {label}
                </label>
              ))}
            </div>
          </Field>
        )}
        {form.rol==='secretaria'&&(
          <Field label="Permisos adicionales">
            <div style={{display:'flex',gap:20,padding:'8px 0'}}>
              <label style={{display:'flex',alignItems:'center',gap:7,fontSize:13,color:T.mid,cursor:'default'}}>
                <input type="checkbox" checked readOnly disabled
                  style={{width:15,height:15,accentColor:T.teal,cursor:'default'}}/>
                Acceso a Compras (siempre activo)
              </label>
              <label style={{display:'flex',alignItems:'center',gap:7,fontSize:13,color:T.hi,cursor:'pointer'}}>
                <input type="checkbox" checked={form.permCaja} onChange={e=>setForm(f=>({...f,permCaja:e.target.checked}))}
                  style={{width:15,height:15,accentColor:T.teal,cursor:'pointer'}}/>
                Acceso a Caja
              </label>
            </div>
          </Field>
        )}
        <RolInfo rol={form.rol}/>
        {err&&<div style={{background:T.critBg,borderRadius:8,padding:'10px 12px',fontSize:12.5,color:T.crit,marginBottom:12}}>{err}</div>}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <Btn variant="secondary" onClick={()=>{setModal(false);setErr('');}}>Cancelar</Btn>
          <Btn onClick={create} disabled={saving} icon={<Ico.Plus s={14}/>}>
            {saving?'Creando...':'Crear usuario'}
          </Btn>
        </div>
      </Modal>

      {/* Modal: Editar usuario */}
      <Modal open={!!editModal} onClose={()=>{setEditModal(null);setEditErr('');}} title="Editar usuario" maxWidth={420}>
        {editModal&&(
          <>
            <div style={{background:T.canvas,borderRadius:8,padding:'8px 12px',marginBottom:14,
              display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:11,color:T.lo}}>Código de acceso:</span>
              <span style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:T.tealDk}}>{editModal.codigo}</span>
            </div>
            <Field label="Nombre completo">
              <TInput value={editForm.nombre} onChange={e=>setEditForm(f=>({...f,nombre:e.target.value}))} focusOnMount/>
            </Field>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Field label="Rol">
                <TSelect value={editForm.rol}
                  onChange={e=>setEditForm(f=>({...f,rol:e.target.value,sedeId:'',permBodega:true,permCaja:false}))}
                  options={[
                    {value:'tecnico',    label:'Técnico'},
                    {value:'secretaria', label:'Secretaria'},
                    {value:'admin',      label:'Administrador'},
                    {value:'auditor',    label:'Auditor'},
                  ]}/>
              </Field>
              {(editForm.rol==='tecnico'||editForm.rol==='secretaria')&&(
                <Field label="Sede asignada">
                  <select value={editForm.sedeId} onChange={e=>setEditForm(f=>({...f,sedeId:e.target.value}))}
                    style={{width:'100%',padding:'8px 11px',border:`1px solid ${T.border}`,borderRadius:8,
                      fontFamily:'inherit',fontSize:13,color:T.hi,background:'var(--input-bg)',
                      outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
                    <option value="">Seleccionar...</option>
                    {(editForm.rol==='secretaria'?sedes.filter(s=>s.permite_compras):sedes)
                      .map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </Field>
              )}
            </div>
            {editForm.rol==='tecnico'&&(
              <Field label="Permisos de acceso">
                <div style={{display:'flex',gap:20,padding:'8px 0'}}>
                  {[{key:'permBodega',label:'Acceso a Bodega'},{key:'permCaja',label:'Acceso a Caja'}].map(({key,label})=>(
                    <label key={key} style={{display:'flex',alignItems:'center',gap:7,fontSize:13,color:T.hi,cursor:'pointer'}}>
                      <input type="checkbox" checked={editForm[key]} onChange={e=>setEditForm(f=>({...f,[key]:e.target.checked}))}
                        style={{width:15,height:15,accentColor:T.teal,cursor:'pointer'}}/>
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
            )}
            {editForm.rol==='secretaria'&&(
              <Field label="Permisos adicionales">
                <div style={{display:'flex',gap:20,padding:'8px 0'}}>
                  <label style={{display:'flex',alignItems:'center',gap:7,fontSize:13,color:T.mid,cursor:'default'}}>
                    <input type="checkbox" checked readOnly disabled
                      style={{width:15,height:15,accentColor:T.teal,cursor:'default'}}/>
                    Acceso a Compras (siempre activo)
                  </label>
                  <label style={{display:'flex',alignItems:'center',gap:7,fontSize:13,color:T.hi,cursor:'pointer'}}>
                    <input type="checkbox" checked={editForm.permCaja} onChange={e=>setEditForm(f=>({...f,permCaja:e.target.checked}))}
                      style={{width:15,height:15,accentColor:T.teal,cursor:'pointer'}}/>
                    Acceso a Caja
                  </label>
                </div>
              </Field>
            )}
            <RolInfo rol={editForm.rol}/>
            {editErr&&<div style={{background:T.critBg,borderRadius:8,padding:'10px 12px',fontSize:12.5,color:T.crit,marginBottom:12}}>{editErr}</div>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
              <Btn variant="secondary" onClick={()=>{setEditModal(null);setEditErr('');}}>Cancelar</Btn>
              <Btn onClick={update} disabled={saving} icon={<Ico.Check s={14}/>}>
                {saving?'Guardando...':'Guardar cambios'}
              </Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODAL: CARRITO DE PEDIDO
═══════════════════════════════════════════════════════════ */
function CartModal({items,sedes,currentSedeId,onSubmit,onClose}) {
  const [destino,setDestino]=useState('santa_lucia');
  const [nota,setNota]=useState('');
  const [selected,setSelected]=useState({});
  const [qtys,setQtys]=useState({});
  const [saving,setSaving]=useState(false);

  const santaLucia=sedes.find(s=>s.nombre===SANTA_LUCIA_NAME);

  const sortOrd={out:0,crit:1,warn:2,ok:3};
  const sorted=[...items].sort((a,b)=>sortOrd[getStatus(a)]-sortOrd[getStatus(b)]);

  useEffect(()=>{
    const initQ={}, initS={};
    items.forEach(i=>{
      initQ[i.id]=Math.max(1, i.maximum-i.current);
      if(['out','crit'].includes(getStatus(i))) initS[i.id]=true;
    });
    setQtys(initQ); setSelected(initS);
  },[]);

  const toggle=id=>setSelected(p=>({...p,[id]:!p[id]}));
  const setQty=(id,v)=>setQtys(p=>({...p,[id]:Math.max(1,parseInt(v)||1)}));
  const selectedList=sorted.filter(i=>selected[i.id]);

  const submit=async()=>{
    if(!selectedList.length){alert('Selecciona al menos un insumo.');return;}
    setSaving(true);
    await onSubmit({
      destino,
      santaLuciaId:santaLucia?.id||null,
      nota,
      items:selectedList.map(i=>({
        item_id:i.id, item_codigo:i.code||null,
        nombre_item:i.name, categoria:i.category, unidad:i.unit,
        cantidad_solicitada:qtys[i.id]||1,
      })),
    });
    setSaving(false);
  };

  return (
    <div>
      <div style={{marginBottom:16}}>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:T.mid,marginBottom:8}}>
          Destino del pedido
        </label>
        <div style={{display:'flex',gap:8}}>
          {[
            {id:'santa_lucia',label:'Almacén Santa Lucía',icon:<Ico.Inbox s={14}/>},
            {id:'externo',label:'Proveedor externo',icon:<Ico.Truck s={14}/>},
          ].map(d=>(
            <button key={d.id} onClick={()=>setDestino(d.id)}
              style={{flex:1,padding:'10px 12px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',
                border:`2px solid ${destino===d.id?T.teal:T.border}`,
                background:destino===d.id?T.tealXL:'transparent',
                color:destino===d.id?T.tealDk:T.mid,
                fontSize:13,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              {d.icon}{d.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:600,color:T.mid,marginBottom:8}}>
          Insumos a solicitar —
          <span style={{color:T.tealDk,fontWeight:700}}> {selectedList.length} seleccionados</span>
        </div>
        {sorted.length===0?(
          <div style={{background:T.canvas,borderRadius:8,padding:'20px',textAlign:'center',color:T.lo,fontSize:13}}>
            No hay insumos en esta sede
          </div>
        ):(
          <div style={{border:`1px solid ${T.border}`,borderRadius:8,maxHeight:280,overflowY:'auto'}}>
            {/* header */}
            <div style={{display:'grid',gridTemplateColumns:'32px 1fr 90px 80px',padding:'7px 12px',
              background:'var(--table-head-bg)',borderBottom:`1px solid ${T.border}`}}>
              {['','Insumo','Estado','Cant.'].map((h,i)=>(
                <span key={i} style={{fontSize:11,fontWeight:700,color:T.lo,textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</span>
              ))}
            </div>
            {sorted.map((item,i)=>{
              const isSel=!!selected[item.id];
              const st=getStatus(item);
              return (
                <div key={item.id} onClick={()=>toggle(item.id)}
                  style={{display:'grid',gridTemplateColumns:'32px 1fr 90px 80px',
                    padding:'9px 12px',alignItems:'center',gap:8,cursor:'pointer',
                    borderBottom:i<sorted.length-1?`1px solid ${T.border}`:'none',
                    background:isSel?'#F0FAFA':'transparent',transition:'background 0.1s'}}
                  onMouseEnter={e=>!isSel&&(e.currentTarget.style.background='#F6FAFB')}
                  onMouseLeave={e=>!isSel&&(e.currentTarget.style.background='transparent')}>
                  <input type="checkbox" checked={isSel} readOnly
                    style={{width:15,height:15,cursor:'pointer',accentColor:T.teal}}/>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:T.hi,lineHeight:1.2}}>{item.name}</div>
                    <div style={{fontSize:10.5,color:T.lo,marginTop:2}}>
                      {item.current}/{item.minimum} {item.unit}
                      {item.code&&<span style={{marginLeft:6,fontFamily:'monospace',color:T.tealDk}}>{item.code}</span>}
                    </div>
                  </div>
                  <StatusBadge status={st}/>
                  <input type="number" min={1} max={999} value={qtys[item.id]||1}
                    onClick={e=>e.stopPropagation()}
                    onChange={e=>{e.stopPropagation();setQty(item.id,e.target.value);}}
                    style={{width:'100%',padding:'5px 8px',border:`1px solid ${T.border}`,
                      borderRadius:6,fontFamily:'inherit',fontSize:12.5,color:T.hi,
                      background:T.surface,outline:'none',textAlign:'center',
                      opacity:isSel?1:0.35}}/>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Field label="Nota (opcional)">
        <TInput value={nota} onChange={e=>setNota(e.target.value)}
          placeholder="Ej: Urgente para fin de mes"/>
      </Field>

      <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:4}}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={submit} disabled={saving||!selectedList.length}
          icon={<Ico.Cart s={14}/>}>
          {saving?'Enviando...':`Enviar pedido (${selectedList.length} ítems)`}
        </Btn>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PEDIDO CARD
═══════════════════════════════════════════════════════════ */
function PedidoCard({pedido,expanded,onToggle,onUpdateStatus,canManageIncoming,currentSedeId,isAdmin,saving}) {
  const os=ORDER_STATUS[pedido.estado]||ORDER_STATUS.pendiente;
  const isOrigin=pedido.sede_origen_id===currentSedeId;
  const isExt=pedido.tipo==='externa';

  return (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:'hidden'}}>
      {/* Row */}
      <div onClick={onToggle}
        style={{display:'grid',gridTemplateColumns:'110px 1.4fr 1fr auto 22px',
          padding:'13px 18px',alignItems:'center',gap:12,cursor:'pointer',transition:'background 0.1s'}}
        onMouseEnter={e=>e.currentTarget.style.background='var(--row-hover)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <span style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:T.tealDk}}>{pedido.referencia}</span>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:T.hi}}>{pedido.sede_origen?.nombre||'—'}</div>
          <div style={{fontSize:11,color:T.lo,marginTop:2}}>
            {isExt?'Proveedor externo':`→ ${pedido.sede_destino?.nombre||SANTA_LUCIA_NAME}`}
          </div>
        </div>
        <div style={{fontSize:11.5,color:T.lo}}>{fmt(pedido.created_at)}</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 9px',
            borderRadius:20,background:os.bg,color:os.c,fontSize:11.5,fontWeight:600,whiteSpace:'nowrap'}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:os.c,flexShrink:0}}/>
            {os.label}
          </span>
          <span style={{fontSize:11,color:T.lo,whiteSpace:'nowrap'}}>
            {pedido.pedido_items?.length||0} ítems
          </span>
        </div>
        <span style={{color:T.lo,fontSize:9,display:'flex',alignItems:'center',justifyContent:'center',
          transform:expanded?'rotate(180deg)':'none',transition:'transform 0.2s'}}>▼</span>
      </div>

      {expanded&&(
        <div style={{borderTop:`1px solid ${T.border}`,padding:'14px 18px'}}>
          {/* Items */}
          <div style={{fontSize:10.5,fontWeight:700,color:T.lo,textTransform:'uppercase',
            letterSpacing:'0.07em',marginBottom:8}}>Insumos solicitados</div>
          <div style={{background:T.canvas,borderRadius:8,overflow:'hidden',marginBottom:12}}>
            {(pedido.pedido_items||[]).map((item,i)=>(
              <div key={item.id} style={{display:'grid',gridTemplateColumns:'80px 1fr 100px',
                padding:'9px 12px',alignItems:'center',gap:8,
                borderBottom:i<(pedido.pedido_items.length-1)?`1px solid ${T.border}`:'none'}}>
                <span style={{fontFamily:'monospace',fontSize:11.5,color:T.tealDk}}>{item.item_codigo||'—'}</span>
                <span style={{fontSize:13,fontWeight:500,color:T.hi}}>{item.nombre_item}</span>
                <span style={{fontSize:12.5,fontWeight:600,color:T.mid,textAlign:'right'}}>
                  {item.cantidad_solicitada} {item.unidad||''}
                </span>
              </div>
            ))}
          </div>

          {pedido.nota&&(
            <div style={{background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:8,
              padding:'8px 12px',marginBottom:12,fontSize:12.5,color:'#92400E'}}>
              Nota: {pedido.nota}
            </div>
          )}

          {/* Actions */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {/* Internal: Santa Lucía/admin toma el pedido */}
            {pedido.estado==='pendiente'&&canManageIncoming&&!isExt&&(
              <Btn size="sm" onClick={()=>onUpdateStatus('en_proceso')} disabled={saving}>Tomar pedido</Btn>
            )}
            {/* Internal: Santa Lucía/admin marca enviado */}
            {pedido.estado==='en_proceso'&&canManageIncoming&&!isExt&&(
              <Btn size="sm" onClick={()=>onUpdateStatus('enviado')} disabled={saving}
                icon={<Ico.Truck s={13}/>}>Marcar como enviado</Btn>
            )}
            {/* External: origin manages lifecycle */}
            {pedido.estado==='pendiente'&&isExt&&isOrigin&&(
              <Btn size="sm" onClick={()=>onUpdateStatus('en_proceso')} disabled={saving}>
                Pedido hecho al proveedor
              </Btn>
            )}
            {pedido.estado==='en_proceso'&&isExt&&isOrigin&&(
              <Btn size="sm" onClick={()=>onUpdateStatus('recibido')} disabled={saving}
                icon={<Ico.Check s={13}/>}>Confirmar recibo</Btn>
            )}
            {/* Origin confirms receipt of internal order */}
            {pedido.estado==='enviado'&&(isOrigin||isAdmin)&&(
              <Btn size="sm" onClick={()=>onUpdateStatus('recibido')} disabled={saving}
                icon={<Ico.Check s={13}/>}>Confirmar recibo</Btn>
            )}
            {/* Cancel: creator can cancel when pending */}
            {pedido.estado==='pendiente'&&(isOrigin||isAdmin)&&(
              <Btn size="sm" variant="danger" onClick={()=>onUpdateStatus('cancelado')} disabled={saving}>
                Cancelar
              </Btn>
            )}
            {/* Admin can cancel anything in-flight */}
            {isAdmin&&['en_proceso','enviado'].includes(pedido.estado)&&(
              <Btn size="sm" variant="danger" onClick={()=>onUpdateStatus('cancelado')} disabled={saving}>
                Cancelar
              </Btn>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PANTALLA: PEDIDOS
═══════════════════════════════════════════════════════════ */
function PedidosScreen({sedes,profile,isAdmin,currentSedeId,items,onShowCart}) {
  const [pedidos,setPedidos]=useState([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState('entrantes');
  const [expandedId,setExpandedId]=useState(null);
  const [saving,setSaving]=useState(false);

  const santaLuciaId=sedes.find(s=>s.nombre===SANTA_LUCIA_NAME)?.id;
  const isSantaLucia=currentSedeId===santaLuciaId;
  const canManageIncoming=isSantaLucia||isAdmin;

  const loadPedidos=async()=>{
    setLoading(true);
    const {data}=await supabase.from('pedidos').select(`
      *, pedido_items(*),
      sede_origen:sede_origen_id(id,nombre),
      sede_destino:sede_destino_id(id,nombre)
    `).order('created_at',{ascending:false});
    setPedidos(data||[]);
    setLoading(false);
  };

  useEffect(()=>{
    loadPedidos();
    const ch=supabase.channel('pedidos-rt-screen')
      .on('postgres_changes',{event:'*',schema:'public',table:'pedidos'},loadPedidos)
      .subscribe();
    return ()=>supabase.removeChannel(ch);
  },[]);

  /* Filter by tab */
  const miosPedidos=isAdmin
    ?pedidos
    :pedidos.filter(p=>p.sede_origen_id===currentSedeId);

  const entrantesPedidos=isAdmin
    ?pedidos.filter(p=>p.tipo==='interna')
    :pedidos.filter(p=>p.sede_destino_id===currentSedeId&&p.tipo==='interna');

  const pendingBadge=entrantesPedidos.filter(p=>['pendiente','en_proceso'].includes(p.estado)).length;
  const activeTab=canManageIncoming?tab:'mios';
  const displayed=activeTab==='entrantes'?entrantesPedidos:miosPedidos;

  /* Update status + auto-inventory */
  const updateStatus=async(pedido,newStatus)=>{
    setSaving(true);
    await supabase.from('pedidos')
      .update({estado:newStatus,updated_by:profile.id})
      .eq('id',pedido.id);

    /* Enviado (interno): descontar de Santa Lucía */
    if(newStatus==='enviado' && pedido.tipo==='interna'){
      for(const item of (pedido.pedido_items||[])){
        if(!item.item_codigo) continue;
        const {data:ex}=await supabase.from('items')
          .select('id,cantidad_actual')
          .eq('codigo',item.item_codigo)
          .eq('sede_id',pedido.sede_destino_id)
          .eq('activo',true)
          .maybeSingle();
        if(ex){
          const newQty=Math.max(0, ex.cantidad_actual - item.cantidad_solicitada);
          await supabase.from('items').update({cantidad_actual:newQty}).eq('id',ex.id);
          await logAct(
            pedido.sede_destino_id, pedido.sede_destino?.nombre||'',
            ex.id, item.nombre_item,
            profile.id, profile.nombre,
            'actualizar', ex.cantidad_actual, newQty,
            `Pedido ${pedido.referencia} despachado a ${pedido.sede_origen?.nombre}`
          );
        }
      }
    }

    /* Recibido: sumar stock a la sede que solicitó */
    if(newStatus==='recibido'){
      for(const item of (pedido.pedido_items||[])){
        if(!item.item_codigo) continue;
        const {data:ex}=await supabase.from('items')
          .select('id,cantidad_actual')
          .eq('codigo',item.item_codigo)
          .eq('sede_id',pedido.sede_origen_id)
          .eq('activo',true)
          .maybeSingle();
        if(ex){
          const newQty=ex.cantidad_actual+item.cantidad_solicitada;
          await supabase.from('items').update({cantidad_actual:newQty}).eq('id',ex.id);
          await logAct(
            pedido.sede_origen_id, pedido.sede_origen?.nombre||'',
            ex.id, item.nombre_item,
            profile.id, profile.nombre,
            'actualizar', ex.cantidad_actual, newQty,
            `Pedido ${pedido.referencia} recibido`
          );
        }
      }
    }
    loadPedidos();
    setSaving(false);
  };

  const isEmpty=displayed.length===0;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:21,fontWeight:700,color:T.hi,letterSpacing:'-0.025em',margin:0}}>Pedidos</h1>
          <p style={{fontSize:13,color:T.lo,marginTop:4}}>Sistema de reabastecimiento entre sedes</p>
        </div>
        {currentSedeId?(
          <Btn icon={<Ico.Cart s={14}/>} onClick={onShowCart}>Nuevo pedido</Btn>
        ):(
          <div style={{fontSize:12,color:T.lo,fontStyle:'italic'}}>Selecciona una sede para crear un pedido</div>
        )}
      </div>

      {/* Tabs */}
      {canManageIncoming&&(
        <div style={{display:'flex',gap:0,borderBottom:`1px solid ${T.border}`}}>
          {[{id:'entrantes',label:'Entrantes',badge:pendingBadge},{id:'mios',label:'Mis pedidos'}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:'9px 18px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',
                borderBottom:`2px solid ${tab===t.id?T.teal:'transparent'}`,marginBottom:-1,
                color:tab===t.id?T.tealDk:T.mid,fontSize:13.5,fontWeight:tab===t.id?600:400,
                display:'flex',alignItems:'center',gap:6}}>
              {t.label}
              {t.badge>0&&<span style={{minWidth:18,height:18,borderRadius:9,padding:'0 5px',
                background:T.crit,color:'#fff',fontSize:10.5,fontWeight:700,
                display:'flex',alignItems:'center',justifyContent:'center'}}>{t.badge}</span>}
            </button>
          ))}
        </div>
      )}

      {loading?(
        <div style={{textAlign:'center',padding:'48px 0',color:T.lo,fontSize:13}}>Cargando pedidos...</div>
      ):isEmpty?(
        <div style={{paddingTop:60,display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
          <div style={{width:54,height:54,borderRadius:'50%',background:T.tealXL,
            display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Ico.Cart s={24} c={T.teal}/>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:15,fontWeight:600,color:T.hi}}>Sin pedidos</div>
            <div style={{fontSize:13,color:T.lo,marginTop:4}}>
              {activeTab==='entrantes'?'No hay pedidos entrantes pendientes':'No tienes pedidos registrados'}
            </div>
          </div>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {displayed.map(p=>(
            <PedidoCard key={p.id} pedido={p}
              expanded={expandedId===p.id}
              onToggle={()=>setExpandedId(expandedId===p.id?null:p.id)}
              onUpdateStatus={s=>updateStatus(p,s)}
              canManageIncoming={canManageIncoming}
              currentSedeId={currentSedeId}
              isAdmin={isAdmin}
              saving={saving}/>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PANTALLA: DISPOSITIVO BLOQUEADO
═══════════════════════════════════════════════════════════ */
function DispositivoBloqueadoScreen({ onSignOut }) {
  return (
    <div style={{minHeight:'100vh',background:T.canvas,display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{background:T.surface,borderRadius:16,padding:'40px 36px',width:'100%',maxWidth:400,
        boxShadow:'0 20px 60px rgba(0,0,0,0.18)',border:`1px solid ${T.crit}44`,textAlign:'center'}}>
        <div style={{width:60,height:60,borderRadius:'50%',background:T.critBg,
          display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
          <Ico.Lock s={28} c={T.crit}/>
        </div>
        <div style={{fontSize:18,fontWeight:700,color:T.hi,marginBottom:8}}>
          Dispositivo no autorizado
        </div>
        <div style={{fontSize:13,color:T.mid,lineHeight:1.6,marginBottom:24}}>
          Tu usuario está registrado en otro dispositivo.<br/>
          Contacta al administrador para autorizar este equipo.
        </div>
        <button onClick={onSignOut}
          style={{width:'100%',padding:'10px 16px',background:T.critBg,color:T.crit,
            border:`1px solid ${T.crit}44`,borderRadius:8,fontFamily:'inherit',
            fontSize:13,fontWeight:600,cursor:'pointer'}}>
          Cerrar sesión
        </button>
        <div style={{marginTop:20,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke={T.tealDk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          <span style={{fontSize:11,color:T.lo}}>Desarrollado por </span>
          <span style={{fontSize:11,fontWeight:800,color:T.tealDk}}>TELOXIS</span>
        </div>
      </div>
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
  const { isDark, toggleTheme } = useTheme();
  const [codigo,setCodigo]=useState('');
  const [password,setPassword]=useState('');
  const [showPwd,setShowPwd]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [hovTheme,setHovTheme]=useState(false);

  const login=async(e)=>{
    e.preventDefault();
    if(!codigo.trim()){setError('Ingresa tu usuario.');return;}
    if(password.length<2){setError('La contraseña debe tener al menos 2 caracteres.');return;}
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
    <div style={{minHeight:'100vh',background:T.canvas,display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',padding:20,position:'relative'}}>

      {/* Botón de tema — esquina superior derecha */}
      <button onClick={toggleTheme}
        onMouseEnter={()=>setHovTheme(true)} onMouseLeave={()=>setHovTheme(false)}
        title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        style={{position:'fixed',top:12,right:16,
          background:hovTheme?T.tealXL:'transparent',
          border:`1px solid ${hovTheme?T.tealL:T.border}`,
          cursor:'pointer',color:hovTheme?T.tealDk:T.lo,
          padding:'5px 12px',display:'flex',alignItems:'center',gap:6,
          borderRadius:8,fontFamily:'inherit',fontSize:12.5,fontWeight:500,
          transition:'all 0.15s',zIndex:10}}>
        {isDark ? <Ico.Sun s={14}/> : <Ico.Moon s={14}/>}
        <span>{isDark ? 'Tema claro' : 'Tema oscuro'}</span>
      </button>

      {/* Tarjeta de login */}
      <div style={{background:T.surface,borderRadius:16,padding:'40px 36px',width:'100%',maxWidth:380,
        boxShadow:'0 20px 60px rgba(0,0,0,0.18)',border:`1px solid ${T.border}`}}>

        <div style={{textAlign:'center',marginBottom:32}}>
          <img src={logoTeal} alt="" style={{width:130,height:130,objectFit:'contain',marginBottom:18}}/>
          <div style={{fontSize:26,fontWeight:700,color:T.hi,letterSpacing:'-0.025em'}}>LabStock</div>
          <div style={{fontSize:13,color:T.lo,marginTop:5}}>Laboratorio Clínico Los Ángeles</div>
        </div>

        <form onSubmit={login}>
          <Field label="Usuario">
            <TInput value={codigo}
              onChange={e=>{setCodigo(e.target.value.toLowerCase());setError('');}}
              placeholder="Ingresa tu usuario" focusOnMount/>
          </Field>
          <Field label="Contraseña">
            <div style={{position:'relative'}}>
              <input
                type={showPwd?'text':'password'}
                value={password}
                onChange={e=>{setPassword(e.target.value);setError('');}}
                placeholder="Ingresa tu contraseña"
                style={{width:'100%',padding:'9px 42px 9px 12px',
                  border:`1px solid ${T.border}`,borderRadius:8,
                  fontFamily:'inherit',fontSize:13,color:'var(--text-hi)',
                  background:'var(--input-bg)',outline:'none',boxSizing:'border-box'}}/>
              <button type="button" onClick={()=>setShowPwd(p=>!p)}
                tabIndex={-1}
                style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                  background:'none',border:'none',cursor:'pointer',
                  color:'var(--text-lo)',padding:4,display:'flex',alignItems:'center'}}>
                {showPwd ? <Ico.EyeOff s={16}/> : <Ico.Eye s={16}/>}
              </button>
            </div>
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

        <p style={{textAlign:'center',fontSize:12,color:T.lo,marginTop:20,lineHeight:1.6}}>
          Sistema de gestión de inventario<br/>
          Acceso restringido al personal autorizado
        </p>
      </div>

      {/* Sello TELOXIS — centrado debajo de la tarjeta */}
      <div style={{marginTop:28,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke={T.tealDk} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        <span style={{fontSize:13,color:T.mid,letterSpacing:'0.04em'}}>
          Desarrollado por
        </span>
        <span style={{fontSize:14,fontWeight:800,letterSpacing:'0.1em',color:T.tealDk}}>
          TELOXIS
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════════════════════ */
export default function App() {
  const {session,profile,sedes,loading:authLoading,signOut}=useAuth();

  const [items,setItems]           = useState([]);
  const [itemsBySede,setIBS]       = useState({});
  const [view,setView]             = useState("inicio");
  const [modal,setModal]           = useState(null);
  const [sel,setSel]               = useState(null);
  const [filter,setFilter]         = useState({search:"",status:"Todos"});
  const [dbLoading,setDbL]         = useState(false);
  const [selectedSede,setSede]     = useState(null);
  const [pedidosBadge,setPedBadge] = useState(0);
  const [machineBlocked,setMachineBlocked] = useState(false);

  const isAdmin      = profile?.rol==='admin';
  const isAuditor    = profile?.rol==='auditor';
  const isSecretaria = profile?.rol==='secretaria';
  const cajaPerm     = isAdmin || isAuditor || profile?.permisos?.caja===true;
  const currentSedeId = isAdmin ? selectedSede : profile?.sede_id;
  const currentSedeName = sedes.find(s=>s.id===currentSedeId)?.nombre || (isAdmin&&!currentSedeId?null:profile?.sedes?.nombre);

  // ── Binding de máquina ──────────────────────────────────
  useEffect(() => {
    if (!profile || !window.electronAPI?.getMachineId) return;
    if (profile.rol === 'admin' || profile.rol === 'auditor') return; // exentos
    let cancelled = false;
    (async () => {
      const machineId = await window.electronAPI.getMachineId();
      if (!machineId || cancelled) return;
      if (!profile.machine_id) {
        // Primer login en este dispositivo — registrar
        await supabase.from('profiles').update({ machine_id: machineId }).eq('id', profile.id);
      } else if (profile.machine_id !== machineId) {
        // Dispositivo diferente al registrado — bloquear
        await signOut();
        if (!cancelled) setMachineBlocked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  // Resetear a inicio en cada nuevo login
  const prevProfileId = useRef(null);
  useEffect(()=>{
    if(profile?.id && profile.id !== prevProfileId.current){
      setView('inicio');
      prevProfileId.current = profile.id;
    }
    if(!profile) prevProfileId.current = null;
  },[profile]);

  // Auditor: solo puede ver auditoria, caja_historial, compras
  useEffect(()=>{
    if(isAuditor && !['inicio','auditoria','caja_historial','compras','gastos_fijos'].includes(view)) setView('inicio');
  },[isAuditor,view]);


  // Secretaria: solo puede ver compras (y caja si tiene permiso)
  useEffect(()=>{
    if(!isSecretaria) return;
    const allowed=['inicio','compras','inventario'];
    if(profile?.permisos?.caja===true) allowed.push('caja_dia','caja_historial');
    if(!allowed.includes(view)) setView('inicio');
  },[isSecretaria,view,profile?.permisos?.caja]);

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

  /* ── Badge de pedidos entrantes (Santa Lucía + admin) ── */
  useEffect(()=>{
    if(!profile||!sedes.length) return;
    const santaId=sedes.find(s=>s.nombre===SANTA_LUCIA_NAME)?.id;
    if(!santaId) return;
    const canSee=isAdmin||profile?.sede_id===santaId;
    if(!canSee){setPedBadge(0);return;}
    const refresh=async()=>{
      const {count}=await supabase.from('pedidos').select('*',{count:'exact',head:true})
        .in('estado',['pendiente','en_proceso']).eq('tipo','interna').eq('sede_destino_id',santaId);
      setPedBadge(count||0);
    };
    refresh();
    const ch=supabase.channel('pedidos-badge-app')
      .on('postgres_changes',{event:'*',schema:'public',table:'pedidos'},refresh)
      .subscribe();
    return ()=>supabase.removeChannel(ch);
  },[profile,sedes,isAdmin]);

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
    const code = await generateCode(data.category);
    const {data:row,error}=await supabase.from('items')
      .insert(toDB({...data,code},sedeId,profile.id)).select().single();
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

  /* ── Crear pedido ────────────────────────────────────── */
  const handleCreateOrder=async({destino,santaLuciaId,nota,items:orderItems})=>{
    if(!currentSedeId){alert('Selecciona una sede para crear un pedido.');return;}
    const ref=await generateOrderRef();
    const sedeDestinoId=destino==='santa_lucia'?santaLuciaId:null;
    const tipo=destino==='santa_lucia'?'interna':'externa';
    const {data:pedido,error}=await supabase.from('pedidos').insert({
      referencia:ref, sede_origen_id:currentSedeId,
      sede_destino_id:sedeDestinoId, tipo,
      nota:nota||null, created_by:profile.id,
    }).select().single();
    if(error){alert('Error al crear pedido: '+error.message);return;}
    const {error:ie}=await supabase.from('pedido_items').insert(
      orderItems.map(i=>({pedido_id:pedido.id,...i}))
    );
    if(ie){alert('Error al guardar ítems: '+ie.message);return;}
    setModal(null);
    setView('pedidos');
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

  if(machineBlocked) return <DispositivoBloqueadoScreen onSignOut={()=>setMachineBlocked(false)}/>;
  if(!session||!profile) return <LoginScreen/>;

  return (
    <div className="app-shell">
      <TitleBar profile={profile} sedeName={currentSedeName} onSignOut={signOut}/>
      <div className="app-body">
        <Sidebar view={view} onNav={setView} alertCount={alertCount} pedidosBadge={pedidosBadge}
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
            <InicioScreen profile={profile} items={items}
              isAdmin={isAdmin} isAuditor={isAuditor} isSecretaria={isSecretaria}
              cajaPerm={cajaPerm}
              currentSedeId={currentSedeId} onNav={setView}/>
          )}
          {view==="resumen"&&(
            <ResumenBodegaScreen items={items} onGoAlerts={()=>setView("alertas")}
              onReport={()=>setModal("report")} sedeName={currentSedeName}
              isAdmin={isAdmin} sedes={sedes} itemsBySede={itemsBySede}/>
          )}
          {view==="inventario"&&(
            <InventarioScreen items={items} filter={filter} setFilter={setFilter} filtered={filtered}
              canEdit={!isSecretaria && !!(currentSedeId||isAdmin)}
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
          {view==="pedidos"&&(
            <PedidosScreen
              sedes={sedes} profile={profile} isAdmin={isAdmin}
              currentSedeId={currentSedeId} items={items}
              onShowCart={()=>setModal("cart")}/>
          )}
          {view==="compras"&&(isAdmin||isAuditor||isSecretaria)&&(
            <ComprasScreen
              profile={profile} isAdmin={isAdmin} isAuditor={isAuditor} sedes={sedes}/>
          )}
          {view==="usuarios"&&isAdmin&&(
            <UsuariosScreen sedes={sedes}/>
          )}
          {view==="gastos_fijos"&&(isAdmin||isAuditor)&&(
            <GastosFijosScreen profile={profile} sedes={sedes} readOnly={isAuditor}/>
          )}
          {view==="analisis"&&isAdmin&&(
            <AnalisisFinancieroScreen sedes={sedes}/>
          )}
          {view==="auditoria"&&isAuditor&&(
            <AuditorDashboard onGoHistorial={()=>setView('caja_historial')}/>
          )}
          {view==="caja_dia"&&cajaPerm&&!isAuditor&&(
            <CajaScreen
              profile={profile} isAdmin={isAdmin}
              currentSedeId={currentSedeId}
              selectedSede={selectedSede}
              sedes={sedes}
              onSedeChange={setSede}/>
          )}
          {view==="caja_historial"&&cajaPerm&&(
            <HistorialCajaScreen
              profile={profile} isAdmin={isAdmin} sedes={sedes}/>
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
      <Modal open={modal==="cart"} onClose={close} title="Nuevo pedido" maxWidth={620}>
        <CartModal items={items} sedes={sedes} currentSedeId={currentSedeId}
          onSubmit={handleCreateOrder} onClose={close}/>
      </Modal>
    </div>
  );
}
