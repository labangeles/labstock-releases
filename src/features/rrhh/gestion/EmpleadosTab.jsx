// src/features/rrhh/gestion/EmpleadosTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Btn, TInput, TSelect, Field, IconBtn, Ico } from '../../../shared/ui';
import { useAuth } from '../../../contexts/AuthContext';

const SEL = { value: '', label: 'Sin cargo' };

export default function EmpleadosTab() {
  const { profile } = useAuth();
  const [empleados, setEmpleados] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState(null); // id del empleado en edición
  const [edits, setEdits] = useState({});          // { cargo_id, fecha_ingreso }
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [e, c] = await Promise.all([
      supabase.from('empleados')
        .select('*, cargos(id, nombre), sedes(nombre)')
        .eq('organizacion_id', profile.organizacion_id)
        .order('apellido'),
      supabase.from('cargos')
        .select('id, nombre')
        .eq('organizacion_id', profile.organizacion_id)
        .eq('activo', true)
        .order('nombre'),
    ]);
    setEmpleados(e.data || []);
    setCargos(c.data || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { cargar(); }, [cargar]);

  const CARGO_OPC = [SEL, ...(cargos.map((c) => ({ value: c.id, label: c.nombre })))];

  const iniciarEdit = (emp) => {
    setEditando(emp.id);
    setEdits({ cargo_id: emp.cargo_id || '', fecha_ingreso: emp.fecha_ingreso || '' });
    setMsg(null);
  };

  const cancelar = () => { setEditando(null); setEdits({}); };

  const guardar = async (emp) => {
    setGuardando(true); setMsg(null);
    const { error } = await supabase.from('empleados').update({
      cargo_id: edits.cargo_id || null,
      fecha_ingreso: edits.fecha_ingreso || null,
    }).eq('id', emp.id);
    if (error) setMsg({ id: emp.id, txt: error.message });
    else { setEditando(null); setEdits({}); cargar(); }
    setGuardando(false);
  };

  const toggleActivo = async (emp) => {
    await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id);
    cargar();
  };

  const filtrados = empleados.filter((e) => {
    const txt = busqueda.toLowerCase();
    return !txt || `${e.nombre} ${e.apellido}`.toLowerCase().includes(txt);
  });

  if (loading) return <div style={{ color: T.lo, padding: 24 }}>Cargando…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, maxWidth: 300 }}>
          <TInput
            value={busqueda}
            onChange={(e) => setBusqueda(e?.target ? e.target.value : e)}
            placeholder="Buscar por nombre o apellido…"
          />
        </div>
        <div style={{ color: T.lo, fontSize: 13 }}>{filtrados.length} empleado(s)</div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {filtrados.length === 0 && (
          <div style={{ color: T.lo, padding: 16 }}>No hay empleados registrados.</div>
        )}
        {filtrados.map((emp) => {
          const enEdit = editando === emp.id;
          return (
            <div key={emp.id} style={{
              background: T.surface, border: `1px solid ${enEdit ? T.teal : T.border}`,
              borderRadius: 10, padding: '12px 16px',
              opacity: emp.activo ? 1 : 0.55,
              transition: 'border-color 0.15s',
            }}>
              {/* Cabecera */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, color: T.hi }}>
                    {emp.nombre} {emp.apellido}
                  </span>
                  <span style={{ color: T.lo, fontSize: 13 }}>
                    {' '}· {emp.sedes?.nombre || 'Sin sede'}
                  </span>
                  {!enEdit && (
                    <div style={{ color: T.mid, fontSize: 13, marginTop: 2 }}>
                      {emp.cargos?.nombre || <span style={{ color: T.lo, fontStyle: 'italic' }}>Sin cargo asignado</span>}
                      {emp.fecha_ingreso && (
                        <span style={{ color: T.lo }}> · Ingreso: {emp.fecha_ingreso}</span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 12, padding: '2px 10px', borderRadius: 999,
                    color: emp.activo ? T.ok : T.lo,
                    background: emp.activo ? T.okBg : T.canvas,
                  }}>
                    {emp.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  {!enEdit && (
                    <IconBtn icon={<Ico.Edit s={14}/>} onClick={() => iniciarEdit(emp)} title="Editar cargo y fecha" />
                  )}
                  <Btn variant={emp.activo ? 'danger' : 'secondary'} size="sm"
                    onClick={() => toggleActivo(emp)}>
                    {emp.activo ? 'Desactivar' : 'Activar'}
                  </Btn>
                </div>
              </div>

              {/* Panel de edición inline */}
              {enEdit && (
                <div style={{ marginTop: 12, display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                              gap: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                  <Field label="Cargo">
                    <TSelect
                      value={edits.cargo_id}
                      onChange={(e) => setEdits((d) => ({ ...d, cargo_id: e?.target ? e.target.value : e }))}
                      options={CARGO_OPC}
                    />
                  </Field>
                  <Field label="Fecha de ingreso">
                    <TInput
                      type="date"
                      value={edits.fecha_ingreso}
                      onChange={(e) => setEdits((d) => ({ ...d, fecha_ingreso: e?.target ? e.target.value : e }))}
                    />
                  </Field>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 1 }}>
                    <Btn onClick={() => guardar(emp)} disabled={guardando}>
                      {guardando ? 'Guardando…' : 'Guardar'}
                    </Btn>
                    <Btn variant="secondary" onClick={cancelar} disabled={guardando}>Cancelar</Btn>
                  </div>
                  {msg?.id === emp.id && (
                    <div style={{ color: T.crit, fontSize: 13, gridColumn: '1 / -1' }}>{msg.txt}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
