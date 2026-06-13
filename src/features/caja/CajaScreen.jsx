import { useState, useEffect, useCallback } from 'react';
import { T, Ico, Btn, IconBtn, Modal, fmtQ } from '../../shared/ui';
import { supabase } from '../../lib/supabase';
import { useCuadre } from './hooks/useCuadre';
import { ResumenCuadre } from './components/ResumenCuadre';
import { IngresoDiaCard } from './components/IngresoDiaCard';
import { GastoModal } from './components/GastoModal';
import { DepositoModal } from './components/DepositoModal';
import { CerrarCuadreModal } from './components/CerrarCuadreModal';

const fmtFecha = d => d
  ? new Date(d + 'T12:00:00').toLocaleDateString('es-GT',
      { weekday:'long', year:'numeric', month:'long', day:'numeric' })
  : '—';

const fmtHora = iso => iso
  ? new Date(iso).toLocaleTimeString('es-GT', { hour:'2-digit', minute:'2-digit' })
  : '';

const CAT_LABELS = {
  operativo:'Operativo', mantenimiento:'Mantenimiento', transporte:'Transporte',
  papeleria:'Papelería', limpieza:'Limpieza', extra:'Extra', otro:'Otro',
};

/* Semáforo badge inline */
function SemaforoBadge({ diferencia }) {
  if (diferencia == null) return null;
  const n = Number(diferencia);
  const { label, c, bg } = n === 0
    ? { label:'Cuadrado', c:T.ok,   bg:T.okBg   }
    : n > 0
    ? { label:`+${fmtQ(n)}`, c:T.warn, bg:T.warnBg }
    : { label:fmtQ(n),       c:T.crit, bg:T.critBg };
  return (
    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20,
      background:bg, color:c, fontWeight:700 }}>{label}</span>
  );
}

/* Número rápido en el encabezado del acordeón */
function QuickNum({ label, value, color }) {
  return (
    <div style={{ textAlign:'right' }}>
      <div style={{ fontSize:10, color:T.lo, textTransform:'uppercase',
        letterSpacing:'0.06em', marginBottom:1 }}>{label}</div>
      <div style={{ fontSize:13.5, fontWeight:700, color: color || T.hi }}>{value}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Panel de cuadre expandible (un solo hook por instancia)
   ────────────────────────────────────────────────────────── */
function CuadreSede({ sedeId, sedeName, profile, isAdmin }) {
  const {
    cuadre, gastos, depositos, loading, saving, isOpen, rlsError,
    totalGastos, totalDepositos, ingresoNum,
    cajaBase, depositoEsperado, cajaFinal, diferencia,
    soranteAnterior,
    saveIngreso, addGasto, deleteGasto, addDeposito, deleteDeposito,
    cerrar, reabrir,
  } = useCuadre(sedeId, profile);

  const [modal, setModal] = useState(null);
  const [pendientes, setPendientes] = useState(0);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!sedeId) return;
    supabase.from('cuadres_caja').select('*', { count:'exact', head:true })
      .eq('sede_id', sedeId).eq('estado','abierto').lt('fecha', today)
      .then(({ count }) => setPendientes(count || 0));
  }, [sedeId, today]);

  if (loading) return (
    <div style={{ padding:'24px 0', textAlign:'center', color:T.lo, fontSize:13 }}>
      Cargando cuadre...
    </div>
  );

  if (rlsError) return (
    <div style={{ background:T.critBg, border:`1px solid ${T.crit}44`, borderRadius:12,
      padding:'20px 24px', display:'flex', gap:12, alignItems:'flex-start' }}>
      <Ico.Warn s={18} c={T.crit}/>
      <div>
        <div style={{ fontSize:14, fontWeight:700, color:T.crit, marginBottom:4 }}>
          Sin acceso al cuadre de caja
        </div>
        <div style={{ fontSize:13, color:'#B81818' }}>{rlsError}</div>
      </div>
    </div>
  );

  const estadoBadge = isOpen
    ? { label:'Abierto', c:T.ok,   bg:T.okBg   }
    : { label:'Cerrado', c:T.crit, bg:T.critBg };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {pendientes > 0 && (
        <div style={{ background:T.warnBg, border:`1px solid #FBBF24`, borderRadius:10,
          padding:'9px 14px', display:'flex', gap:8, alignItems:'center' }}>
          <Ico.Warn s={15} c={T.warn}/>
          <span style={{ fontSize:12.5, color:T.warn }}>
            <strong>{pendientes}</strong> cuadre{pendientes>1?'s':''} de días anteriores sin cerrar.
            Revísalos en el Historial.
          </span>
        </div>
      )}

      {soranteAnterior && isOpen && (
        <div style={{ background:'rgba(234,179,8,0.1)', border:`1px solid ${T.warn}55`,
          borderRadius:10, padding:'10px 14px', display:'flex', gap:10, alignItems:'flex-start' }}>
          <Ico.Warn s={16} c={T.warn} style={{flexShrink:0,marginTop:1}}/>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:T.warn, marginBottom:2 }}>
              Sobrante del día anterior: {fmtQ(soranteAnterior.monto)}
            </div>
            <div style={{ fontSize:12, color:T.mid }}>
              El cuadre del {new Date(soranteAnterior.fecha + 'T12:00:00').toLocaleDateString('es-GT',
                { weekday:'long', day:'2-digit', month:'long' })} cerró con efectivo extra en caja.
              Verifica que el efectivo físico coincide con la caja base actual (Q800).
            </div>
          </div>
        </div>
      )}

      {/* Sub-header interno */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ padding:'2px 9px', borderRadius:20, background:estadoBadge.bg,
            color:estadoBadge.c, fontSize:11, fontWeight:700 }}>{estadoBadge.label}</span>
          {cuadre?.cerrado_at && (
            <span style={{ fontSize:11, color:T.lo }}>
              Cerrado {fmtHora(cuadre.cerrado_at)}
            </span>
          )}
        </div>
        {isOpen ? (
          <Btn icon={<Ico.Lock s={13}/>} onClick={() => setModal('cerrar')} disabled={saving}>
            Cerrar cuadre
          </Btn>
        ) : isAdmin ? (
          <Btn variant="secondary" icon={<Ico.Unlock s={13}/>} onClick={reabrir} disabled={saving}>
            Reabrir cuadre
          </Btn>
        ) : null}
      </div>

      <IngresoDiaCard
        ingreso={ingresoNum} isOpen={isOpen} saving={saving} onSave={saveIngreso}
      />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:14, alignItems:'start' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Gastos */}
          <div style={{ background:T.bg, borderRadius:10, border:`1px solid ${T.border}` }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`,
              display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:13, fontWeight:600, color:T.hi, display:'flex', gap:6 }}>
                <Ico.TrendingDown s={15} c={T.crit}/> Gastos del día
              </div>
              {isOpen && (
                <Btn size="sm" icon={<Ico.Plus s={12}/>} onClick={() => setModal('gasto')}>
                  Agregar
                </Btn>
              )}
            </div>
            {gastos.length === 0 ? (
              <div style={{ padding:'22px 16px', textAlign:'center', color:T.lo, fontSize:12.5 }}>
                Sin gastos registrados
              </div>
            ) : (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 80px 80px 36px',
                  padding:'6px 16px', background:'var(--table-head-bg)', borderBottom:`1px solid ${T.border}` }}>
                  {['Descripción','Categoría','Monto','Comprobante',''].map((h,i) => (
                    <span key={i} style={{ fontSize:10, fontWeight:700, color:T.lo,
                      textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</span>
                  ))}
                </div>
                {gastos.map((g, i) => (
                  <div key={g.id}
                    style={{ display:'grid', gridTemplateColumns:'1fr 100px 80px 80px 36px',
                      padding:'10px 16px', alignItems:'center',
                      borderBottom: i < gastos.length-1 ? `1px solid ${T.border}` : 'none' }}>
                    <div>
                      <div style={{ fontSize:12.5, color:T.hi }}>{g.descripcion}</div>
                      <div style={{ fontSize:10.5, color:T.lo }}>{g.registrado?.nombre||'—'} · {fmtHora(g.created_at)}</div>
                    </div>
                    <span style={{ fontSize:11, color:T.mid }}>{CAT_LABELS[g.categoria]||g.categoria}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:T.crit }}>{fmtQ(g.monto)}</span>
                    <span style={{ fontSize:11.5, color:T.lo }}>{g.comprobante||'—'}</span>
                    {isOpen && (
                      <IconBtn danger icon={<Ico.Trash s={12}/>}
                        onClick={() => deleteGasto(g.id, g.descripcion, g.monto)}/>
                    )}
                  </div>
                ))}
                <div style={{ padding:'9px 16px', borderTop:`1px solid ${T.border}`,
                  display:'flex', justifyContent:'flex-end', gap:8 }}>
                  <span style={{ fontSize:12, color:T.mid }}>Total:</span>
                  <span style={{ fontSize:13, fontWeight:700, color:T.crit }}>{fmtQ(totalGastos)}</span>
                </div>
              </>
            )}
          </div>

          {/* Depósitos */}
          <div style={{ background:T.bg, borderRadius:10, border:`1px solid ${T.border}` }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`,
              display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:13, fontWeight:600, color:T.hi, display:'flex', gap:6 }}>
                <Ico.Banknote s={15} c='#7C3AED'/> Depósitos del día
              </div>
              {isOpen && (
                <Btn size="sm" icon={<Ico.Plus s={12}/>} onClick={() => setModal('deposito')}>
                  Agregar
                </Btn>
              )}
            </div>
            {depositos.length === 0 ? (
              <div style={{ padding:'22px 16px', textAlign:'center', color:T.lo, fontSize:12.5 }}>
                Sin depósitos registrados
              </div>
            ) : (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1.2fr 120px 80px 36px',
                  padding:'6px 16px', background:'var(--table-head-bg)', borderBottom:`1px solid ${T.border}` }}>
                  {['Banco / Boleta','Registrado por','Monto',''].map((h,i) => (
                    <span key={i} style={{ fontSize:10, fontWeight:700, color:T.lo,
                      textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</span>
                  ))}
                </div>
                {depositos.map((d, i) => (
                  <div key={d.id}
                    style={{ display:'grid', gridTemplateColumns:'1.2fr 120px 80px 36px',
                      padding:'10px 16px', alignItems:'center',
                      borderBottom: i < depositos.length-1 ? `1px solid ${T.border}` : 'none' }}>
                    <div>
                      <div style={{ fontSize:12.5, color:T.hi }}>{d.banco}</div>
                      <div style={{ fontSize:10.5, color:T.lo }}>Boleta {d.no_boleta} · {fmtHora(d.created_at)}</div>
                    </div>
                    <span style={{ fontSize:11.5, color:T.mid }}>{d.registrado?.nombre||'—'}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#7C3AED' }}>{fmtQ(d.monto)}</span>
                    {isOpen && (
                      <IconBtn danger icon={<Ico.Trash s={12}/>}
                        onClick={() => deleteDeposito(d.id, d.banco, d.monto)}/>
                    )}
                  </div>
                ))}
                <div style={{ padding:'9px 16px', borderTop:`1px solid ${T.border}`,
                  display:'flex', justifyContent:'flex-end', gap:8 }}>
                  <span style={{ fontSize:12, color:T.mid }}>Total:</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'#7C3AED' }}>{fmtQ(totalDepositos)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <ResumenCuadre
          cajaBase={cajaBase} ingresoNum={ingresoNum}
          totalGastos={totalGastos} totalDepositos={totalDepositos}
          depositoEsperado={depositoEsperado} cajaFinal={cajaFinal} diferencia={diferencia}
        />
      </div>

      <Modal open={modal==='gasto'} onClose={() => setModal(null)} title="Agregar gasto">
        <GastoModal saving={saving}
          onSave={async data => { await addGasto(data); setModal(null); }}
          onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal==='deposito'} onClose={() => setModal(null)} title="Registrar depósito">
        <DepositoModal saving={saving}
          onSave={async data => { await addDeposito(data); setModal(null); }}
          onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal==='cerrar'} onClose={() => setModal(null)}
        title="Cerrar cuadre del día" maxWidth={480}>
        <CerrarCuadreModal
          cuadre={cuadre} cajaBase={cajaBase} ingresoNum={ingresoNum}
          totalGastos={totalGastos} totalDepositos={totalDepositos}
          cajaFinal={cajaFinal} diferencia={diferencia} saving={saving}
          onCerrar={async notas => { await cerrar(notas); setModal(null); }}
          onClose={() => setModal(null)} />
      </Modal>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Dashboard del administrador — tarjetas → vista de sede
   ────────────────────────────────────────────────────────── */
function AdminDashboard({ sedes, profile }) {
  const [selectedId, setSelectedId] = useState(null);
  const [resumen, setResumen]       = useState([]);
  const today = new Date().toISOString().split('T')[0];

  const loadResumen = useCallback(async () => {
    const { data } = await supabase.from('v_cuadres_resumen').select('*').eq('fecha', today);
    setResumen(data || []);
  }, [today]);

  useEffect(() => {
    loadResumen();
    const ch = supabase.channel('dashboard-caja-overview')
      .on('postgres_changes', { event:'*', schema:'public', table:'cuadres_caja'   }, loadResumen)
      .on('postgres_changes', { event:'*', schema:'public', table:'gastos_caja'    }, loadResumen)
      .on('postgres_changes', { event:'*', schema:'public', table:'depositos_caja' }, loadResumen)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadResumen]);

  const bySedeId = Object.fromEntries(resumen.map(r => [r.sede_id, r]));

  /* ── Vista de sede individual ── */
  if (selectedId) {
    const sede = sedes.find(s => s.id === selectedId);
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

        {/* Barra de navegación */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button
            onClick={() => setSelectedId(null)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
              borderRadius:8, border:`1px solid ${T.border}`, background:T.surface,
              cursor:'pointer', fontSize:13, fontWeight:600, color:T.mid,
              transition:'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=T.teal; e.currentTarget.style.color=T.teal; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.mid; }}>
            <Ico.ChevronLeft s={15}/> Volver al dashboard
          </button>
          <div style={{ width:1, height:20, background:T.border }}/>
          <h1 style={{ fontSize:19, fontWeight:700, color:T.hi, margin:0 }}>
            {sede?.nombre}
          </h1>
          <span style={{ fontSize:12, color:T.lo }}>—</span>
          <span style={{ fontSize:12, color:T.lo }}>{fmtFecha(today)}</span>
        </div>

        <CuadreSede
          key={selectedId}
          sedeId={selectedId}
          sedeName={sede?.nombre || ''}
          profile={profile}
          isAdmin={true}
        />
      </div>
    );
  }

  /* ── Vista dashboard ── */
  const totalIngreso   = resumen.reduce((s,r) => s + Number(r.ingreso_dia||0), 0);
  const totalGastos    = resumen.reduce((s,r) => s + Number(r.total_gastos||0), 0);
  const totalDepositos = resumen.reduce((s,r) => s + Number(r.total_depositos||0), 0);
  const sedesCerradas  = resumen.filter(r => r.estado === 'cerrado').length;

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:21, fontWeight:700, color:T.hi, margin:0 }}>Cuadre del día</h1>
        <p style={{ fontSize:12.5, color:T.lo, marginTop:4 }}>{fmtFecha(today)}</p>
      </div>

      {/* Totales globales */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12,
        padding:'14px 20px', marginBottom:16,
        display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
        {[
          { label:'Ingreso total',    value:fmtQ(totalIngreso),   color:T.tealDk  },
          { label:'Gastos total',     value:fmtQ(totalGastos),    color:T.crit    },
          { label:'Depósitos total',  value:fmtQ(totalDepositos), color:'#7C3AED' },
          { label:'Sedes cerradas',   value:`${sedesCerradas} / ${sedes.length}`, color:T.hi },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ fontSize:10.5, color:T.lo, textTransform:'uppercase',
              letterSpacing:'0.07em', marginBottom:3 }}>{label}</div>
            <div style={{ fontSize:18, fontWeight:700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tarjetas de sedes */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {sedes.map(sede => {
          const r = bySedeId[sede.id];
          const dif = r ? Number(r.diferencia) : null;
          const isCerrado = r?.estado === 'cerrado';

          return (
            <div key={sede.id}
              style={{ background:T.surface, borderRadius:12, border:`1px solid ${T.border}`,
                padding:'14px 18px', display:'flex', alignItems:'center', gap:12,
                transition:'border-color 0.12s, box-shadow 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=T.teal; e.currentTarget.style.boxShadow='0 2px 8px rgba(43,191,190,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=T.border; e.currentTarget.style.boxShadow='none'; }}>

              {/* Dot semáforo */}
              <div style={{ width:10, height:10, borderRadius:'50%', flexShrink:0,
                background: dif==null ? T.border : dif===0 ? T.ok : dif>0 ? T.warn : T.crit }}/>

              {/* Nombre + badges */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14.5, color:T.hi }}>{sede.nombre}</div>
                <div style={{ display:'flex', gap:6, marginTop:3, flexWrap:'wrap' }}>
                  <span style={{ fontSize:10.5, padding:'1px 7px', borderRadius:20, fontWeight:600,
                    background: isCerrado ? T.critBg : T.okBg,
                    color:      isCerrado ? T.crit   : T.ok }}>
                    {isCerrado ? 'Cerrado' : 'Abierto'}
                  </span>
                  {dif != null && <SemaforoBadge diferencia={dif}/>}
                  {!r && <span style={{ fontSize:10.5, color:T.lo, fontStyle:'italic' }}>Sin cuadre hoy</span>}
                </div>
              </div>

              {/* Números rápidos */}
              {r && (
                <div style={{ display:'flex', gap:20 }}>
                  <QuickNum label="Ingreso"   value={fmtQ(r.ingreso_dia)}     color={T.tealDk} />
                  <QuickNum label="Gastos"    value={fmtQ(r.total_gastos)}    color={T.crit}   />
                  <QuickNum label="Depósitos" value={fmtQ(r.total_depositos)} color='#7C3AED'  />
                </div>
              )}

              {/* Botón ver */}
              <button
                onClick={() => setSelectedId(sede.id)}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px',
                  borderRadius:8, border:`1px solid ${T.teal}`, background:T.tealXL,
                  cursor:'pointer', fontSize:12.5, fontWeight:600, color:T.tealDk,
                  transition:'all 0.12s', flexShrink:0 }}
                onMouseEnter={e => { e.currentTarget.style.background=T.teal; e.currentTarget.style.color='#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background=T.tealXL; e.currentTarget.style.color=T.tealDk; }}>
                Ver detalle <Ico.ChevronRight s={13}/>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Export principal
   ────────────────────────────────────────────────────────── */
export function CajaScreen({ profile, isAdmin, currentSedeId, sedes }) {
  if (profile?.rol === 'auditor') return null;

  // Admin → siempre dashboard interactivo (ignora currentSedeId)
  if (isAdmin) {
    return <AdminDashboard sedes={sedes} profile={profile} />;
  }

  // Técnico → su sede específica
  if (!currentSedeId) {
    return (
      <div style={{ padding:40, textAlign:'center', color:T.lo, fontSize:13 }}>
        Selecciona una sede en el menú lateral para ver el cuadre.
      </div>
    );
  }

  const sedeName = sedes.find(s => s.id === currentSedeId)?.nombre || '';
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div>
        <h1 style={{ fontSize:21, fontWeight:700, color:T.hi, margin:0 }}>Cuadre del día</h1>
        <div style={{ fontSize:12.5, color:T.lo, marginTop:4 }}>
          {fmtFecha(new Date().toISOString().split('T')[0])} ·{' '}
          <span style={{ fontWeight:600, color:T.tealDk }}>{sedeName}</span>
        </div>
      </div>
      <CuadreSede
        key={currentSedeId}
        sedeId={currentSedeId}
        sedeName={sedeName}
        profile={profile}
        isAdmin={false}
      />
    </div>
  );
}
