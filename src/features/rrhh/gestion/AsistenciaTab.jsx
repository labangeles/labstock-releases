import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Btn, TInput, TSelect } from '../../../shared/ui';
import { useAuth } from '../../../contexts/AuthContext';
import logoUrl from '../../../assets/logo-icon-teal.png';

/* ─── constantes ─────────────────────────────────────────── */
const HORARIO_DEF = {
  hora_entrada: '07:00',
  hora_salida: '17:00',
  tiene_desayuno: false,
  duracion_desayuno_min: 15,
  duracion_comida_min: 60,
  tolerancia_min: 2,
  dias_laborales: [1, 2, 3, 4, 5],
};

const DIAS_LABELS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const TIPOS_LABELS = {
  entrada:          'Entrada',
  inicio_desayuno:  'Sale desayuno',
  fin_desayuno:     'Regresa desayuno',
  inicio_comida:    'Sale almuerzo',
  fin_comida:       'Regresa almuerzo',
  salida:           'Salida',
};

function getSecuencia(horario) {
  const seq = ['entrada'];
  if (horario?.tiene_desayuno) seq.push('inicio_desayuno', 'fin_desayuno');
  seq.push('inicio_comida', 'fin_comida', 'salida');
  return seq;
}

function hhmm(val) {
  if (!val) return '—';
  return new Date(val).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
}

function fechaHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function calcEstado(marcajes, horario) {
  if (marcajes.length === 0) return 'ausente';
  const esperados = getSecuencia(horario).length;
  if (marcajes.length >= esperados) {
    return marcajes.some(m => m.es_tardanza) ? 'tardanza' : 'completo';
  }
  return 'incompleto';
}

const ESTADO_STYLE = {
  completo:   { bg: '#D1FAE5', color: '#065F46', label: 'Completo' },
  tardanza:   { bg: '#FEF9C3', color: '#854D0E', label: 'Con tardanza' },
  incompleto: { bg: '#FEF3C7', color: '#92400E', label: 'Incompleto' },
  ausente:    { bg: '#FEE2E2', color: '#991B1B', label: 'Ausente' },
};

/* ─── helpers exportación ────────────────────────────────── */
function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function toBase64(url) {
  try {
    const res  = await fetch(url);
    const buf  = await res.arrayBuffer();
    const b64  = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const mime = res.headers.get('content-type') || 'image/png';
    return `data:${mime};base64,${b64}`;
  } catch { return ''; }
}

function primerDiaMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

function datesInRange(from, to) {
  const dates = [];
  const cur = new Date(from + 'T12:00:00');
  const fin = new Date(to   + 'T12:00:00');
  while (cur <= fin) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function fmtFechaLarga(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-GT', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

function buildReporteHTML({ logoB64, empleado, horario, diasConMarcajes, fechaDesde, fechaHasta, adminNombre }) {
  const diasHabiles  = diasConMarcajes.filter(d => !d.esFinDeSemana);
  const presentes    = diasHabiles.filter(d => d.estado !== 'ausente').length;
  const tardanzas    = diasHabiles.filter(d => d.estado === 'tardanza').length;
  const ausentes     = diasHabiles.filter(d => d.estado === 'ausente').length;
  const incompletos  = diasHabiles.filter(d => d.estado === 'incompleto').length;
  const diasTotal    = diasHabiles.length;

  const estadoBadge = (est) => {
    const mp = {
      completo:   ['#D1FAE5','#065F46','Completo'],
      tardanza:   ['#FEF9C3','#854D0E','Con tardanza'],
      incompleto: ['#FEF3C7','#92400E','Incompleto'],
      ausente:    ['#FEE2E2','#991B1B','Ausente'],
    };
    const [bg, c, lbl] = mp[est] || ['#F3F4F6','#6B7280', est];
    return `<span style="background:${bg};color:${c};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">${lbl}</span>`;
  };

  const filas = diasConMarcajes.map(d => {
    if (d.esFinDeSemana) {
      return `<tr style="opacity:.45"><td style="padding:5px 10px;font-size:11px;color:#9CA3AF">${esc(fmtFechaLarga(d.fecha))}</td><td colspan="7" style="padding:5px 10px;font-size:11px;color:#D1D5DB">— Fin de semana —</td></tr>`;
    }
    const get = (tipo) => {
      const m = d.marcajes.find(x => x.tipo === tipo);
      if (!m) return '<span style="color:#D1D5DB">—</span>';
      let html = `<span style="font-weight:600;color:#1F2937">${esc(hhmm(m.marcado_en))}</span>`;
      if (m.es_tardanza) html += `<sup style="margin-left:3px;background:#FEF9C3;color:#D97706;border-radius:3px;padding:0 3px;font-size:9px;font-weight:700">+${m.minutos_tardanza}m</sup>`;
      return html;
    };
    const bg = d.marcajes.length === 0 ? '#FFF7F7' : 'transparent';
    return `<tr style="border-bottom:1px solid #F3F4F6;background:${bg}">
      <td style="padding:6px 10px;font-size:11.5px;color:#374151">${esc(fmtFechaLarga(d.fecha))}</td>
      <td style="padding:6px 10px;text-align:center">${get('entrada')}</td>
      <td style="padding:6px 10px;text-align:center">${horario?.tiene_desayuno ? get('inicio_desayuno') : '<span style="color:#E5E7EB">—</span>'}</td>
      <td style="padding:6px 10px;text-align:center">${horario?.tiene_desayuno ? get('fin_desayuno')   : '<span style="color:#E5E7EB">—</span>'}</td>
      <td style="padding:6px 10px;text-align:center">${get('inicio_comida')}</td>
      <td style="padding:6px 10px;text-align:center">${get('fin_comida')}</td>
      <td style="padding:6px 10px;text-align:center">${get('salida')}</td>
      <td style="padding:6px 10px;text-align:center">${estadoBadge(d.estado)}</td>
    </tr>`;
  }).join('');

  const fmtR = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-GT', { day:'2-digit', month:'short', year:'numeric' });

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Asistencia — ${esc(empleado.nombre_completo)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#fff;color:#1F2937}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}@page{margin:18mm 16mm;size:A4 portrait}}
  .page{max-width:860px;margin:0 auto;padding:30px}
  .header{display:flex;align-items:center;gap:16px;padding-bottom:16px;border-bottom:2px solid #0D9488;margin-bottom:20px}
  .header img{width:46px;height:46px;object-fit:contain}
  .lab-name{font-size:18px;font-weight:800;color:#0D9488}
  .doc-title{font-size:11px;color:#6B7280;margin-top:2px;text-transform:uppercase;letter-spacing:.08em}
  .periodo-badge{margin-left:auto;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:8px 14px;text-align:right}
  .periodo-lbl{font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;color:#6B7280}
  .periodo-val{font-size:13px;font-weight:700;color:#065F46;margin-top:2px}
  .emp-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;gap:14px;align-items:center}
  .emp-av{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#0D9488,#0F766E);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:800;flex-shrink:0}
  .emp-name{font-size:15px;font-weight:700;color:#0F172A}
  .emp-sub{font-size:11.5px;color:#64748B;margin-top:2px}
  .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:18px}
  .stat{text-align:center;border-radius:8px;padding:9px 6px;border:1px solid}
  .stat-val{font-size:21px;font-weight:800}
  .stat-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.07em;margin-top:2px;font-weight:600}
  table{width:100%;border-collapse:collapse;font-size:11px}
  thead tr{background:#0D9488}
  th{padding:7px 10px;color:#fff;font-weight:700;font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;text-align:center}
  th:first-child{text-align:left}
  tr:nth-child(even){background:#F8FAFC}
  .footer{margin-top:24px;padding-top:12px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center}
  .footer-txt{font-size:10px;color:#9CA3AF}
  .print-btn{background:#0D9488;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
</style></head><body>
<div class="page">
  <div class="header">
    ${logoB64 ? `<img src="${logoB64}" alt="Logo"/>` : ''}
    <div><div class="lab-name">Laboratorio Clínico Ángeles</div><div class="doc-title">Reporte de Asistencia</div></div>
    <div class="periodo-badge"><div class="periodo-lbl">Período</div><div class="periodo-val">${esc(fmtR(fechaDesde))} — ${esc(fmtR(fechaHasta))}</div></div>
  </div>

  <div class="emp-card">
    <div class="emp-av">${esc((empleado.nombre || '?')[0].toUpperCase())}</div>
    <div>
      <div class="emp-name">${esc(empleado.nombre_completo)}</div>
      <div class="emp-sub">${esc(empleado.cargo || 'Sin cargo')}${empleado.sede ? ' · ' + esc(empleado.sede) : ''}</div>
    </div>
    <div style="margin-left:auto;text-align:right">
      <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;color:#6B7280">Horario</div>
      <div style="font-size:12px;font-weight:600;color:#0F172A;margin-top:2px">${esc(horario?.hora_entrada || '07:00')} – ${esc(horario?.hora_salida || '17:00')}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat" style="background:#EFF6FF;border-color:#BFDBFE"><div class="stat-val" style="color:#1D4ED8">${diasTotal}</div><div class="stat-lbl" style="color:#1D4ED8">Días hábiles</div></div>
    <div class="stat" style="background:#D1FAE5;border-color:#A7F3D0"><div class="stat-val" style="color:#065F46">${presentes}</div><div class="stat-lbl" style="color:#065F46">Presentes</div></div>
    <div class="stat" style="background:#FEF9C3;border-color:#FDE68A"><div class="stat-val" style="color:#854D0E">${tardanzas}</div><div class="stat-lbl" style="color:#854D0E">Tardanzas</div></div>
    <div class="stat" style="background:#FEF3C7;border-color:#FCD34D"><div class="stat-val" style="color:#92400E">${incompletos}</div><div class="stat-lbl" style="color:#92400E">Incompletos</div></div>
    <div class="stat" style="background:#FEE2E2;border-color:#FECACA"><div class="stat-val" style="color:#991B1B">${ausentes}</div><div class="stat-lbl" style="color:#991B1B">Ausentes</div></div>
  </div>

  <table>
    <thead><tr>
      <th style="text-align:left;min-width:130px">Fecha</th>
      <th>Entrada</th><th>☕ Sale</th><th>☕ Reg.</th>
      <th>🍽️ Sale</th><th>🍽️ Reg.</th><th>Salida</th><th>Estado</th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>

  <div class="footer">
    <div class="footer-txt">Generado por ${esc(adminNombre)} · ${new Date().toLocaleDateString('es-GT',{day:'2-digit',month:'short',year:'numeric'})}</div>
    <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  </div>
</div>
</body></html>`;
}

function mostrarReporte(html) {
  const prev = document.getElementById('__asist_overlay__');
  if (prev) prev.remove();
  const wrap = document.createElement('div');
  wrap.id = '__asist_overlay__';
  Object.assign(wrap.style, {
    position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.65)',
    display:'flex', alignItems:'center', justifyContent:'center',
  });
  const btn = document.createElement('button');
  btn.textContent = '✕ Cerrar';
  Object.assign(btn.style, {
    position:'absolute', top:12, right:16, background:'rgba(255,255,255,.92)',
    border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer',
    fontSize:13, fontWeight:700, zIndex:10000,
  });
  btn.onclick = () => wrap.remove();
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    width:'92vw', height:'93vh', border:'none', borderRadius:10, background:'#fff',
  });
  wrap.appendChild(btn);
  wrap.appendChild(iframe);
  document.body.appendChild(wrap);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
}

/* ─── HorarioForm inline ──────────────────────────────────── */
function HorarioForm({ empleado, horarioActual, onGuardado, onCancelar }) {
  const [form, setForm] = useState({
    hora_entrada:          horarioActual?.hora_entrada          || HORARIO_DEF.hora_entrada,
    hora_salida:           horarioActual?.hora_salida           || HORARIO_DEF.hora_salida,
    tiene_desayuno:        horarioActual?.tiene_desayuno        ?? HORARIO_DEF.tiene_desayuno,
    duracion_desayuno_min: horarioActual?.duracion_desayuno_min ?? HORARIO_DEF.duracion_desayuno_min,
    duracion_comida_min:   horarioActual?.duracion_comida_min   ?? HORARIO_DEF.duracion_comida_min,
    tolerancia_min:        horarioActual?.tolerancia_min        ?? HORARIO_DEF.tolerancia_min,
    dias_laborales:        horarioActual?.dias_laborales        ?? [...HORARIO_DEF.dias_laborales],
  });
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');

  const toggleDia = (d) => setForm(f => ({
    ...f,
    dias_laborales: f.dias_laborales.includes(d)
      ? f.dias_laborales.filter(x => x !== d)
      : [...f.dias_laborales, d].sort(),
  }));

  const guardar = async () => {
    if (!form.hora_entrada || !form.hora_salida) { setErr('Completa los campos de hora.'); return; }
    setGuardando(true); setErr('');
    try {
      const payload = {
        empleado_id:           empleado.id,
        organizacion_id:       empleado.organizacion_id,
        hora_entrada:          form.hora_entrada,
        hora_salida:           form.hora_salida,
        tiene_desayuno:        form.tiene_desayuno,
        duracion_desayuno_min: Number(form.duracion_desayuno_min),
        duracion_comida_min:   Number(form.duracion_comida_min),
        tolerancia_min:        Number(form.tolerancia_min),
        dias_laborales:        form.dias_laborales,
        updated_at:            new Date().toISOString(),
      };
      const { error } = horarioActual?.id
        ? await supabase.from('horarios_empleados').update(payload).eq('id', horarioActual.id)
        : await supabase.from('horarios_empleados').insert(payload);
      if (error) throw error;
      onGuardado();
    } catch (e) {
      setErr(e.message || 'Error al guardar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ background: T.canvas, borderRadius: 10, padding: 16, marginTop: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.hi, marginBottom: 12 }}>
        Horario de {empleado.nombre_completo}
      </div>

      {/* Días laborales */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11.5, color: T.lo, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Días laborales
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[1,2,3,4,5,6,7].map(d => (
            <button key={d} onClick={() => toggleDia(d)} style={{
              padding: '5px 11px', borderRadius: 7, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer',
              border: `1.5px solid ${form.dias_laborales.includes(d) ? T.teal : T.border}`,
              background: form.dias_laborales.includes(d) ? T.tealXL : T.surface,
              color: form.dias_laborales.includes(d) ? T.tealDk : T.mid,
              fontWeight: form.dias_laborales.includes(d) ? 700 : 500,
            }}>
              {DIAS_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11.5, color: T.lo, marginBottom: 4 }}>Hora entrada</div>
          <TInput type="time" value={form.hora_entrada}
            onChange={e => setForm(f => ({ ...f, hora_entrada: e.target.value }))} />
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: T.lo, marginBottom: 4 }}>Hora salida</div>
          <TInput type="time" value={form.hora_salida}
            onChange={e => setForm(f => ({ ...f, hora_salida: e.target.value }))} />
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: T.lo, marginBottom: 4 }}>Almuerzo (min)</div>
          <TInput type="number" min={15} max={120} value={form.duracion_comida_min}
            onChange={e => setForm(f => ({ ...f, duracion_comida_min: e.target.value }))} />
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: T.lo, marginBottom: 4 }}>Tolerancia (min)</div>
          <TInput type="number" min={0} max={30} value={form.tolerancia_min}
            onChange={e => setForm(f => ({ ...f, tolerancia_min: e.target.value }))} />
        </div>
      </div>

      {/* Toggle desayuno */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
          <div onClick={() => setForm(f => ({ ...f, tiene_desayuno: !f.tiene_desayuno }))}
            style={{
              width: 38, height: 22, borderRadius: 11, position: 'relative',
              background: form.tiene_desayuno ? T.teal : T.border,
              transition: 'background 0.18s', flexShrink: 0,
            }}>
            <div style={{
              position: 'absolute', top: 3, left: form.tiene_desayuno ? 19 : 3,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
          <span style={{ fontSize: 13, color: T.hi, fontWeight: 500 }}>
            ☕ Incluir tiempo de desayuno
          </span>
        </label>
        {form.tiene_desayuno && (
          <div style={{ marginTop: 10, maxWidth: 180 }}>
            <div style={{ fontSize: 11.5, color: T.lo, marginBottom: 4 }}>Duración desayuno (min)</div>
            <TInput type="number" min={5} max={60} value={form.duracion_desayuno_min}
              onChange={e => setForm(f => ({ ...f, duracion_desayuno_min: e.target.value }))} />
          </div>
        )}
      </div>

      {err && <div style={{ color: T.crit, fontSize: 12, marginBottom: 10 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <Btn onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar horario'}</Btn>
        <Btn variant="secondary" onClick={onCancelar}>Cancelar</Btn>
      </div>
    </div>
  );
}

/* ─── AsistenciaTab ───────────────────────────────────────── */
export default function AsistenciaTab() {
  const { profile } = useAuth();

  const [fecha,      setFecha]     = useState(fechaHoy());
  const [empleados,  setEmpleados] = useState([]);
  const [marcajesHoy, setMarcajes] = useState([]);   // [{empleado_id, tipo, marcado_en, es_tardanza, minutos_tardanza}]
  const [horarios,   setHorarios]  = useState([]);   // [{empleado_id, ...}]
  const [loading,    setLoading]   = useState(true);

  const [editandoId, setEditandoId] = useState(null);
  const [seccionAbierta, setSeccionAbierta] = useState('marcajes'); // 'marcajes' | 'horarios' | 'reporte'

  // Estados para exportación de reporte
  const [selEmpExport, setSelEmpExport] = useState('');
  const [fechaDesde,   setFechaDesde]   = useState(primerDiaMes);
  const [fechaHasta,   setFechaHasta]   = useState(fechaHoy);
  const [generando,    setGenerando]    = useState(false);

  const cargar = useCallback(async () => {
    if (!profile?.organizacion_id) return;
    setLoading(true);
    try {
      const [{ data: emps }, { data: marks }, { data: hors }] = await Promise.all([
        supabase.from('empleados').select('id, nombre, apellido, organizacion_id, sede_id')
          .eq('organizacion_id', profile.organizacion_id).eq('activo', true).order('apellido'),
        supabase.from('asistencia_marcajes').select('*')
          .eq('organizacion_id', profile.organizacion_id).eq('fecha', fecha),
        supabase.from('horarios_empleados').select('*')
          .eq('organizacion_id', profile.organizacion_id),
      ]);
      setEmpleados((emps || []).map(e => ({ ...e, nombre_completo: `${e.nombre} ${e.apellido}`.trim() })));
      setMarcajes(marks || []);
      setHorarios(hors || []);
    } finally {
      setLoading(false);
    }
  }, [profile?.organizacion_id, fecha]);

  useEffect(() => { cargar(); }, [cargar]);

  /* stats resumen */
  const total     = empleados.length;
  const presentes = new Set(marcajesHoy.map(m => m.empleado_id)).size;
  const tardanzas = empleados.filter(e => {
    const ms = marcajesHoy.filter(m => m.empleado_id === e.id);
    return ms.some(m => m.es_tardanza);
  }).length;
  const ausentes  = total - presentes;

  const generarReporte = async () => {
    if (!selEmpExport || !fechaDesde || !fechaHasta) return;
    setGenerando(true);
    try {
      const emp = empleados.find(e => e.id === selEmpExport);
      if (!emp) return;

      // Cargo, sede y horario del empleado
      const [{ data: empDet }, { data: marks }] = await Promise.all([
        supabase.from('empleados')
          .select('*, cargos(nombre), sedes(nombre)')
          .eq('id', selEmpExport)
          .maybeSingle(),
        supabase.from('asistencia_marcajes')
          .select('*')
          .eq('organizacion_id', profile.organizacion_id)
          .eq('empleado_id', selEmpExport)
          .gte('fecha', fechaDesde)
          .lte('fecha', fechaHasta)
          .order('fecha')
          .order('marcado_en'),
      ]);

      const horario = horarios.find(h => h.empleado_id === selEmpExport) || HORARIO_DEF;

      // Agrupar marcajes por fecha
      const porFecha = {};
      (marks || []).forEach(m => {
        if (!porFecha[m.fecha]) porFecha[m.fecha] = [];
        porFecha[m.fecha].push(m);
      });

      // Construir array día por día
      const dias = datesInRange(fechaDesde, fechaHasta).map(fecha => {
        const dow = new Date(fecha + 'T12:00:00').getDay(); // 0=Dom,6=Sáb
        const esFinDeSemana = !horario.dias_laborales.includes(dow === 0 ? 7 : dow);
        const marcajes = porFecha[fecha] || [];
        const estado   = esFinDeSemana ? 'finde' : calcEstado(marcajes, horario);
        return { fecha, esFinDeSemana, marcajes, estado };
      });

      const logoB64 = await toBase64(logoUrl);

      const html = buildReporteHTML({
        logoB64,
        empleado: {
          ...emp,
          nombre_completo: `${emp.nombre} ${emp.apellido}`.trim(),
          cargo: empDet?.cargos?.nombre || '',
          sede:  empDet?.sedes?.nombre  || '',
        },
        horario,
        diasConMarcajes: dias,
        fechaDesde,
        fechaHasta,
        adminNombre: `${profile.nombre || ''} ${profile.apellido || ''}`.trim() || 'Administrador',
      });

      mostrarReporte(html);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Filtro de fecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.hi, flex: 1 }}>Registro de asistencia</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: T.lo }}>Fecha:</span>
          <div style={{ width: 160 }}>
            <TInput type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
        </div>
        <Btn variant="secondary" onClick={cargar}>Actualizar</Btn>
      </div>

      {/* Tarjetas de resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total empleados', val: total,     color: T.teal,   bg: T.tealXL },
          { label: 'Presentes',        val: presentes, color: '#22C55E', bg: '#D1FAE5' },
          { label: 'Tardanzas',        val: tardanzas, color: '#D97706', bg: '#FEF9C3' },
          { label: 'Ausentes',         val: ausentes,  color: '#EF4444', bg: '#FEE2E2' },
        ].map(({ label, val, color, bg }) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: '12px 16px',
            border: `1px solid ${color}33` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
            <div style={{ fontSize: 11.5, color, opacity: 0.85, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Selector de sección */}
      <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${T.border}` }}>
        {[['marcajes','Marcajes del día'], ['horarios','Configurar horarios'], ['reporte','Exportar reporte']].map(([id, label]) => (
          <button key={id} onClick={() => setSeccionAbierta(id)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13,
              color: seccionAbierta === id ? T.tealDk : T.mid,
              borderBottom: seccionAbierta === id ? `2px solid ${T.teal}` : '2px solid transparent',
              fontWeight: seccionAbierta === id ? 700 : 500,
              marginBottom: -1,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tabla de marcajes ── */}
      {seccionAbierta === 'marcajes' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: T.lo, fontSize: 13 }}>Cargando…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: T.canvas }}>
                  {['Empleado', 'Entrada', '☕ Sale', '☕ Regresa', '🍽️ Sale', '🍽️ Regresa', 'Salida', 'Estado'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: T.lo, textTransform: 'uppercase',
                      letterSpacing: '0.07em', borderBottom: `1px solid ${T.border}`,
                      whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empleados.map((e, i) => {
                  const ms      = marcajesHoy.filter(m => m.empleado_id === e.id);
                  const hor     = horarios.find(h => h.empleado_id === e.id) || HORARIO_DEF;
                  const estado  = calcEstado(ms, hor);
                  const st      = ESTADO_STYLE[estado];
                  const allTipos = ['entrada','inicio_desayuno','fin_desayuno','inicio_comida','fin_comida','salida'];
                  return (
                    <tr key={e.id} style={{ background: i % 2 === 0 ? T.surface : T.canvas,
                      borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: T.hi }}>
                        {e.nombre_completo}
                      </td>
                      {allTipos.map(tipo => {
                        const m = ms.find(x => x.tipo === tipo);
                        const esDesayuno = tipo.includes('desayuno');
                        const tieneDesayuno = hor.tiene_desayuno;
                        if (esDesayuno && !tieneDesayuno && !m) {
                          return <td key={tipo} style={{ padding: '9px 12px', color: T.border, fontSize: 12 }}>—</td>;
                        }
                        return (
                          <td key={tipo} style={{ padding: '9px 12px', color: T.mid }}>
                            {m ? (
                              <span>
                                {hhmm(m.marcado_en)}
                                {m.es_tardanza && (
                                  <span style={{ marginLeft: 5, fontSize: 10.5, background: '#FEF9C3',
                                    color: '#D97706', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>
                                    +{m.minutos_tardanza}m
                                  </span>
                                )}
                              </span>
                            ) : <span style={{ color: T.border }}>—</span>}
                          </td>
                        );
                      })}
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ background: st.bg, color: st.color, fontSize: 11.5,
                          fontWeight: 700, borderRadius: 6, padding: '3px 9px' }}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {empleados.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: T.lo }}>
                      No hay empleados activos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Configurar horarios ── */}
      {seccionAbierta === 'horarios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12.5, color: T.lo, marginBottom: 4 }}>
            Define el horario laboral de cada empleado. El horario por defecto es Lun-Vie 7:00-17:00, almuerzo 60 min, tolerancia 2 min.
          </div>
          {empleados.map(e => {
            const hor = horarios.find(h => h.empleado_id === e.id);
            const estaEditando = editandoId === e.id;
            return (
              <div key={e.id} style={{ background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: T.hi, fontSize: 13 }}>{e.nombre_completo}</div>
                    {hor ? (
                      <div style={{ fontSize: 11.5, color: T.lo, marginTop: 2 }}>
                        {(hor.dias_laborales || []).map(d => DIAS_LABELS[d]).join(', ')}
                        {' · '}
                        {hor.hora_entrada} – {hor.hora_salida}
                        {hor.tiene_desayuno && ` · ☕ Desayuno ${hor.duracion_desayuno_min} min`}
                        {' · '}
                        🍽️ Almuerzo {hor.duracion_comida_min} min
                        {' · '}
                        Tolerancia {hor.tolerancia_min} min
                      </div>
                    ) : (
                      <div style={{ fontSize: 11.5, color: T.lo, marginTop: 2 }}>
                        Usando horario por defecto
                      </div>
                    )}
                  </div>
                  <Btn size="sm" variant="secondary"
                    onClick={() => setEditandoId(estaEditando ? null : e.id)}>
                    {estaEditando ? 'Cerrar' : hor ? 'Editar horario' : 'Asignar horario'}
                  </Btn>
                </div>
                {estaEditando && (
                  <div style={{ padding: '0 16px 16px' }}>
                    <HorarioForm
                      empleado={e}
                      horarioActual={hor}
                      onGuardado={() => { setEditandoId(null); cargar(); }}
                      onCancelar={() => setEditandoId(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {empleados.length === 0 && (
            <div style={{ color: T.lo, fontSize: 13, padding: 16 }}>No hay empleados activos.</div>
          )}
        </div>
      )}

      {/* ── Exportar reporte ── */}
      {seccionAbierta === 'reporte' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
          <div style={{ fontSize: 12.5, color: T.lo }}>
            Genera un PDF con el historial de asistencia de un empleado en el rango de fechas seleccionado.
          </div>

          {/* Selector de empleado */}
          <div>
            <div style={{ fontSize: 11.5, color: T.lo, fontWeight: 600, marginBottom: 6,
              textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Empleado
            </div>
            <select
              value={selEmpExport}
              onChange={e => setSelEmpExport(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8, fontFamily: 'inherit',
                border: `1px solid ${T.border}`, background: T.surface, color: T.hi,
                fontSize: 13, outline: 'none', cursor: 'pointer',
              }}>
              <option value="">Selecciona un empleado…</option>
              {empleados.map(e => (
                <option key={e.id} value={e.id}>{e.nombre_completo}</option>
              ))}
            </select>
          </div>

          {/* Rango de fechas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11.5, color: T.lo, fontWeight: 600, marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Desde
              </div>
              <TInput type="date" value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: T.lo, fontWeight: 600, marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Hasta
              </div>
              <TInput type="date" value={fechaHasta}
                onChange={e => setFechaHasta(e.target.value)} />
            </div>
          </div>

          {/* Info días en rango */}
          {fechaDesde && fechaHasta && fechaDesde <= fechaHasta && (
            <div style={{ background: T.tealXL, borderRadius: 8, padding: '10px 14px',
              fontSize: 12.5, color: T.tealDk, fontWeight: 500 }}>
              Rango de {datesInRange(fechaDesde, fechaHasta).length} días calendario
            </div>
          )}

          <div>
            <Btn
              onClick={generarReporte}
              disabled={generando || !selEmpExport || !fechaDesde || !fechaHasta || fechaDesde > fechaHasta}
              icon={
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="8,17 12,21 16,17"/>
                  <line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
                </svg>
              }
            >
              {generando ? 'Generando reporte…' : 'Generar reporte PDF'}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
