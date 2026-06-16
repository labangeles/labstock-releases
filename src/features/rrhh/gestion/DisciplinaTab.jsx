// src/features/rrhh/gestion/DisciplinaTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Btn, Field, TInput, TSelect } from '../../../shared/ui';
import { useAuth } from '../../../contexts/AuthContext';

const SEL = { value: '', label: 'Selecciona…' };

const TIPO_OPC = [SEL,
  { value: 'llamada_atencion',     label: 'Llamada de atención' },
  { value: 'amonestacion_escrita', label: 'Amonestación escrita' },
  { value: 'suspension',           label: 'Suspensión' },
  { value: 'reconocimiento',       label: 'Reconocimiento' },
];

const GRAVEDAD_OPC = [
  { value: 'leve',   label: 'Leve' },
  { value: 'grave',  label: 'Grave' },
  { value: 'muy_grave', label: 'Muy grave' },
];

const RECONOCIMIENTOS = [
  { icono: '⭐', titulo: 'Empleado del mes',           desc: 'Reconocimiento mensual al colaborador más destacado.' },
  { icono: '⏰', titulo: 'Puntualidad sobresaliente',  desc: 'Cumplimiento ejemplar de horarios de entrada y salida.' },
  { icono: '🏆', titulo: 'Desempeño excepcional',      desc: 'Resultados que superan significativamente las expectativas del puesto.' },
  { icono: '🤝', titulo: 'Espíritu de equipo',         desc: 'Apoyo constante a compañeros y contribución al ambiente de trabajo positivo.' },
  { icono: '🔬', titulo: 'Calidad en resultados',      desc: 'Precisión y cuidado en el procesamiento y reporte de muestras.' },
  { icono: '💡', titulo: 'Iniciativa y proactividad',  desc: 'Identificación y resolución de problemas sin necesidad de ser indicado.' },
  { icono: '📅', titulo: 'Años de servicio',           desc: 'Reconocimiento por la trayectoria y fidelidad con la organización.' },
  { icono: '😊', titulo: 'Atención al paciente',       desc: 'Trato amable, empático y profesional hacia los pacientes.' },
  { icono: '📈', titulo: 'Superación de metas',        desc: 'Logro o superación de los objetivos establecidos para el período.' },
  { icono: '🌟', titulo: 'Actitud positiva',           desc: 'Disposición y energía que inspiran a los demás en el equipo.' },
  { icono: '🛡️', titulo: 'Compromiso con la calidad', desc: 'Adherencia estricta a protocolos y buenas prácticas de laboratorio.' },
  { icono: '🚀', titulo: 'Innovación y mejora',        desc: 'Propuesta o implementación de mejoras en procesos internos.' },
];

const FORM_INIT = { empleado_id: '', tipo: '', gravedad: 'leve', fecha: '', asunto: '', descripcion: '' };

const TIPO_LABEL = {
  llamada_atencion:    { txt: 'Llamada de atención',  c: T.warn, bg: T.warnBg },
  amonestacion_escrita:{ txt: 'Amonestación escrita', c: T.crit, bg: T.critBg },
  suspension:          { txt: 'Suspensión',           c: T.crit, bg: T.critBg },
  reconocimiento:      { txt: 'Reconocimiento',       c: T.ok,   bg: T.okBg   },
};

export default function DisciplinaTab() {
  const { profile } = useAuth();
  const [empleados, setEmpleados] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [form, setForm] = useState(FORM_INIT);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (campo) => (e) =>
    setForm((f) => ({ ...f, [campo]: e?.target ? e.target.value : e }));

  const cargar = useCallback(async () => {
    const [e, h] = await Promise.all([
      supabase.from('empleados')
        .select('id, nombre, apellido')
        .eq('organizacion_id', profile.organizacion_id)
        .eq('activo', true)
        .order('apellido'),
      supabase.from('acciones_disciplinarias')
        .select('*, empleados(nombre, apellido)')
        .eq('organizacion_id', profile.organizacion_id)
        .order('fecha', { ascending: false })
        .limit(30),
    ]);
    setEmpleados(e.data || []);
    setHistorial(h.data || []);
  }, [profile]);

  useEffect(() => { cargar(); }, [cargar]);

  const EMP_OPC = [SEL, ...empleados.map((e) => ({
    value: e.id, label: `${e.apellido}, ${e.nombre}`,
  }))];

  const guardar = async () => {
    if (!form.empleado_id || !form.tipo || !form.fecha || !form.asunto) {
      setMsg({ tipo: 'err', txt: 'Empleado, tipo, fecha y asunto son obligatorios.' });
      return;
    }
    setGuardando(true); setMsg(null);
    const { error } = await supabase.from('acciones_disciplinarias').insert({
      empleado_id: form.empleado_id,
      organizacion_id: profile.organizacion_id,
      tipo: form.tipo,
      gravedad: form.gravedad,
      fecha: form.fecha,
      asunto: form.asunto,
      descripcion: form.descripcion || null,
      emitido_por: profile.id,
    });
    if (error) setMsg({ tipo: 'err', txt: error.message });
    else {
      setMsg({ tipo: 'ok', txt: 'Registro creado.' });
      setForm(FORM_INIT);
      cargar();
    }
    setGuardando(false);
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Formulario nuevo registro */}
      <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
        <h3 style={{ color: T.hi, marginTop: 0 }}>Nuevo registro</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Field label="Empleado">
            <TSelect value={form.empleado_id} onChange={set('empleado_id')} options={EMP_OPC} />
          </Field>
          <Field label="Tipo">
            <TSelect value={form.tipo} onChange={set('tipo')} options={TIPO_OPC} />
          </Field>
          {form.tipo !== 'reconocimiento' && (
            <Field label="Gravedad">
              <TSelect value={form.gravedad} onChange={set('gravedad')} options={GRAVEDAD_OPC} />
            </Field>
          )}
          <Field label="Fecha">
            <TInput type="date" value={form.fecha} onChange={set('fecha')} />
          </Field>

          {/* Paleta de reconocimientos predefinidos */}
          {form.tipo === 'reconocimiento' && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.lo, marginBottom: 10 }}>
                Tipo de reconocimiento — selecciona uno o escribe el tuyo
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginBottom: 10 }}>
                {RECONOCIMIENTOS.map((r) => {
                  const sel = form.asunto === r.titulo;
                  return (
                    <button key={r.titulo} type="button"
                      onClick={() => setForm((f) => ({ ...f, asunto: r.titulo, descripcion: f.descripcion || r.desc }))}
                      style={{
                        textAlign: 'left', cursor: 'pointer',
                        background: sel ? T.tealXL : T.canvas,
                        border: `1.5px solid ${sel ? T.teal : T.border}`,
                        borderRadius: 10, padding: '10px 12px',
                        transition: 'all 0.13s',
                        outline: 'none',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{r.icono}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: sel ? T.tealDk : T.hi }}>
                          {r.titulo}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: T.lo, lineHeight: 1.4 }}>{r.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Field label="Asunto" style={{ gridColumn: '1 / -1' }}>
            <TInput value={form.asunto} onChange={set('asunto')}
              placeholder={form.tipo === 'reconocimiento' ? 'Selecciona arriba o escribe un asunto personalizado…' : 'Ej. Llegada tarde reiterada'} />
          </Field>
          <Field label="Descripción (opcional)" style={{ gridColumn: '1 / -1' }}>
            <TInput value={form.descripcion} onChange={set('descripcion')}
              placeholder="Detalle adicional…" />
          </Field>
        </div>
        {msg && (
          <div style={{ color: msg.tipo === 'ok' ? T.ok : T.crit, fontSize: 13, margin: '8px 0' }}>
            {msg.txt}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <Btn onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Registrar acción'}
          </Btn>
        </div>
      </section>

      {/* Historial reciente */}
      <section>
        <h3 style={{ color: T.hi, marginTop: 0 }}>Historial reciente</h3>
        {historial.length === 0 && <div style={{ color: T.lo }}>No hay registros aún.</div>}
        <div style={{ display: 'grid', gap: 8 }}>
          {historial.map((a) => {
            const t = TIPO_LABEL[a.tipo] || { txt: a.tipo, c: T.mid, bg: T.canvas };
            return (
              <div key={a.id} style={{ background: T.surface, border: `1px solid ${T.border}`,
                                       borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: T.hi }}>
                      {a.empleados?.apellido}, {a.empleados?.nombre}
                    </span>
                    <span style={{ color: T.lo, fontSize: 13 }}> · {a.fecha}</span>
                  </div>
                  <span style={{ color: t.c, background: t.bg, padding: '2px 10px',
                                 borderRadius: 999, fontSize: 12 }}>
                    {t.txt}
                  </span>
                </div>
                <div style={{ color: T.mid, fontSize: 14, marginTop: 4 }}>{a.asunto}</div>
                {a.acuse_recibo && (
                  <div style={{ color: T.ok, fontSize: 12, marginTop: 4 }}>✓ Acuse recibido</div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
