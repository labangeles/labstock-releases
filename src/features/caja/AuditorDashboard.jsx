import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { T, Ico, Btn } from '../../shared/ui';
import { supabase } from '../../lib/supabase';

/* ── Helpers ─────────────────────────────────────────────── */
const fmtQ = n =>
  n == null ? '—'
  : 'Q ' + Math.abs(Number(n)).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtQAxis = n => {
  const abs = Math.abs(n);
  if (abs >= 1000) return 'Q' + (abs / 1000).toFixed(0) + 'k';
  return 'Q' + abs.toFixed(0);
};

const C = {
  ingreso:   '#0E7490',
  gastos:    '#DC2626',
  depositos: '#7C3AED',
  ingresoL:  '#E0F2FE',
  gastosL:   '#FEE2E2',
  depositosL:'#EDE9FE',
};

const PERIODOS = [
  { id: 'semana',  label: 'Esta semana'  },
  { id: 'mes',     label: 'Este mes'     },
  { id: 'mes_ant', label: 'Mes anterior' },
  { id: '30d',     label: 'Últimos 30 d' },
];

function getRange(p) {
  const now   = new Date();
  const today = now.toISOString().split('T')[0];
  if (p === 'semana') {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return { start: d.toISOString().split('T')[0], end: today };
  }
  if (p === 'mes') {
    return {
      start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      end: today,
    };
  }
  if (p === 'mes_ant') {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] };
  }
  const d = new Date(); d.setDate(d.getDate() - 29);
  return { start: d.toISOString().split('T')[0], end: today };
}

/* ── Tooltip personalizado ───────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
      fontSize: 12.5, minWidth: 170,
    }}>
      <div style={{ fontWeight: 700, color: T.hi, marginBottom: 8, fontSize: 12 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{
          display: 'flex', justifyContent: 'space-between', gap: 20,
          marginBottom: 4, alignItems: 'center',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.mid }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }}/>
            {p.name}
          </span>
          <span style={{ color: T.hi, fontWeight: 700 }}>{fmtQ(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── KPI Card ────────────────────────────────────────────── */
function KpiCard({ label, value, sub, color, bg, icon }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 6,
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: T.lo, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: T.lo }}>{sub}</div>}
    </div>
  );
}

/* ── Sección con título ──────────────────────────────────── */
function Section({ title, sub, children }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'baseline', gap: 10,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.hi }}>{title}</span>
        {sub && <span style={{ fontSize: 11.5, color: T.lo }}>{sub}</span>}
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

/* ── Eje Y con fondo limpio ──────────────────────────────── */
const AxisTick = ({ x, y, payload }) => (
  <text x={x} y={y} dy={4} textAnchor="end"
    fill={T.lo} fontSize={11} fontFamily="inherit">
    {fmtQAxis(payload.value)}
  </text>
);
const AxisTickX = ({ x, y, payload }) => (
  <text x={x} y={y + 12} textAnchor="middle"
    fill={T.lo} fontSize={11} fontFamily="inherit">
    {payload.value}
  </text>
);

/* ══════════════════════════════════════════════════════════
   DASHBOARD PRINCIPAL
══════════════════════════════════════════════════════════ */
export function AuditorDashboard({ onGoHistorial }) {
  const [periodo, setPeriodo] = useState('mes');
  const [cuadres, setCuadres] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = getRange(periodo);
    const { data } = await supabase
      .from('v_cuadres_resumen')
      .select('*')
      .gte('fecha', start)
      .lte('fecha', end)
      .order('fecha');
    setCuadres(data || []);
    setLoading(false);
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  /* Agregados por sede */
  const sedeMap = {};
  cuadres.forEach(c => {
    if (!sedeMap[c.sede_id]) sedeMap[c.sede_id] = {
      name: c.sede_nombre, ingreso: 0, gastos: 0, depositos: 0,
      diferencia: 0, total: 0, descuadrados: 0,
    };
    const s = sedeMap[c.sede_id];
    s.ingreso    += Number(c.ingreso_dia     || 0);
    s.gastos     += Number(c.total_gastos    || 0);
    s.depositos  += Number(c.total_depositos || 0);
    s.diferencia += Number(c.diferencia      || 0);
    s.total++;
    if (Math.abs(Number(c.diferencia)) > 0.01) s.descuadrados++;
  });
  const sedeData = Object.values(sedeMap).sort((a, b) => b.ingreso - a.ingreso);

  /* Agregados por día */
  const dayMap = {};
  cuadres.forEach(c => {
    if (!dayMap[c.fecha]) dayMap[c.fecha] = { fecha: c.fecha, ingreso: 0, gastos: 0, depositos: 0 };
    dayMap[c.fecha].ingreso    += Number(c.ingreso_dia     || 0);
    dayMap[c.fecha].gastos     += Number(c.total_gastos    || 0);
    dayMap[c.fecha].depositos  += Number(c.total_depositos || 0);
  });
  const dailyData = Object.values(dayMap)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(d => ({
      ...d,
      label: new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short' }),
    }));

  /* KPIs globales */
  const totalIngreso      = sedeData.reduce((s, r) => s + r.ingreso,  0);
  const totalGastos       = sedeData.reduce((s, r) => s + r.gastos,   0);
  const totalDepositos    = sedeData.reduce((s, r) => s + r.depositos, 0);
  const totalDescuadrados = sedeData.reduce((s, r) => s + r.descuadrados, 0);

  const periodoLabel = PERIODOS.find(p => p.id === periodo)?.label || '';

  /* ── Render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, color: T.hi, margin: 0, letterSpacing: '-0.025em' }}>
            Resumen contable
          </h1>
          <p style={{ fontSize: 12.5, color: T.lo, marginTop: 4 }}>
            Laboratorio Clínico Los Ángeles · {sedeData.length} sedes
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Selector de período */}
          <div style={{
            display: 'flex', background: T.canvas, borderRadius: 10,
            border: `1px solid ${T.border}`, padding: 3, gap: 2,
          }}>
            {PERIODOS.map(p => (
              <button key={p.id} onClick={() => setPeriodo(p.id)}
                style={{
                  padding: '5px 12px', borderRadius: 7, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                  fontWeight: periodo === p.id ? 700 : 400,
                  background: periodo === p.id ? T.surface : 'transparent',
                  color: periodo === p.id ? T.hi : T.lo,
                  boxShadow: periodo === p.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.12s',
                }}>
                {p.label}
              </button>
            ))}
          </div>

          <Btn variant="secondary" size="sm" icon={<Ico.History s={13}/>} onClick={onGoHistorial}>
            Ver historial
          </Btn>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: T.lo, fontSize: 13 }}>
          Cargando datos...
        </div>
      ) : cuadres.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <Ico.DollarSign s={36} c={T.border}/>
          <div style={{ fontSize: 14, color: T.lo, marginTop: 12 }}>Sin datos para {periodoLabel.toLowerCase()}</div>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <KpiCard
              label="Ingreso total" color={C.ingreso} bg={C.ingresoL}
              value={fmtQ(totalIngreso)}
              sub={`${cuadres.length} cuadres registrados`}
              icon={<Ico.DollarSign s={17} c={C.ingreso}/>}
            />
            <KpiCard
              label="Gastos totales" color={C.gastos} bg={C.gastosL}
              value={fmtQ(totalGastos)}
              sub={`${((totalGastos/totalIngreso)*100||0).toFixed(1)}% del ingreso`}
              icon={<Ico.Banknote s={17} c={C.gastos}/>}
            />
            <KpiCard
              label="Depósitos totales" color={C.depositos} bg={C.depositosL}
              value={fmtQ(totalDepositos)}
              sub={`${((totalDepositos/totalIngreso)*100||0).toFixed(1)}% del ingreso`}
              icon={<Ico.Inbox s={17} c={C.depositos}/>}
            />
            <KpiCard
              label="Días descuadrados" color={totalDescuadrados > 0 ? T.warn : T.ok}
              bg={totalDescuadrados > 0 ? T.warnBg : T.okBg}
              value={String(totalDescuadrados)}
              sub={totalDescuadrados === 0 ? 'Sin diferencias detectadas' : 'Requieren revisión'}
              icon={<Ico.Warn s={17} c={totalDescuadrados > 0 ? T.warn : T.ok}/>}
            />
          </div>

          {/* Gráficos fila */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>

            {/* Barras por sede */}
            <Section title="Por sede" sub={periodoLabel.toLowerCase()}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                {[
                  { color: C.ingreso,   label: 'Ingreso'   },
                  { color: C.gastos,    label: 'Gastos'    },
                  { color: C.depositos, label: 'Depósitos' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flexShrink: 0 }}/>
                    <span style={{ fontSize: 11.5, color: T.mid }}>{l.label}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sedeData} barGap={3} barCategoryGap="28%"
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={T.border} strokeDasharray="3 3"/>
                  <XAxis dataKey="name" tick={AxisTickX} axisLine={false} tickLine={false}/>
                  <YAxis tick={AxisTick} axisLine={false} tickLine={false} width={52}/>
                  <Tooltip content={<ChartTooltip/>} cursor={{ fill: '#F0F9FF', radius: 4 }}/>
                  <Bar dataKey="ingreso"   name="Ingreso"   fill={C.ingreso}   radius={[5,5,0,0]}/>
                  <Bar dataKey="gastos"    name="Gastos"    fill={C.gastos}    radius={[5,5,0,0]}/>
                  <Bar dataKey="depositos" name="Depósitos" fill={C.depositos} radius={[5,5,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Section>

            {/* Tendencia diaria */}
            <Section title="Tendencia diaria" sub={`${dailyData.length} días con operaciones`}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                {[
                  { color: C.ingreso,   label: 'Ingreso'   },
                  { color: C.gastos,    label: 'Gastos'    },
                  { color: C.depositos, label: 'Depósitos' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 3, borderRadius: 2, background: l.color, flexShrink: 0 }}/>
                    <span style={{ fontSize: 11.5, color: T.mid }}>{l.label}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gIngreso" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.ingreso}   stopOpacity={0.15}/>
                      <stop offset="95%" stopColor={C.ingreso}   stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gGastos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.gastos}    stopOpacity={0.12}/>
                      <stop offset="95%" stopColor={C.gastos}    stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gDepositos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.depositos} stopOpacity={0.12}/>
                      <stop offset="95%" stopColor={C.depositos} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={T.border} strokeDasharray="3 3"/>
                  <XAxis dataKey="label" tick={AxisTickX} axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(dailyData.length / 7) - 1)}/>
                  <YAxis tick={AxisTick} axisLine={false} tickLine={false} width={52}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Area dataKey="ingreso"   name="Ingreso"   stroke={C.ingreso}
                    fill="url(#gIngreso)"   strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }}/>
                  <Area dataKey="gastos"    name="Gastos"    stroke={C.gastos}
                    fill="url(#gGastos)"    strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }}/>
                  <Area dataKey="depositos" name="Depósitos" stroke={C.depositos}
                    fill="url(#gDepositos)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }}/>
                </AreaChart>
              </ResponsiveContainer>
            </Section>
          </div>

          {/* Tabla resumen por sede */}
          <Section title="Detalle por sede" sub={periodoLabel.toLowerCase()}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F4F8FA' }}>
                    {['Sede','Cuadres','Ingreso','Gastos','% Gastos','Depósitos','Diferencia acum.','Días desc.'].map(h => (
                      <th key={h} style={{
                        padding: '9px 14px', textAlign: h === 'Sede' ? 'left' : 'right',
                        fontSize: 10.5, fontWeight: 700, color: T.lo,
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sedeData.map((s, i) => {
                    const pctGastos = s.ingreso > 0 ? ((s.gastos / s.ingreso) * 100).toFixed(1) : '—';
                    const difColor  = Math.abs(s.diferencia) < 0.01 ? T.ok : s.diferencia > 0 ? T.warn : T.crit;
                    return (
                      <tr key={s.name}
                        style={{ borderBottom: i < sedeData.length - 1 ? `1px solid ${T.border}` : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F5F9FB'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '11px 14px', fontWeight: 600, color: T.hi }}>{s.name}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', color: T.mid }}>{s.total}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 600, color: C.ingreso }}>
                          {fmtQ(s.ingreso)}
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', color: C.gastos }}>
                          {fmtQ(s.gastos)}
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', color: T.mid }}>
                          <span style={{
                            background: Number(pctGastos) > 30 ? T.warnBg : T.okBg,
                            color: Number(pctGastos) > 30 ? T.warn : T.ok,
                            padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                          }}>{pctGastos}%</span>
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', color: C.depositos }}>
                          {fmtQ(s.depositos)}
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: difColor }}>
                          {Math.abs(s.diferencia) < 0.01 ? (
                            <span style={{ color: T.ok, fontWeight: 600 }}>Cuadrado</span>
                          ) : (
                            (s.diferencia > 0 ? '+' : '') + fmtQ(s.diferencia)
                          )}
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                          {s.descuadrados > 0 ? (
                            <span style={{
                              background: T.warnBg, color: T.warn,
                              padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                            }}>{s.descuadrados}</span>
                          ) : (
                            <span style={{ color: T.ok, fontSize: 12 }}>✓</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Fila totales */}
                  <tr style={{ background: '#F4F8FA', borderTop: `2px solid ${T.border}` }}>
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: T.hi }}>Total</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: T.hi }}>
                      {cuadres.length}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: C.ingreso }}>
                      {fmtQ(totalIngreso)}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: C.gastos }}>
                      {fmtQ(totalGastos)}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: T.mid }}>
                      <span style={{
                        background: (totalGastos/totalIngreso*100) > 30 ? T.warnBg : T.okBg,
                        color:       (totalGastos/totalIngreso*100) > 30 ? T.warn   : T.ok,
                        padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                      }}>
                        {totalIngreso > 0 ? ((totalGastos/totalIngreso)*100).toFixed(1) : '—'}%
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: C.depositos }}>
                      {fmtQ(totalDepositos)}
                    </td>
                    <td colSpan={2} style={{ padding: '11px 14px', textAlign: 'right', color: T.lo, fontSize: 11.5 }}>
                      {totalDescuadrados} día{totalDescuadrados !== 1 ? 's' : ''} con diferencia
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
