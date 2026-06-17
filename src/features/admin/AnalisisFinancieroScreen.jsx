import { useState, useEffect, useCallback } from 'react';
import { T, Ico, fmtQ } from '../../shared/ui';
import { supabase } from '../../lib/supabase';

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

function SummaryCard({ label, value, color, bg, sub }) {
  return (
    <div style={{ background:bg, borderRadius:12, padding:'18px 20px',
      border:`1px solid ${color}33`, display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ fontSize:10.5, fontWeight:700, color, textTransform:'uppercase',
        letterSpacing:'0.07em' }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, color, lineHeight:1 }}>{fmtQ(value)}</div>
      {sub && <div style={{ fontSize:11, color, opacity:0.7 }}>{sub}</div>}
    </div>
  );
}

function MiniBreakdown({ label, items }) {
  return (
    <div style={{ background:T.surface, borderRadius:10, padding:'14px 16px',
      border:`1px solid ${T.border}` }}>
      <div style={{ fontSize:11, fontWeight:700, color:T.lo, textTransform:'uppercase',
        letterSpacing:'0.06em', marginBottom:10 }}>{label}</div>
      {items.map((it, i) => (
        <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'5px 0', borderBottom: i < items.length-1 ? `1px solid ${T.border}` : 'none' }}>
          <span style={{ fontSize:12.5, color:T.mid }}>{it.label}</span>
          <span style={{ fontSize:13, fontWeight:600, color:it.color || T.hi }}>{fmtQ(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

const selStyle = {
  padding:'7px 14px', border:`1px solid ${T.border}`, borderRadius:8,
  fontFamily:'inherit', fontSize:13, color:T.hi, background:T.surface,
  outline:'none', cursor:'pointer',
};

export function AnalisisFinancieroScreen({ sedes }) {
  const now  = new Date();
  const [mes,     setMes]     = useState(now.getMonth() + 1);
  const [anio,    setAnio]    = useState(now.getFullYear());
  const [filSede, setFilSede] = useState('');
  const [data,    setData]    = useState(null);
  const [loading, setLoad]    = useState(false);

  const load = useCallback(async () => {
    setLoad(true);

    const inicio    = `${anio}-${String(mes).padStart(2,'0')}-01`;
    const mesNext   = mes === 12 ? 1 : mes + 1;
    const anioNext  = mes === 12 ? anio + 1 : anio;
    const fin       = `${anioNext}-${String(mesNext).padStart(2,'0')}-01`;

    // 0. Facturación IGSS Gomera (ventas_facturas categoria=igss del período)
    const { data: igssData } = await supabase
      .from('ventas_facturas')
      .select('estado, monto_total, retencion_iva, pago_esperado, fecha_pago')
      .eq('categoria', 'igss')
      .gte('fecha_emision', inicio)
      .lt('fecha_emision', fin);

    // 1. Cuadres cerrados del período
    let q1 = supabase.from('cuadres_caja')
      .select('id, sede_id, ingreso_dia')
      .eq('estado','cerrado')
      .gte('fecha', inicio)
      .lt('fecha', fin);
    if (filSede) q1 = q1.eq('sede_id', filSede);
    const { data: cuadres } = await q1;

    // 2. Gastos de caja (caja chica) vinculados a esos cuadres
    const cuadreIds = (cuadres || []).map(c => c.id);
    let gastosCajaData = [];
    if (cuadreIds.length > 0) {
      const { data: gd } = await supabase
        .from('gastos_caja')
        .select('cuadre_id, monto')
        .in('cuadre_id', cuadreIds);
      gastosCajaData = gd || [];
    }

    // 3. Compras a proveedores del período
    let q3 = supabase.from('compras')
      .select('sede_id, monto_total')
      .gte('fecha_recepcion', inicio)
      .lt('fecha_recepcion', fin);
    if (filSede) q3 = q3.eq('sede_id', filSede);
    const { data: comprasData } = await q3;

    // 4. Gastos fijos activos
    const { data: fijosData } = await supabase
      .from('gastos_fijos')
      .select('sede_id, monto_mensual, nombre, categoria')
      .eq('activo', true);

    // Construir mapa por sede
    const sedesList = filSede ? sedes.filter(s => s.id === filSede) : sedes;
    const sedeMap = {};
    for (const s of sedesList) {
      sedeMap[s.id] = { nombre:s.nombre, ingresos:0, gastosCaja:0, compras:0, gastosFijos:0 };
    }

    // Mapa cuadre_id → sede_id
    const cuadreSedeMap = {};
    for (const c of (cuadres || [])) {
      cuadreSedeMap[c.id] = c.sede_id;
      if (sedeMap[c.sede_id]) sedeMap[c.sede_id].ingresos += Number(c.ingreso_dia || 0);
    }

    for (const g of gastosCajaData) {
      const sid = cuadreSedeMap[g.cuadre_id];
      if (sid && sedeMap[sid]) sedeMap[sid].gastosCaja += Number(g.monto || 0);
    }

    for (const c of (comprasData || [])) {
      if (sedeMap[c.sede_id]) sedeMap[c.sede_id].compras += Number(c.monto_total || 0);
    }

    // Gastos fijos: sede_id=null es costo general de la org
    let costoGeneral = 0;
    for (const f of (fijosData || [])) {
      if (!f.sede_id) {
        costoGeneral += Number(f.monto_mensual || 0);
      } else if (sedeMap[f.sede_id]) {
        sedeMap[f.sede_id].gastosFijos += Number(f.monto_mensual || 0);
      }
    }

    // Resumen IGSS
    const igssRows = igssData || [];
    const igss = {
      totalFacturas:  igssRows.length,
      totalBruto:     igssRows.reduce((s,r) => s + Number(r.monto_total    || 0), 0),
      totalIVA:       igssRows.reduce((s,r) => s + Number(r.retencion_iva  || 0), 0),
      totalDeposito:  igssRows.reduce((s,r) => s + Number(r.pago_esperado  || 0), 0),
      depositoPagado: igssRows.filter(r => r.estado === 'pagada')
                              .reduce((s,r) => s + Number(r.pago_esperado  || 0), 0),
      pendientes:     igssRows.filter(r => r.estado === 'pendiente').length,
    };

    setData({ sedeMap, costoGeneral, igss });
    setLoad(false);
  }, [mes, anio, filSede, sedes]);

  useEffect(() => { load(); }, [load]);

  // Totales
  const sedeRows   = data ? Object.values(data.sedeMap) : [];
  const costoGen   = data?.costoGeneral || 0;
  const igss       = data?.igss || { totalFacturas:0, totalBruto:0, totalIVA:0, totalDeposito:0, depositoPagado:0, pendientes:0 };
  const totalCaja  = sedeRows.reduce((s,r) => s + r.ingresos, 0);
  const totalIng   = totalCaja + igss.depositoPagado;  // caja + IGSS cobrado
  const totalGCaja = sedeRows.reduce((s,r) => s + r.gastosCaja, 0);
  const totalComp  = sedeRows.reduce((s,r) => s + r.compras, 0);
  const totalFijos = sedeRows.reduce((s,r) => s + r.gastosFijos, 0) + costoGen;
  const totalVar   = totalGCaja + totalComp;
  const totalEgr   = totalVar + totalFijos;
  const utilidad   = totalIng - totalEgr;

  const anios = [now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:22 }}>

      {/* Encabezado */}
      <div>
        <h1 style={{ fontSize:21, fontWeight:700, color:T.hi, letterSpacing:'-0.025em', margin:0 }}>
          Análisis Financiero
        </h1>
        <p style={{ fontSize:12.5, color:T.lo, marginTop:4 }}>
          Ingresos, egresos y utilidad neta por período
        </p>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap',
        background:T.surface, borderRadius:10, padding:'12px 16px', border:`1px solid ${T.border}` }}>
        <Ico.Calendar s={15} c={T.lo}/>
        <select value={mes} onChange={e => setMes(Number(e.target.value))} style={selStyle}>
          {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={selStyle}>
          {anios.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ width:1, height:24, background:T.border, margin:'0 4px' }}/>
        <Ico.Map s={14} c={T.lo}/>
        <select value={filSede} onChange={e => setFilSede(e.target.value)} style={selStyle}>
          <option value="">Todas las sedes</option>
          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:T.lo, fontSize:13 }}>
          Calculando período {MESES[mes-1]} {anio}...
        </div>
      ) : data && (
        <>
          {/* Tarjetas resumen */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            <SummaryCard
              label="Ingresos totales"
              value={totalIng}
              color={T.ok}
              bg={T.okBg}
              sub={`Caja ${fmtQ(totalCaja)} + IGSS ${fmtQ(igss.depositoPagado)}`}
            />
            <SummaryCard
              label="Gastos Variables"
              value={totalVar}
              color={T.warn}
              bg={T.warnBg}
              sub="Caja chica + compras"
            />
            <SummaryCard
              label="Gastos Fijos"
              value={totalFijos}
              color="#7C3AED"
              bg="#F5F3FF"
              sub="Costos mensuales programados"
            />
            <SummaryCard
              label="Utilidad Neta"
              value={utilidad}
              color={utilidad >= 0 ? T.ok : T.crit}
              bg={utilidad >= 0 ? T.okBg : T.critBg}
              sub={utilidad >= 0 ? 'Resultado positivo' : 'Resultado negativo'}
            />
          </div>

          {/* Desglose de egresos */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <MiniBreakdown
              label="Desglose egresos variables"
              items={[
                { label:'Caja chica (gastos diarios)', value:totalGCaja, color:T.warn },
                { label:'Compras a proveedores',        value:totalComp,  color:T.warn },
              ]}
            />
            <MiniBreakdown
              label="Desglose gastos fijos"
              items={[
                { label:'Por sede específica', value:totalFijos - costoGen, color:'#7C3AED' },
                { label:'Costos generales org.', value:costoGen, color:'#7C3AED' },
              ]}
            />
            <div style={{ background:T.surface, borderRadius:10, padding:'14px 16px',
              border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.lo, textTransform:'uppercase',
                letterSpacing:'0.06em', marginBottom:10 }}>Resumen</div>
              {[
                { label:'Total ingresos',  value:totalIng,  color:T.ok },
                { label:'(-) Gastos variables', value:totalVar, color:T.warn },
                { label:'(-) Gastos fijos', value:totalFijos, color:'#7C3AED' },
                { label:'= Utilidad neta', value:utilidad, color:utilidad>=0?T.ok:T.crit, bold:true },
              ].map((row,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'5px 0', borderBottom:i<3?`1px solid ${T.border}`:'none',
                  borderTop:i===3?`2px solid ${T.border}`:'none', marginTop:i===3?4:0 }}>
                  <span style={{ fontSize:12, color:T.mid, fontWeight:row.bold?700:400 }}>{row.label}</span>
                  <span style={{ fontSize:13, fontWeight:row.bold?800:600, color:row.color }}>{fmtQ(row.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla por sede */}
          {sedeRows.length > 0 && (
            <div style={{ background:T.surface, borderRadius:12, border:`1px solid ${T.border}`, overflow:'hidden' }}>
              <div style={{ padding:'14px 20px', borderBottom:`1px solid ${T.border}`,
                display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:13.5, fontWeight:600, color:T.hi }}>Desglose por sede</span>
                <span style={{ fontSize:11.5, color:T.lo }}>{MESES[mes-1]} {anio}</span>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1fr 1fr 1fr',
                padding:'8px 20px', borderBottom:`1px solid ${T.border}`, background:'var(--table-head-bg)' }}>
                {['Sede','Ingresos','G. Caja','Compras','G. Fijos','Utilidad'].map((h,i) => (
                  <span key={i} style={{ fontSize:10.5, fontWeight:700, color:T.lo,
                    textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</span>
                ))}
              </div>

              {sedeRows.map((s, i) => {
                const egr  = s.gastosCaja + s.compras + s.gastosFijos;
                const util = s.ingresos - egr;
                return (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1fr 1fr 1fr',
                    padding:'12px 20px', alignItems:'center',
                    borderBottom: i < sedeRows.length-1 ? `1px solid ${T.border}` : 'none' }}>
                    <span style={{ fontSize:13, fontWeight:500, color:T.hi }}>{s.nombre}</span>
                    <span style={{ fontSize:12.5, fontWeight:600, color:T.ok }}>{fmtQ(s.ingresos)}</span>
                    <span style={{ fontSize:12.5, color:T.warn }}>{fmtQ(s.gastosCaja)}</span>
                    <span style={{ fontSize:12.5, color:T.warn }}>{fmtQ(s.compras)}</span>
                    <span style={{ fontSize:12.5, color:'#7C3AED' }}>{fmtQ(s.gastosFijos)}</span>
                    <span style={{ fontSize:12.5, fontWeight:700, color:util>=0?T.ok:T.crit }}>
                      {fmtQ(util)}
                    </span>
                  </div>
                );
              })}

              {/* Fila costos generales */}
              {costoGen > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1fr 1fr 1fr',
                  padding:'10px 20px', alignItems:'center', background:'#F5F3FF',
                  borderTop:`1px solid #E9D5FF` }}>
                  <span style={{ fontSize:12, fontStyle:'italic', color:'#7C3AED' }}>
                    + Costos generales org.
                  </span>
                  <span/>
                  <span/>
                  <span/>
                  <span style={{ fontSize:12.5, color:'#7C3AED', fontWeight:600 }}>{fmtQ(costoGen)}</span>
                  <span/>
                </div>
              )}

              {/* Fila total */}
              <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1fr 1fr 1fr',
                padding:'12px 20px', alignItems:'center',
                background:'var(--table-head-bg)', borderTop:`2px solid ${T.border}` }}>
                <span style={{ fontSize:13, fontWeight:700, color:T.hi }}>TOTAL</span>
                <span style={{ fontSize:13, fontWeight:700, color:T.ok }}>{fmtQ(totalIng)}</span>
                <span style={{ fontSize:13, fontWeight:700, color:T.warn }}>{fmtQ(totalGCaja)}</span>
                <span style={{ fontSize:13, fontWeight:700, color:T.warn }}>{fmtQ(totalComp)}</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#7C3AED' }}>{fmtQ(totalFijos)}</span>
                <span style={{ fontSize:13, fontWeight:800, color:utilidad>=0?T.ok:T.crit }}>
                  {fmtQ(utilidad)}
                </span>
              </div>
            </div>
          )}

          {sedeRows.length === 0 && igss.totalFacturas === 0 && (
            <div style={{ textAlign:'center', padding:'48px 20px', background:T.surface,
              borderRadius:12, border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:13.5, color:T.lo }}>Sin datos para {MESES[mes-1]} {anio}</div>
              <div style={{ fontSize:12, color:T.lo, marginTop:4 }}>
                No hay cuadres cerrados ni compras registradas en este período.
              </div>
            </div>
          )}

          {/* Sección IGSS Gomera */}
          {(igss.totalFacturas > 0 || true) && (
            <div style={{ background:T.surface, borderRadius:12, border:`1px solid #6EE7B733`,
              overflow:'hidden' }}>
              <div style={{ padding:'14px 20px', borderBottom:`1px solid #6EE7B733`,
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'#F0FDF4' }}>
                <div>
                  <span style={{ fontSize:13.5, fontWeight:700, color:'#065F46' }}>
                    Facturación IGSS — Sede Gomera
                  </span>
                  <span style={{ fontSize:11.5, color:'#6EE7B7', marginLeft:10 }}>
                    facturas emitidas en {MESES[mes-1]} {anio}
                  </span>
                </div>
                <span style={{ fontSize:11.5, color:'#065F46', background:'#D1FAE5',
                  padding:'2px 10px', borderRadius:20, fontWeight:600 }}>
                  {igss.totalFacturas} factura(s)
                </span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:0 }}>
                {[
                  { label:'Total facturado',    value:igss.totalBruto,      color:'#065F46', note: null },
                  { label:'IVA retenido (12%)', value:igss.totalIVA,        color:'#D97706', note:'Queda en IGSS' },
                  { label:'Depósito esperado',  value:igss.totalDeposito,   color:T.ok,      note:`${igss.pendientes} pendiente(s)` },
                  { label:'Ya cobrado',         value:igss.depositoPagado,  color:T.tealDk,  note:'Estado: Pagada' },
                  { label:'Por cobrar',         value:igss.totalDeposito - igss.depositoPagado, color:'#D97706', note:'Pendiente de pago' },
                ].map(({ label, value, color, note }, i) => (
                  <div key={label} style={{ padding:'14px 18px',
                    borderRight: i < 4 ? `1px solid #6EE7B733` : 'none' }}>
                    <div style={{ fontSize:10.5, color:'#6B7280', fontWeight:700,
                      textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{label}</div>
                    <div style={{ fontSize:17, fontWeight:800, color }}>{fmtQ(value)}</div>
                    {note && <div style={{ fontSize:10.5, color:'#9CA3AF', marginTop:3 }}>{note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function cuadresSub(rows) {
  // placeholder — cuadres count not tracked in this view
  return '';
}
