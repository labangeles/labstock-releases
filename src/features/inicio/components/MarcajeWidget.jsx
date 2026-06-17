import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { T } from '../../../shared/ui';

/* ─── SVG icons ───────────────────────────────────────────── */
const IcoEntrada = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
    <polyline points="10,17 15,12 10,7"/>
    <line x1="15" y1="12" x2="3" y2="12"/>
  </svg>
);

const IcoSalida = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16,17 21,12 16,7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const IcoCafe = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
    <line x1="6" y1="2" x2="6" y2="4"/>
    <line x1="10" y1="2" x2="10" y2="4"/>
    <line x1="14" y1="2" x2="14" y2="4"/>
  </svg>
);

const IcoAlmuerzo = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="2" x2="8" y2="22"/>
    <path d="M12 2v6a4 4 0 0 1-8 0V2"/>
    <line x1="16" y1="2" x2="16" y2="22"/>
    <path d="M16 7h5"/>
  </svg>
);

const IcoRegreso = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9,14 4,9 9,4"/>
    <path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
  </svg>
);

const IcoCheck = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
);

/* ─── datos de pasos ──────────────────────────────────────── */
const TODOS_PASOS = [
  { tipo: 'entrada',         label: 'Entrada',  Ico: IcoEntrada,  esDesayuno: false },
  { tipo: 'inicio_desayuno', label: 'Desayuno', Ico: IcoCafe,     esDesayuno: true  },
  { tipo: 'fin_desayuno',    label: 'Regreso',  Ico: IcoRegreso,  esDesayuno: true  },
  { tipo: 'inicio_comida',   label: 'Almuerzo', Ico: IcoAlmuerzo, esDesayuno: false },
  { tipo: 'fin_comida',      label: 'Regreso',  Ico: IcoRegreso,  esDesayuno: false },
  { tipo: 'salida',          label: 'Salida',   Ico: IcoSalida,   esDesayuno: false },
];

const ACCION_LABEL = {
  entrada:          'Marcar entrada',
  inicio_desayuno:  'Salir a desayunar',
  fin_desayuno:     'Regresar del desayuno',
  inicio_comida:    'Salir a almorzar',
  fin_comida:       'Regresar del almuerzo',
  salida:           'Marcar salida',
};

const ACCION_ICO = {
  entrada:          IcoEntrada,
  inicio_desayuno:  IcoCafe,
  fin_desayuno:     IcoRegreso,
  inicio_comida:    IcoAlmuerzo,
  fin_comida:       IcoRegreso,
  salida:           IcoSalida,
};

const HORARIO_DEF = {
  hora_entrada: '07:00', hora_salida: '17:00',
  tiene_desayuno: false,
  duracion_desayuno_min: 15, duracion_comida_min: 60,
  tolerancia_min: 2, dias_laborales: [1, 2, 3, 4, 5],
};

function jsDiaAdb(d) { return d === 0 ? 7 : d; }

function hhmm(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
}

function getPasos(horario) {
  return TODOS_PASOS.filter(p => !p.esDesayuno || horario?.tiene_desayuno);
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

/* ─── Círculo de paso ─────────────────────────────────────── */
function StepCircle({ paso, marcaje, esCurrent }) {
  const hecho = !!marcaje;
  const { Ico } = paso;
  const teal = 'var(--teal)';
  const tealDk = 'var(--teal-dark)';

  return (
    <div style={{
      width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: hecho ? teal : 'var(--bg-surface)',
      border: `2px solid ${hecho ? teal : esCurrent ? tealDk : 'var(--border)'}`,
      boxShadow: esCurrent && !hecho ? `0 0 0 4px var(--teal-xlight)` : 'none',
      transition: 'all 0.25s',
    }}>
      {hecho
        ? <IcoCheck size={18} color="#fff" />
        : <Ico size={18} color={esCurrent ? tealDk : 'var(--border-mid)'} />
      }
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

  if (loading) return null;
  if (!empleado) return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.lo}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span style={{ fontSize: 12.5, color: T.lo }}>
        Tu cuenta no está vinculada a un empleado. Pide al administrador que te registre en
        <strong style={{ color: T.mid }}> Recursos Humanos → Empleados</strong> para activar el marcaje de asistencia.
      </span>
    </div>
  );

  const hor          = horario || HORARIO_DEF;
  const esDiaLaboral = hor.dias_laborales.includes(jsDiaAdb(new Date().getDay()));
  const pasos        = getPasos(hor);
  const nextTipo     = getNextTipo(marcajes, hor);

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

  const horaStr = ahora.toLocaleTimeString('es-GT', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });

  const AccionIco = nextTipo ? ACCION_ICO[nextTipo] : null;

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: '20px 24px',
      boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={T.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12,6 12,12 16,14"/>
          </svg>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.hi }}>Asistencia</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.mid, fontVariantNumeric: 'tabular-nums' }}>
          {horaStr}
        </span>
      </div>

      {/* Línea de pasos */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        {pasos.map((paso, i) => {
          const marcaje   = marcajes.find(m => m.tipo === paso.tipo);
          const esCurrent = nextTipo === paso.tipo;
          const siguiente = pasos[i + 1];
          const lineaHecha = !!marcaje && !!siguiente && !!marcajes.find(m => m.tipo === siguiente.tipo);

          return (
            <div key={paso.tipo} style={{ display: 'flex', alignItems: 'center', flex: i < pasos.length - 1 ? 1 : 0 }}>

              {/* Paso: círculo + etiqueta + hora */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <StepCircle paso={paso} marcaje={marcaje} esCurrent={esCurrent} />
                <span style={{
                  fontSize: 11, fontWeight: esCurrent ? 700 : 500,
                  color: esCurrent ? T.tealDk : !!marcaje ? T.mid : T.lo,
                  whiteSpace: 'nowrap',
                }}>
                  {paso.label}
                </span>
                <span style={{ fontSize: 10.5, color: T.lo, minHeight: 14 }}>
                  {marcaje ? hhmm(marcaje.marcado_en) : ''}
                </span>
              </div>

              {/* Línea conectora */}
              {i < pasos.length - 1 && (
                <div style={{
                  flex: 1, height: 2, margin: '0 6px', marginBottom: 30,
                  background: lineaHecha ? T.teal : T.border,
                  transition: 'background 0.3s',
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Separador */}
      <div style={{ borderTop: `1px solid ${T.border}`, marginBottom: 16 }} />

      {/* Zona de acción */}
      {!esDiaLaboral ? (
        <span style={{ fontSize: 12.5, color: T.lo }}>Hoy no es día laborable.</span>
      ) : !nextTipo ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke={T.ok} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20,6 9,17 4,12"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.ok }}>
            Jornada completada. ¡Buen trabajo hoy!
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={marcar} disabled={marcando} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            background: T.teal, color: '#fff',
            border: 'none', borderRadius: 10,
            padding: '11px 22px', fontSize: 13.5, fontWeight: 600,
            cursor: marcando ? 'not-allowed' : 'pointer',
            opacity: marcando ? 0.75 : 1,
            fontFamily: 'inherit', transition: 'opacity 0.15s',
          }}>
            {AccionIco && <AccionIco size={16} color="#fff" />}
            {marcando ? 'Registrando…' : ACCION_LABEL[nextTipo]}
          </button>
          {msg && (
            <span style={{ fontSize: 12.5, fontWeight: 600,
              color: msg.ok ? T.ok : T.crit, animation: 'fadeIn 0.2s ease' }}>
              {msg.texto}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
