import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { T } from '../../../shared/ui';

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

const PASOS_BASE = [
  { tipo: 'entrada',         label: 'Entrada',   emoji: '🟢' },
  { tipo: 'inicio_desayuno', label: 'Desayuno',  emoji: '☕', esDesayuno: true },
  { tipo: 'fin_desayuno',    label: 'Regresa',   emoji: '↩️', esDesayuno: true },
  { tipo: 'inicio_comida',   label: 'Almuerzo',  emoji: '🍽️' },
  { tipo: 'fin_comida',      label: 'Regresa',   emoji: '↩️' },
  { tipo: 'salida',          label: 'Salida',    emoji: '🔴' },
];

const ACCION_LABEL = {
  entrada:          'Marcar entrada',
  inicio_desayuno:  'Salir a desayunar',
  fin_desayuno:     'Regresar del desayuno',
  inicio_comida:    'Salir a almorzar',
  fin_comida:       'Regresar del almuerzo',
  salida:           'Marcar salida',
};

const ACCION_COLOR = {
  entrada:         '#22C55E',
  inicio_desayuno: '#8B5CF6',
  fin_desayuno:    '#7C3AED',
  inicio_comida:   '#F59E0B',
  fin_comida:      '#3B82F6',
  salida:          '#EF4444',
};

function jsDiaAdb(d) { return d === 0 ? 7 : d; }

function hhmm(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
}

function getPasos(horario) {
  return PASOS_BASE.filter(p => !p.esDesayuno || horario?.tiene_desayuno);
}

function getNextTipo(marcajes, horario) {
  const tipos = new Set(marcajes.map(m => m.tipo));
  for (const p of getPasos(horario)) {
    if (!tipos.has(p.tipo)) return p.tipo;
  }
  return null;
}

function calcTardanza(tipo, horario, marcajesHoy) {
  const now = new Date();
  if (tipo === 'entrada') {
    const [h, m] = horario.hora_entrada.split(':').map(Number);
    const prog = new Date(); prog.setHours(h, m, 0, 0);
    const min = Math.max(0, (now - prog) / 60000 - horario.tolerancia_min);
    return { hora_programada: horario.hora_entrada, minutos_tardanza: Math.round(min), es_tardanza: min > 0 };
  }
  if (tipo === 'fin_desayuno') {
    const ini = marcajesHoy.find(m => m.tipo === 'inicio_desayuno');
    if (ini) {
      const min = Math.max(0, (now - new Date(ini.marcado_en)) / 60000 - horario.duracion_desayuno_min - horario.tolerancia_min);
      return { hora_programada: null, minutos_tardanza: Math.round(min), es_tardanza: min > 0 };
    }
  }
  if (tipo === 'fin_comida') {
    const ini = marcajesHoy.find(m => m.tipo === 'inicio_comida');
    if (ini) {
      const min = Math.max(0, (now - new Date(ini.marcado_en)) / 60000 - horario.duracion_comida_min - horario.tolerancia_min);
      return { hora_programada: null, minutos_tardanza: Math.round(min), es_tardanza: min > 0 };
    }
  }
  return { hora_programada: null, minutos_tardanza: 0, es_tardanza: false };
}

function getAlertaMinutos(nextTipo, horario, marcajesHoy) {
  if (!nextTipo) return 0;
  const now = new Date();
  if (nextTipo === 'entrada') {
    const [h, m] = horario.hora_entrada.split(':').map(Number);
    const prog = new Date(); prog.setHours(h, m, 0, 0);
    return Math.max(0, Math.round((now - prog) / 60000 - horario.tolerancia_min));
  }
  if (nextTipo === 'fin_desayuno') {
    const ini = marcajesHoy.find(m => m.tipo === 'inicio_desayuno');
    if (ini) return Math.max(0, Math.round((now - new Date(ini.marcado_en)) / 60000 - horario.duracion_desayuno_min - horario.tolerancia_min));
  }
  if (nextTipo === 'fin_comida') {
    const ini = marcajesHoy.find(m => m.tipo === 'inicio_comida');
    if (ini) return Math.max(0, Math.round((now - new Date(ini.marcado_en)) / 60000 - horario.duracion_comida_min - horario.tolerancia_min));
  }
  return 0;
}

/* ─── Paso individual en la línea de tiempo ──────────────── */
function Paso({ paso, marcaje, esCurrent, esUltimo }) {
  const hecho = !!marcaje;
  const hora  = hecho ? hhmm(marcaje.marcado_en) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
      {/* Línea conectora izquierda */}
      {!esUltimo && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', right: '-50%',
          height: 2, background: hecho ? T.teal : T.border,
          transition: 'background 0.3s', zIndex: 0,
        }} />
      )}

      {/* Círculo del paso */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: hecho ? 14 : 13,
        background: hecho ? T.teal : esCurrent ? 'var(--input-bg)' : T.canvas,
        border: `2px solid ${hecho ? T.teal : esCurrent ? T.tealDk : T.border}`,
        boxShadow: esCurrent ? `0 0 0 3px ${T.tealXL}` : 'none',
        transition: 'all 0.25s',
      }}>
        {hecho ? <span style={{ fontSize: 13 }}>✓</span> : <span style={{ opacity: esCurrent ? 1 : 0.45 }}>{paso.emoji}</span>}
      </div>

      {/* Etiqueta */}
      <div style={{ marginTop: 6, fontSize: 10.5, fontWeight: 600, textAlign: 'center',
        color: hecho ? T.tealDk : esCurrent ? T.hi : T.lo,
        transition: 'color 0.2s', whiteSpace: 'nowrap' }}>
        {paso.label}
      </div>

      {/* Hora marcada */}
      <div style={{ fontSize: 10.5, color: T.lo, marginTop: 1, minHeight: 14, textAlign: 'center' }}>
        {hora ? hora : '—'}
      </div>

      {/* Indicador discreto de tardanza */}
      {marcaje?.es_tardanza && (
        <div style={{ fontSize: 9.5, color: '#D97706', fontWeight: 700, marginTop: 1,
          background: '#FEF9C3', borderRadius: 4, padding: '1px 5px' }}>
          +{marcaje.minutos_tardanza}m
        </div>
      )}
    </div>
  );
}

/* ─── MarcajeWidget ───────────────────────────────────────── */
export function MarcajeWidget({ profile }) {
  const [empleado, setEmpleado] = useState(null);
  const [horario,  setHorario]  = useState(null);
  const [marcajes, setMarcajes] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [marcando, setMarcando] = useState(false);
  const [msg,      setMsg]      = useState(null);
  const [ahora,    setAhora]    = useState(new Date());
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const cargar = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data: emp } = await supabase
        .from('empleados').select('id, organizacion_id, sede_id')
        .eq('profile_id', profile.id).maybeSingle();
      if (!emp) { setEmpleado(null); setLoading(false); return; }
      setEmpleado(emp);
      const [{ data: hor }, { data: marks }] = await Promise.all([
        supabase.from('horarios_empleados').select('*').eq('empleado_id', emp.id).maybeSingle(),
        supabase.from('asistencia_marcajes').select('*').eq('empleado_id', emp.id)
          .eq('fecha', new Date().toISOString().split('T')[0]).order('marcado_en'),
      ]);
      setHorario(hor || HORARIO_DEF);
      setMarcajes(marks || []);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (!loading && !empleado) return null;
  if (loading) return null;

  const hor          = horario || HORARIO_DEF;
  const esDiaLaboral = hor.dias_laborales.includes(jsDiaAdb(new Date().getDay()));
  const pasos        = getPasos(hor);
  const nextTipo     = getNextTipo(marcajes, hor);
  const minRetraso   = esDiaLaboral ? getAlertaMinutos(nextTipo, hor, marcajes) : 0;
  const hayRetraso   = minRetraso > 0;
  const accionColor  = nextTipo ? ACCION_COLOR[nextTipo] : T.ok;

  const marcar = async () => {
    if (!nextTipo || !empleado || marcando) return;
    setMarcando(true); setMsg(null);
    try {
      const tard = calcTardanza(nextTipo, hor, marcajes);
      const { error } = await supabase.from('asistencia_marcajes').insert({
        empleado_id: empleado.id, organizacion_id: empleado.organizacion_id,
        sede_id: empleado.sede_id, tipo: nextTipo, ...tard,
      });
      if (error) throw error;
      setMsg({ ok: true, texto: '¡Marcaje guardado!' });
      await cargar();
    } catch (e) {
      setMsg({ ok: false, texto: e.message?.includes('unique') ? 'Ya marcaste este turno hoy.' : 'Error al registrar.' });
    } finally {
      setMarcando(false);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const horaStr = ahora.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: '20px 24px 18px',
      boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
    }}>

      {/* Encabezado: título + reloj */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>⏰</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.hi }}>Marcador de asistencia</span>
          {!esDiaLaboral && (
            <span style={{ fontSize: 10.5, background: T.canvas, border: `1px solid ${T.border}`,
              borderRadius: 5, padding: '2px 7px', color: T.lo, fontWeight: 600 }}>
              Día no laborable
            </span>
          )}
        </div>
        <span style={{ fontSize: 18, fontWeight: 800, color: T.mid,
          fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
          {horaStr}
        </span>
      </div>

      {/* Línea de pasos */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 22, paddingBottom: 4 }}>
        {pasos.map((paso, i) => (
          <Paso
            key={paso.tipo}
            paso={paso}
            marcaje={marcajes.find(m => m.tipo === paso.tipo)}
            esCurrent={nextTipo === paso.tipo}
            esUltimo={i === pasos.length - 1}
          />
        ))}
      </div>

      {/* Zona de acción */}
      {esDiaLaboral && (
        !nextTipo ? (
          /* Jornada completa */
          <div style={{ display: 'flex', alignItems: 'center', gap: 10,
            background: '#D1FAE5', borderRadius: 10, padding: '12px 16px' }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#065F46' }}>
              ¡Jornada completada! Buen trabajo hoy.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Botón de marcaje */}
            <button onClick={marcar} disabled={marcando} style={{
              background: accionColor, color: '#fff',
              border: 'none', borderRadius: 10,
              padding: '11px 24px', fontSize: 14, fontWeight: 700,
              cursor: marcando ? 'not-allowed' : 'pointer',
              opacity: marcando ? 0.7 : 1,
              fontFamily: 'inherit', transition: 'opacity 0.15s, transform 0.1s',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: `0 3px 10px ${accionColor}44`,
            }}>
              <span>{PASOS_BASE.find(p => p.tipo === nextTipo)?.emoji}</span>
              {marcando ? 'Registrando…' : ACCION_LABEL[nextTipo]}
            </button>

            {/* Indicador de retraso (discreto) */}
            {hayRetraso && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444',
                  animation: 'pulse 1.4s infinite' }} />
                <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>
                  {minRetraso} min de retraso
                </span>
              </div>
            )}

            {/* Feedback de marcaje */}
            {msg && (
              <span style={{ fontSize: 12.5, fontWeight: 600,
                color: msg.ok ? T.ok : T.crit, animation: 'fadeIn 0.2s ease' }}>
                {msg.texto}
              </span>
            )}
          </div>
        )
      )}
    </div>
  );
}
