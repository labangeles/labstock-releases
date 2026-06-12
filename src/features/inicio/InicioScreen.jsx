import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { T, Ico, fmtQ } from '../../shared/ui';

/* ── Frases inspiradoras (rotan por día del año) ─────────── */
const FRASES = [
  { texto: 'La excelencia no es un acto, es un hábito.',                           autor: 'Aristóteles'    },
  { texto: 'La salud es la mayor riqueza que puede poseer el ser humano.',          autor: 'Virgilio'       },
  { texto: 'El éxito es la suma de pequeños esfuerzos repetidos día tras día.',    autor: 'Robert Collier' },
  { texto: 'La precisión salva vidas. Tu trabajo importa.',                         autor: ''               },
  { texto: 'Un equipo organizado logra lo que ningún individuo puede alcanzar solo.',autor: ''              },
  { texto: 'El orden es la base de todas las virtudes.',                            autor: 'Blaise Pascal'  },
  { texto: 'Cuidar a otros comienza por cuidar los detalles.',                      autor: ''               },
  { texto: 'La disciplina es el puente entre las metas y los logros.',              autor: 'Jim Rohn'       },
  { texto: 'Cada día es una nueva oportunidad de hacer la diferencia.',             autor: ''               },
  { texto: 'La calidad nunca es un accidente; es siempre el resultado de un esfuerzo inteligente.', autor: 'John Ruskin' },
  { texto: 'No cuentes los días; haz que los días cuenten.',                        autor: 'Muhammad Ali'   },
  { texto: 'El servicio a los demás es la renta que pagamos por el espacio que ocupamos en la tierra.', autor: 'Muhammad Ali' },
];

const getStatusSimple = i => {
  if (i.current === 0) return 'out';
  const r = i.current / i.minimum;
  if (r <= 0.5) return 'crit';
  if (r <= 1.0) return 'warn';
  return 'ok';
};

/* ── AlertCard ───────────────────────────────────────────── */
function AlertCard({ color, bg, icon, titulo, descripcion, accion, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? bg : T.surface,
        border: `1px solid ${color}44`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 12, padding: '16px 18px', cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: hov ? `0 6px 20px ${color}22` : '0 1px 4px rgba(0,0,0,0.05)',
      }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:bg,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {icon}
        </div>
        <span style={{ fontSize:13.5, fontWeight:700, color:T.hi }}>{titulo}</span>
      </div>
      <div style={{ fontSize:12.5, color:T.mid, lineHeight:1.45, marginBottom:12 }}>
        {descripcion}
      </div>
      <div style={{ fontSize:12, fontWeight:600, color, display:'flex', alignItems:'center', gap:4 }}>
        {accion} <span>›</span>
      </div>
    </div>
  );
}

/* ── InicioScreen ────────────────────────────────────────── */
export function InicioScreen({ profile, items, isAdmin, isAuditor, isSecretaria, cajaPerm, currentSedeId, onNav }) {
  const now = new Date();

  const h      = now.getHours();
  const saludo = h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';

  const start = new Date(now.getFullYear(), 0, 0);
  const doy   = Math.floor((now - start) / 86400000);
  const frase = FRASES[doy % FRASES.length];

  const fecha = now.toLocaleDateString('es-GT', {
    weekday:'long', day:'numeric', month:'long', year:'numeric',
  });

  const primerNombre = (() => {
    const words = (profile?.nombre || '').split(' ').filter(w => w.length > 0);
    return words.find(w => !w.endsWith('.')) || words[0] || 'bienvenido/a';
  })();

  /* ── Qué alertas aplican por rol ── */
  // Inventario: admin + tecnico + secretaria (no auditor — no tiene acceso a bodega)
  const showInventario = !isAuditor;
  // Cuadres: admin, auditor (ven todas las sedes), o cualquiera con permiso de caja
  const showCuadres    = isAdmin || isAuditor || cajaPerm;
  // Gastos fijos: solo admin
  const showGastos     = isAdmin;
  // Pedidos: admin + tecnico (no auditor, no secretaria — no tienen sección de pedidos)
  const showPedidos    = !isAuditor && !isSecretaria;

  const [cuadresAbiertos, setCuadres] = useState(0);
  const [gastosPend,      setGastos]  = useState(0);
  const [pedidosPend,     setPedidos] = useState(0);
  const [loading,         setLoad]    = useState(true);

  useEffect(() => {
    const today = now.toISOString().split('T')[0];
    const mes   = now.getMonth() + 1;
    const anio  = now.getFullYear();

    const p1 = showCuadres ? (() => {
      let q = supabase.from('cuadres_caja')
        .select('*', { count:'exact', head:true })
        .eq('estado', 'abierto')
        .lte('fecha', today);
      // Admin y auditor ven todas las sedes; el resto solo la suya
      if (!isAdmin && !isAuditor && currentSedeId) q = q.eq('sede_id', currentSedeId);
      return q.then(({ count }) => setCuadres(count || 0));
    })() : Promise.resolve();

    const p2 = showGastos
      ? supabase.from('gastos_fijos_pagos')
          .select('*', { count:'exact', head:true })
          .eq('mes', mes).eq('anio', anio).eq('pagado', false)
          .then(({ count }) => setGastos(count || 0))
      : Promise.resolve();

    const p3 = showPedidos ? (() => {
      let q = supabase.from('pedidos')
        .select('*', { count:'exact', head:true })
        .in('estado', ['pendiente', 'en_proceso']);
      if (!isAdmin && currentSedeId) q = q.eq('sede_origen_id', currentSedeId);
      return q.then(({ count }) => setPedidos(count || 0));
    })() : Promise.resolve();

    Promise.all([p1, p2, p3]).finally(() => setLoad(false));
  }, [isAdmin, isAuditor, isSecretaria, cajaPerm, currentSedeId]);

  /* Insumos críticos — solo roles con acceso a bodega */
  const critItems = showInventario
    ? items.filter(i => ['crit','out'].includes(getStatusSimple(i)))
    : [];

  /* Destino de navegación para inventario según rol */
  const navInventario = isSecretaria ? 'inventario' : 'alertas';

  const hayAlertas = critItems.length > 0 || cuadresAbiertos > 0 ||
    (showGastos && gastosPend > 0) || (showPedidos && pedidosPend > 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

      {/* ── Hero: saludo + frase ── */}
      <div style={{
        background: `linear-gradient(135deg, ${T.teal} 0%, ${T.tealDk} 100%)`,
        borderRadius: 18, padding: '30px 34px', color: '#fff',
        boxShadow: `0 8px 28px ${T.teal}44`,
      }}>
        <div style={{ fontSize:12.5, opacity:0.8, textTransform:'capitalize', marginBottom:6 }}>
          {fecha}
        </div>
        <div style={{ fontSize:26, fontWeight:800, letterSpacing:'-0.03em', marginBottom:0, lineHeight:1.2 }}>
          {saludo},
        </div>
        <div style={{ fontSize:26, fontWeight:800, letterSpacing:'-0.03em', marginBottom:18, lineHeight:1.2 }}>
          {primerNombre}
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.22)', paddingTop:16 }}>
          <div style={{ fontSize:14, fontStyle:'italic', opacity:0.92, lineHeight:1.6 }}>
            "{frase.texto}"
          </div>
          {frase.autor && (
            <div style={{ fontSize:12, opacity:0.65, marginTop:6 }}>— {frase.autor}</div>
          )}
        </div>
      </div>

      {/* ── Alertas ── */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'32px 0', color:T.lo, fontSize:13 }}>
          Verificando áreas…
        </div>
      ) : !hayAlertas ? (
        <div style={{
          background: T.okBg, border:`1px solid ${T.ok}33`,
          borderRadius: 14, padding:'22px 28px',
          display:'flex', alignItems:'center', gap:18,
        }}>
          <div style={{ width:50, height:50, borderRadius:'50%', background:T.ok,
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Ico.Check s={24} c="#fff"/>
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:T.ok }}>¡Todo en orden!</div>
            <div style={{ fontSize:13, color:T.ok, opacity:0.8, marginTop:3 }}>
              No hay alertas urgentes en ninguna área. ¡Excelente trabajo hoy!
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.lo, textTransform:'uppercase',
            letterSpacing:'0.09em' }}>
            Requieren atención
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:12 }}>

            {critItems.length > 0 && (
              <AlertCard
                color={T.crit} bg={T.critBg}
                icon={<Ico.XCircle s={19} c={T.crit}/>}
                titulo="Inventario"
                descripcion={`${critItems.length} insumo${critItems.length>1?'s':''} en estado crítico o agotado`}
                accion={isSecretaria ? 'Ver inventario' : 'Ver alertas'}
                onClick={() => onNav(navInventario)}
              />
            )}

            {cuadresAbiertos > 0 && (
              <AlertCard
                color={T.warn} bg={T.warnBg}
                icon={<Ico.DollarSign s={19} c={T.warn}/>}
                titulo="Caja"
                descripcion={`${cuadresAbiertos} cuadre${cuadresAbiertos>1?'s':''} de caja sin cerrar`}
                accion="Ver historial de caja"
                onClick={() => onNav('caja_historial')}
              />
            )}

            {showGastos && gastosPend > 0 && (
              <AlertCard
                color="#7C3AED" bg="#F5F3FF"
                icon={<Ico.Wallet s={19} c="#7C3AED"/>}
                titulo="Gastos Fijos"
                descripcion={`${gastosPend} pago${gastosPend>1?'s':''} pendiente${gastosPend>1?'s':''} este mes`}
                accion="Ver checklist"
                onClick={() => onNav('gastos_fijos')}
              />
            )}

            {showPedidos && pedidosPend > 0 && (
              <AlertCard
                color={T.tealDk} bg={T.tealXL}
                icon={<Ico.Cart s={19} c={T.tealDk}/>}
                titulo="Pedidos"
                descripcion={`${pedidosPend} pedido${pedidosPend>1?'s':''} activo${pedidosPend>1?'s':''} en proceso`}
                accion="Ver pedidos"
                onClick={() => onNav('pedidos')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
