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
];

const GRAVEDAD_OPC = [
  { value: 'leve',   label: 'Leve' },
  { value: 'grave',  label: 'Grave' },
  { value: 'muy_grave', label: 'Muy grave' },
];

const FORM_INIT = { empleado_id: '', tipo: '', gravedad: 'leve', fecha: '', asunto: '', descripcion: '' };

const TIPO_LABEL = {
  llamada_atencion:    { txt: 'Llamada de atención',  c: T.warn, bg: T.warnBg },
  amonestacion_escrita:{ txt: 'Amonestación escrita', c: T.crit, bg: T.critBg },
  suspension:          { txt: 'Suspensión',           c: T.crit, bg: T.critBg },
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
    if (e.error || h.error) {
      setMsg({ tipo: 'err', txt: 'Error al cargar los datos. Intenta de nuevo.' });
      return;
    }
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
          <Field label="Gravedad">
            <TSelect value={form.gravedad} onChange={set('gravedad')} options={GRAVEDAD_OPC} />
          </Field>
          <Field label="Fecha">
            <TInput type="date" value={form.fecha} onChange={set('fecha')} />
          </Field>

          <Field label="Asunto" style={{ gridColumn: '1 / -1' }}>
            <TInput value={form.asunto} onChange={set('asunto')}
              placeholder="Ej. Llegada tarde reiterada" />
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
