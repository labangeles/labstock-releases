import { useState, useEffect } from 'react';
import { T, Ico, Btn, fmtQ } from '../../shared/ui';
import { supabase } from '../../lib/supabase';
import { exportarExcel } from './lib/exportExcel';

const fmtFecha = d => d
  ? new Date(d + 'T12:00:00').toLocaleDateString('es-GT',
      { day:'2-digit', month:'short', year:'numeric' })
  : '—';

const semaforo = dif => {
  const d = Number(dif);
  if (d === 0) return { label:'Cuadrado', c:T.ok,   bg:T.okBg   };
  if (d > 0)   return { label:'Sobrante', c:T.warn,  bg:T.warnBg };
  return              { label:'Faltante', c:T.crit,  bg:T.critBg };
};

/* Detalle de un cuadre (solo lectura) */
function DetallePanel({ cuadreId, abiertoPasado, isAdmin, onCerrar, cerrando, notas, diferencia, totalDepositos }) {
  const [gastos, setGastos]       = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!cuadreId) return;
    Promise.all([
      supabase.from('gastos_caja').select('*, registrado:registrado_por(nombre)')
        .eq('cuadre_id', cuadreId).order('created_at'),
      supabase.from('depositos_caja').select('*, registrado:registrado_por(nombre)')
        .eq('cuadre_id', cuadreId).order('created_at'),
    ]).then(([g, d]) => {
      setGastos(g.data || []);
      setDepositos(d.data || []);
      setLoading(false);
    });
  }, [cuadreId]);

  if (loading) return (
    <div style={{ padding:16, color:T.lo, fontSize:13 }}>Cargando detalle...</div>
  );

  const fmtHora = iso => iso
    ? new Date(iso).toLocaleTimeString('es-GT', { hour:'2-digit', minute:'2-digit' })
    : '';

  return (
    <div style={{ padding:'14px 18px', background:'var(--bg-surface)', borderTop:`1px solid ${T.border}` }}>

      {/* Banner + botón de cierre forzado para admin */}
      {abiertoPasado && isAdmin && (
        <div style={{ background:T.warnBg, border:`1px solid ${T.warn}55`, borderRadius:8,
          padding:'10px 14px', marginBottom:14, display:'flex', alignItems:'center',
          justifyContent:'space-between', gap:12 }}>
          <div style={{ fontSize:12.5, color:T.warn }}>
            <strong>⚠ Cuadre sin cerrar.</strong> Puedes forzar el cierre como administrador.
            Los valores actuales quedarán registrados tal como están.
          </div>
          <button onClick={onCerrar} disabled={cerrando}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px',
              background:T.warn, color:'#000', border:'none', borderRadius:8,
              fontFamily:'inherit', fontSize:12.5, fontWeight:700, cursor: cerrando ? 'not-allowed' : 'pointer',
              opacity: cerrando ? 0.6 : 1, whiteSpace:'nowrap', flexShrink:0 }}>
            {cerrando ? 'Cerrando...' : '⚑ Cerrar cuadre'}
          </button>
        </div>
      )}

      {/* Alerta: sin depósito */}
      {!abiertoPasado && totalDepositos === 0 && (
        <div style={{ background:T.warnBg, border:`1px solid ${T.warn}55`, borderRadius:8,
          padding:'10px 14px', marginBottom:14, fontSize:12.5, color:T.warn, fontWeight:600 }}>
          ⚠ No se registró depósito en este cuadre.
          {notas && <div style={{ fontWeight:400, marginTop:4, color:T.hi }}>{notas}</div>}
        </div>
      )}

      {/* Comentario: sobrante con nota */}
      {!abiertoPasado && diferencia > 0 && notas && totalDepositos > 0 && (
        <div style={{ background:T.warnBg, border:`1px solid ${T.warn}55`, borderRadius:8,
          padding:'10px 14px', marginBottom:14, fontSize:12.5 }}>
          <div style={{ fontWeight:700, color:T.warn, marginBottom:4 }}>
            Nota de sobrante
          </div>
          <div style={{ color:T.hi }}>{notas}</div>
        </div>
      )}

      {/* Comentario: faltante con nota */}
      {!abiertoPasado && diferencia < 0 && notas && (
        <div style={{ background:T.critBg, border:`1px solid ${T.crit}55`, borderRadius:8,
          padding:'10px 14px', marginBottom:14, fontSize:12.5 }}>
          <div style={{ fontWeight:700, color:T.crit, marginBottom:4 }}>
            Nota de faltante
          </div>
          <div style={{ color:T.hi }}>{notas}</div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Gastos */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:T.lo, textTransform:'uppercase',
            letterSpacing:'0.07em', marginBottom:8 }}>Gastos</div>
          {gastos.length === 0
            ? <div style={{ fontSize:12.5, color:T.lo, fontStyle:'italic' }}>Sin gastos</div>
            : gastos.map(g => (
              <div key={g.id} style={{ display:'flex', justifyContent:'space-between',
                padding:'5px 0', borderBottom:`1px solid ${T.border}`, fontSize:12.5 }}>
                <div>
                  <div style={{ color:T.hi }}>{g.descripcion}</div>
                  <div style={{ fontSize:11, color:T.lo }}>{g.categoria} · {fmtHora(g.created_at)}</div>
                </div>
                <span style={{ fontWeight:600, color:T.crit, whiteSpace:'nowrap', marginLeft:12 }}>
                  {fmtQ(g.monto)}
                </span>
              </div>
            ))
          }
        </div>

        {/* Depósitos */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:T.lo, textTransform:'uppercase',
            letterSpacing:'0.07em', marginBottom:8 }}>Depósitos</div>
          {depositos.length === 0
            ? <div style={{ fontSize:12.5, color:T.lo, fontStyle:'italic' }}>Sin depósitos</div>
            : depositos.map(d => (
              <div key={d.id} style={{ display:'flex', justifyContent:'space-between',
                padding:'5px 0', borderBottom:`1px solid ${T.border}`, fontSize:12.5 }}>
                <div>
                  <div style={{ color:T.hi }}>{d.banco}</div>
                  <div style={{ fontSize:11, color:T.lo }}>Boleta {d.no_boleta} · {fmtHora(d.created_at)}</div>
                </div>
                <span style={{ fontWeight:600, color:'#7C3AED', whiteSpace:'nowrap', marginLeft:12 }}>
                  {fmtQ(d.monto)}
                </span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

export function HistorialCajaScreen({ profile, isAdmin, sedes }) {
  const isAuditor = profile?.rol === 'auditor';
  const canExport = isAdmin || isAuditor;

  // Filtros — por defecto últimos 30 días
  const hoy = new Date().toISOString().split('T')[0];
  const hace30 = new Date(Date.now() - 30*24*3600*1000).toISOString().split('T')[0];

  const [fechaDesde, setFechaDesde] = useState(hace30);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [sedeFiltro, setSedeF]      = useState('');
  const [cuadres, setCuadres]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [expandedId, setExpanded]   = useState(null);
  const [exporting, setExporting]   = useState(false);
  const [exportErr, setExportErr]   = useState('');
  const [cerrando, setCerrando]     = useState(null); // id del cuadre que se está cerrando

  const canSeeAllSedes = isAdmin || isAuditor;

  const load = async () => {
    setLoading(true);

    // Usuarios sin acceso global y sin sede asignada: no mostrar nada
    if (!canSeeAllSedes && !profile?.sede_id && !sedeFiltro) {
      setCuadres([]);
      setLoading(false);
      return;
    }

    let q = supabase.from('v_cuadres_resumen').select('*')
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)
      .order('fecha', { ascending: false });

    if (sedeFiltro) q = q.eq('sede_id', sedeFiltro);
    else if (!canSeeAllSedes && profile?.sede_id) q = q.eq('sede_id', profile.sede_id);

    const { data } = await q;
    setCuadres(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [fechaDesde, fechaHasta, sedeFiltro]);

  const handleExport = async () => {
    setExporting(true);
    setExportErr('');
    try {
      await exportarExcel({
        fechaDesde, fechaHasta,
        sedeId: sedeFiltro || null,
        sedes,
      });
    } catch (e) {
      setExportErr(e.message || 'Error al exportar');
    }
    setExporting(false);
  };

  const cerrarForzado = async (cuadre) => {
    if (!window.confirm(
      `¿Cerrar el cuadre de "${cuadre.sede_nombre}" del ${fmtFecha(cuadre.fecha)} como administrador?\n\nLos valores actuales quedarán registrados tal como están.`
    )) return;
    setCerrando(cuadre.id);
    await supabase.from('cuadres_caja').update({
      estado:     'cerrado',
      cerrado_at: new Date().toISOString(),
      notas:      'Cerrado por administrador desde historial.',
    }).eq('id', cuadre.id);
    setCerrando(null);
    load();
  };

  const pendientes = cuadres.filter(c => c.estado === 'abierto' && c.fecha < hoy).length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:12 }}>
        <div>
          <h1 style={{ fontSize:21, fontWeight:700, color:T.hi, margin:0 }}>Historial de cuadres</h1>
          <p style={{ fontSize:12.5, color:T.lo, marginTop:4 }}>
            {cuadres.length} registro{cuadres.length!==1?'s':''} encontrado{cuadres.length!==1?'s':''}
            {pendientes > 0 && (
              <span style={{ marginLeft:10, color:T.warn, fontWeight:600 }}>
                · {pendientes} cuadre{pendientes>1?'s':''} pendiente{pendientes>1?'s':''}
              </span>
            )}
          </p>
        </div>
        {canExport && (
          <Btn icon={<Ico.Download s={14}/>} onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exportando...' : 'Exportar a Excel'}
          </Btn>
        )}
      </div>

      {exportErr && (
        <div style={{ background:T.critBg, border:`1px solid ${T.crit}`, borderRadius:8,
          padding:'10px 14px', fontSize:12.5, color:T.crit }}>
          {exportErr}
        </div>
      )}

      {/* Filtros */}
      <div style={{ background:T.surface, borderRadius:12, border:`1px solid ${T.border}`,
        padding:'14px 18px', display:'flex', gap:14, alignItems:'flex-end', flexWrap:'wrap' }}>

        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, color:T.lo,
            textTransform:'uppercase', letterSpacing:'0.07em' }}>Desde</label>
          <input type="date" value={fechaDesde} max={fechaHasta}
            onChange={e => setFechaDesde(e.target.value)}
            style={{ padding:'7px 10px', border:`1px solid ${T.border}`, borderRadius:8,
              fontFamily:'inherit', fontSize:13, color:T.hi, outline:'none', background:'var(--input-bg)' }}/>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, color:T.lo,
            textTransform:'uppercase', letterSpacing:'0.07em' }}>Hasta</label>
          <input type="date" value={fechaHasta} min={fechaDesde} max={hoy}
            onChange={e => setFechaHasta(e.target.value)}
            style={{ padding:'7px 10px', border:`1px solid ${T.border}`, borderRadius:8,
              fontFamily:'inherit', fontSize:13, color:T.hi, outline:'none', background:'var(--input-bg)' }}/>
        </div>

        {canSeeAllSedes && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, color:T.lo,
              textTransform:'uppercase', letterSpacing:'0.07em' }}>Sede</label>
            <select value={sedeFiltro} onChange={e => setSedeF(e.target.value)}
              style={{ padding:'7px 10px', border:`1px solid ${T.border}`, borderRadius:8,
                fontFamily:'inherit', fontSize:13, color:T.hi, outline:'none',
                background:'var(--input-bg)', cursor:'pointer', minWidth:160 }}>
              <option value="">Todas las sedes</option>
              {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div style={{ background:T.surface, borderRadius:12, border:`1px solid ${T.border}`,
        overflow:'hidden' }}>

        {/* Header tabla */}
        <div style={{ display:'grid',
          gridTemplateColumns: canSeeAllSedes ? '100px 1fr 110px 100px 100px 100px 100px 22px'
                                              : '100px 110px 100px 100px 100px 100px 22px',
          padding:'8px 18px', background:'var(--table-head-bg)',
          borderBottom:`1px solid ${T.border}` }}>
          {[
            'Fecha',
            ...(canSeeAllSedes ? ['Sede'] : []),
            'Ingreso','Gastos','Depósitos','Caja final','Estado','',
          ].map((h,i) => (
            <span key={i} style={{ fontSize:10.5, fontWeight:700, color:T.lo,
              textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding:'40px 18px', textAlign:'center', color:T.lo, fontSize:13 }}>
            Cargando...
          </div>
        ) : cuadres.length === 0 ? (
          <div style={{ padding:'40px 18px', textAlign:'center', color:T.lo, fontSize:13 }}>
            Sin cuadres en el período seleccionado
          </div>
        ) : (
          cuadres.map((c, i) => {
            const sem = semaforo(c.diferencia);
            const abiertoPasado = c.estado === 'abierto' && c.fecha < hoy;
            const isExpanded = expandedId === c.id;
            const cols = canSeeAllSedes
              ? '100px 1fr 110px 100px 100px 100px 100px 22px'
              : '100px 110px 100px 100px 100px 100px 22px';

            return (
              <div key={c.id} style={{ borderBottom: i < cuadres.length-1 ? `1px solid ${T.border}` : 'none' }}>
                <div
                  onClick={() => setExpanded(isExpanded ? null : c.id)}
                  style={{ display:'grid', gridTemplateColumns:cols,
                    padding:'12px 18px', alignItems:'center', cursor:'pointer',
                    background: abiertoPasado ? 'var(--warn-bg)' : 'transparent',
                    transition:'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = abiertoPasado ? 'var(--warn-bg)' : 'var(--row-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = abiertoPasado ? 'var(--warn-bg)' : 'transparent'}>

                  <span style={{ fontSize:13, color:T.hi, fontWeight:500 }}>
                    {fmtFecha(c.fecha)}
                    {abiertoPasado && <span style={{ marginLeft:6, fontSize:10, color:T.warn }}>⚠</span>}
                  </span>
                  {canSeeAllSedes && (
                    <span style={{ fontSize:13, color:T.mid }}>{c.sede_nombre}</span>
                  )}
                  <span style={{ fontSize:13, color:T.ok, fontWeight:500 }}>{fmtQ(c.ingreso_dia)}</span>
                  <span style={{ fontSize:13, color:T.crit }}>{fmtQ(c.total_gastos)}</span>
                  <span style={{ fontSize:13, color:'#7C3AED' }}>{fmtQ(c.total_depositos)}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:T.hi }}>{fmtQ(c.caja_final)}</span>
                  {abiertoPasado
                    ? <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px',
                        borderRadius:20, background:T.warnBg, color:T.warn, fontSize:11, fontWeight:600,
                        whiteSpace:'nowrap' }}>
                        Pendiente
                      </span>
                    : <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px',
                        borderRadius:20, background:sem.bg, color:sem.c, fontSize:11, fontWeight:600,
                        whiteSpace:'nowrap' }}>
                        {sem.label}
                      </span>
                  }
                  <span style={{ color:T.lo, fontSize:9, display:'flex', alignItems:'center',
                    transform: isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                </div>

                {isExpanded && (
                  <DetallePanel
                    cuadreId={c.id}
                    abiertoPasado={abiertoPasado}
                    isAdmin={isAdmin}
                    cerrando={cerrando === c.id}
                    onCerrar={() => cerrarForzado(c)}
                    notas={c.notas}
                    diferencia={Number(c.diferencia)}
                    totalDepositos={Number(c.total_depositos)}/>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
