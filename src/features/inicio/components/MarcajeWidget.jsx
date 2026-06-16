import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { T } from '../../../shared/ui';

/* ─── constantes ─────────────────────────────────────────── */
const HORARIO_DEF = {
  hora_entrada: '07:00',
  hora_salida: '17:00',
  duracion_comida_min: 60,
  tolerancia_min: 2,
  dias_laborales: [1, 2, 3, 4, 5],
};

const TIPOS_CONFIG = {
  entrada:       { label: 'Marcar entrada',           emoji: '🟢', color: '#22C55E' },
  inicio_comida: { label: 'Salir a almorzar',          emoji: '🍽️',  color: '#F59E0B' },
  fin_comida:    { label: 'Regresar del almuerzo',     emoji: '↩️',  color: '#3B82F6' },
  salida:        { label: 'Marcar salida',             emoji: '🔴', color: '#EF4444' },
};

/* JS getDay() → 0=Dom..6=Sáb  →  DB 1=Lun..7=Dom */
function jsDiaAdb(d) { return d === 0 ? 7 : d; }

function hhmm(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
}

function getNextTipo(marcajes) {
  const tipos = new Set(marcajes.map(m => m.tipo));
  if (!tipos.has('entrada'))       return 'entrada';
  if (!tipos.has('inicio_comida')) return 'inicio_comida';
  if (!tipos.has('fin_comida'))    return 'fin_comida';
  if (!tipos.has('salida'))        return 'salida';
  return null;
}

function calcTardanza(tipo, horario, marcajesHoy) {
  const now = new Date();
  if (tipo === 'entrada') {
    const [h, m] = horario.hora_entrada.split(':').map(Number);
    const prog = new Date(); prog.setHours(h, m, 0, 0);
    const diffMin = (now - prog) / 60000;
    const min = Math.max(0, diffMin - horario.tolerancia_min);
    return { hora_programada: horario.hora_entrada, minutos_tardanza: Math.round(min), es_tardanza: min > 0 };
  }
  if (tipo === 'fin_comida') {
    const ini = marcajesHoy.find(m => m.tipo === 'inicio_comida');
    if (ini) {
      const diffMin = (now - new Date(ini.marcado_en)) / 60000;
      const limite = horario.duracion_comida_min + horario.tolerancia_min;
      const min = Math.max(0, diffMin - limite);
      return { hora_programada: null, minutos_tardanza: Math.round(min), es_tardanza: min > 0 };
    }
  }
  return { hora_programada: null, minutos_tardanza: 0, es_tardanza: false };
}

/* devuelve si ahorita ya deberían haber marcado y no lo hicieron */
function calcAlertaActual(nextTipo, horario, marcajesHoy) {
  if (!nextTipo) return null;
  const now = new Date();

  if (nextTipo === 'entrada') {
    const [h, m] = horario.hora_entrada.split(':').map(Number);
    const prog = new Date(); prog.setHours(h, m, 0, 0);
    const minRetraso = (now - prog) / 60000 - horario.tolerancia_min;
    if (minRetraso > 0) return `¡Llevas ${Math.round(minRetraso)} min de retraso en la entrada!`;
  }

  if (nextTipo === 'fin_comida') {
    const ini = marcajesHoy.find(m => m.tipo === 'inicio_comida');
    if (ini) {
      const minTranscurridos = (now - new Date(ini.marcado_en)) / 60000;
      const minExcedido = minTranscurridos - horario.duracion_comida_min - horario.tolerancia_min;
      if (minExcedido > 0) return `¡Excediste el almuerzo por ${Math.round(minExcedido)} min!`;
    }
  }

  return null;
}

/* ─── MarcajeWidget ────────────────────────────────────────── */
export function MarcajeWidget({ profile }) {
  const [empleado,   setEmpleado]   = useState(null);
  const [horario,    setHorario]    = useState(null);
  const [marcajes,   setMarcajes]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [marcando,   setMarcando]   = useState(false);
  const [msg,        setMsg]        = useState(null); // { tipo:'ok'|'err', texto }
  const [ahora,      setAhora]      = useState(new Date());
  const timerRef = useRef(null);

  /* reloj cada segundo */
  useEffect(() => {
    timerRef.current = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  /* cargar datos iniciales */
  const cargar = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data: emp } = await supabase
        .from('empleados').select('id, organizacion_id, sede_id').eq('profile_id', profile.id).maybeSingle();
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

  /* no tiene registro de empleado */
  if (!loading && !empleado) return null;

  const hoy = new Date();
  const diaSemanaDb = jsDiaAdb(hoy.getDay());
  const hor = horario || HORARIO_DEF;
  const esDiaLaboral = hor.dias_laborales.includes(diaSemanaDb);

  const nextTipo = getNextTipo(marcajes);
  const alerta   = esDiaLaboral ? calcAlertaActual(nextTipo, hor, marcajes) : null;

  const marcar = async () => {
    if (!nextTipo || !empleado || marcando) return;
    setMarcando(true);
    setMsg(null);
    try {
      const tard = calcTardanza(nextTipo, hor, marcajes);
      const { error } = await supabase.from('asistencia_marcajes').insert({
        empleado_id:     empleado.id,
        organizacion_id: empleado.organizacion_id,
        sede_id:         empleado.sede_id,
        tipo:            nextTipo,
        ...tard,
      });
      if (error) throw error;
      setMsg({ tipo: 'ok', texto: '¡Marcaje registrado!' });
      await cargar();
    } catch (e) {
      setMsg({ tipo: 'err', texto: e.message?.includes('unique') ? 'Ya registraste este marcaje hoy.' : 'Error al registrar. Intenta de nuevo.' });
    } finally {
      setMarcando(false);
      setTimeout(() => setMsg(null), 3500);
    }
  };

  const horaStr = ahora.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const cfg = nextTipo ? TIPOS_CONFIG[nextTipo] : null;
  const hayTardanza = alerta != null;

  if (loading) return null; // no mostrar skeleton, aparece rápido

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${hayTardanza ? '#EF444466' : T.border}`,
      borderLeft: `4px solid ${hayTardanza ? '#EF4444' : cfg?.color || T.ok}`,
      borderRadius: 14,
      padding: '18px 22px',
      boxShadow: hayTardanza ? '0 4px 16px #EF444422' : '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      {/* Fila superior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⏰</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.hi }}>Asistencia</span>
          {!esDiaLaboral && (
            <span style={{ fontSize: 11, background: T.canvas, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: '2px 8px', color: T.lo }}>Día no laborable</span>
          )}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: hayTardanza ? '#EF4444' : T.mid,
          fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em' }}>
          {horaStr}
        </span>
      </div>

      {/* Alerta de retraso */}
      {alerta && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
          padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🚨</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#DC2626' }}>{alerta}</span>
        </div>
      )}

      {/* Resumen del día */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {Object.entries(TIPOS_CONFIG).map(([tipo, cfg]) => {
          const marc = marcajes.find(m => m.tipo === tipo);
          return (
            <div key={tipo} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: marc ? `${cfg.color}18` : T.canvas,
              border: `1px solid ${marc ? cfg.color + '44' : T.border}`,
              borderRadius: 8, padding: '4px 10px',
            }}>
              <span style={{ fontSize: 12 }}>{cfg.emoji}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600,
                color: marc ? cfg.color : T.lo }}>
                {marc ? hhmm(marc.marcado_en) : '—'}
                {marc?.es_tardanza && <span style={{ marginLeft: 4, color: '#EF4444', fontSize: 10.5 }}>
                  +{marc.minutos_tardanza}m tarde
                </span>}
              </span>
            </div>
          );
        })}
      </div>

      {/* Acción principal */}
      {esDiaLaboral && (
        nextTipo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={marcar}
              disabled={marcando}
              style={{
                background: hayTardanza ? '#EF4444' : cfg.color,
                color: '#fff', border: 'none', borderRadius: 9,
                padding: '10px 20px', fontSize: 13.5, fontWeight: 700,
                cursor: marcando ? 'not-allowed' : 'pointer',
                opacity: marcando ? 0.7 : 1,
                fontFamily: 'inherit',
                transition: 'opacity 0.15s',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
              <span>{cfg.emoji}</span>
              {marcando ? 'Registrando…' : cfg.label}
            </button>
            {msg && (
              <span style={{ fontSize: 12.5, fontWeight: 600,
                color: msg.tipo === 'ok' ? T.ok : T.crit }}>
                {msg.texto}
              </span>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.ok }}>
            <span>✅</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>¡Jornada completada! Buen trabajo hoy.</span>
          </div>
        )
      )}
    </div>
  );
}
