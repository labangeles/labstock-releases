import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Btn, TInput, TSelect } from '../../../shared/ui';
import { useAuth } from '../../../contexts/AuthContext';

/* ─── constantes ─────────────────────────────────────────── */
const HORARIO_DEF = {
  hora_entrada: '07:00',
  hora_salida: '17:00',
  duracion_comida_min: 60,
  tolerancia_min: 2,
  dias_laborales: [1, 2, 3, 4, 5],
};

const DIAS_LABELS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const TIPOS_ORDEN = ['entrada', 'inicio_comida', 'fin_comida', 'salida'];
const TIPOS_LABELS = {
  entrada:       'Entrada',
  inicio_comida: 'Sale almuerzo',
  fin_comida:    'Regresa',
  salida:        'Salida',
};

function hhmm(val) {
  if (!val) return '—';
  return new Date(val).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
}

function fechaHoy() {
  return new Date().toISOString().split('T')[0];
}

function calcEstado(marcajes) {
  const tipos = new Set(marcajes.map(m => m.tipo));
  if (tipos.size === 0) return 'ausente';
  if (tipos.size === 4) {
    if (marcajes.some(m => m.es_tardanza)) return 'tardanza';
    return 'completo';
  }
  return 'incompleto';
}

const ESTADO_STYLE = {
  completo:   { bg: '#D1FAE5', color: '#065F46', label: 'Completo' },
  tardanza:   { bg: '#FEF9C3', color: '#854D0E', label: 'Con tardanza' },
  incompleto: { bg: '#FEF3C7', color: '#92400E', label: 'Incompleto' },
  ausente:    { bg: '#FEE2E2', color: '#991B1B', label: 'Ausente' },
};

/* ─── HorarioForm inline ──────────────────────────────────── */
function HorarioForm({ empleado, horarioActual, onGuardado, onCancelar }) {
  const [form, setForm] = useState({
    hora_entrada: horarioActual?.hora_entrada || HORARIO_DEF.hora_entrada,
    hora_salida:  horarioActual?.hora_salida  || HORARIO_DEF.hora_salida,
    duracion_comida_min: horarioActual?.duracion_comida_min ?? HORARIO_DEF.duracion_comida_min,
    tolerancia_min:      horarioActual?.tolerancia_min ?? HORARIO_DEF.tolerancia_min,
    dias_laborales: horarioActual?.dias_laborales ?? [...HORARIO_DEF.dias_laborales],
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
        empleado_id:         empleado.id,
        organizacion_id:     empleado.organizacion_id,
        hora_entrada:        form.hora_entrada,
        hora_salida:         form.hora_salida,
        duracion_comida_min: Number(form.duracion_comida_min),
        tolerancia_min:      Number(form.tolerancia_min),
        dias_laborales:      form.dias_laborales,
        updated_at:          new Date().toISOString(),
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

  const [editandoId, setEditandoId] = useState(null); // empleado_id en edición de horario
  const [seccionAbierta, setSeccionAbierta] = useState('marcajes'); // 'marcajes' | 'horarios'

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
        {[['marcajes','Marcajes del día'], ['horarios','Configurar horarios']].map(([id, label]) => (
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
                  {['Empleado', ...Object.values(TIPOS_LABELS), 'Estado'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: T.lo, textTransform: 'uppercase',
                      letterSpacing: '0.07em', borderBottom: `1px solid ${T.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empleados.map((e, i) => {
                  const ms = marcajesHoy.filter(m => m.empleado_id === e.id);
                  const estado = calcEstado(ms);
                  const st = ESTADO_STYLE[estado];
                  return (
                    <tr key={e.id} style={{ background: i % 2 === 0 ? T.surface : T.canvas,
                      borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: T.hi }}>
                        {e.nombre_completo}
                      </td>
                      {TIPOS_ORDEN.map(tipo => {
                        const m = ms.find(x => x.tipo === tipo);
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
                    <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: T.lo }}>
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
                        {' · '}
                        Almuerzo {hor.duracion_comida_min} min
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
    </div>
  );
}
