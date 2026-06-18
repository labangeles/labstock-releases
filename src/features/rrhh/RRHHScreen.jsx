// src/features/rrhh/RRHHScreen.jsx
// Raíz del módulo. Autoservicio para TODOS los roles; gestión para admin/auditor.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { T, Btn, Modal, Field, TSelect, TInput } from '../../shared/ui';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

import MiPerfilTab from './autoservicio/MiPerfilTab';
import MisDocumentosTab from './autoservicio/MisDocumentosTab';
import MisVacacionesTab from './autoservicio/MisVacacionesTab';
import MiExpedienteTab from './autoservicio/MiExpedienteTab';
import EmpleadosTab from './gestion/EmpleadosTab';
import AprobacionesTab from './gestion/AprobacionesTab';
import DisciplinaTab from './gestion/DisciplinaTab';
import AsistenciaTab from './gestion/AsistenciaTab';
import Reconocimientos, { RECONOCIMIENTOS } from '../../components/Reconocimientos';
import Emblem from '../../components/Emblem';

const Pendiente = ({ label }) => (
  <div style={{ color: T.lo, padding: 24, fontSize: 14 }}>
    La pestaña "{label}" está en desarrollo.
  </div>
);

const SEL_EMP = { value: '', label: 'Selecciona empleado…' };
const SEL_REC = { value: '', label: 'Selecciona reconocimiento…' };
const HOY = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

function ReconocimientosTab() {
  const { profile } = useAuth();
  const isAdmin = profile?.rol === 'admin';
  const [data,      setData]      = useState(RECONOCIMIENTOS);
  const [empleados, setEmpleados] = useState([]);
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState({ empleado_id: '', titulo: '', fecha: HOY });
  const [guardando, setGuardando] = useState(false);
  const [msg,       setMsg]       = useState(null);

  const cargarMisEmblemas = useCallback(() => {
    if (!profile?.id) return;
    const hoy   = new Date();
    const y     = hoy.getFullYear();
    const m     = String(hoy.getMonth() + 1).padStart(2, '0');
    const desde = `${y}-${m}-01`;
    const hasta = new Date(y, hoy.getMonth() + 1, 0).toISOString().split('T')[0];

    supabase.from('empleados').select('id').eq('profile_id', profile.id).maybeSingle()
      .then(({ data: emp }) => {
        if (!emp) return;
        supabase.from('acciones_disciplinarias')
          .select('asunto, fecha')
          .eq('empleado_id', emp.id)
          .eq('tipo', 'reconocimiento')
          .gte('fecha', desde)
          .lte('fecha', hasta)
          .then(({ data: rows }) => {
            if (!rows) return;
            const earnedMap = {};
            rows.forEach(r => { earnedMap[r.asunto] = r.fecha; });
            setData(RECONOCIMIENTOS.map(r => ({
              ...r,
              earned: !!earnedMap[r.title],
              fecha:  earnedMap[r.title] || null,
            })));
          });
      });
  }, [profile?.id]);

  useEffect(() => { cargarMisEmblemas(); }, [cargarMisEmblemas]);

  useEffect(() => {
    if (!isAdmin || !profile?.organizacion_id) return;
    supabase.from('empleados')
      .select('id, nombre, apellido')
      .eq('organizacion_id', profile.organizacion_id)
      .eq('activo', true)
      .order('apellido')
      .then(({ data: rows }) => setEmpleados(rows || []));
  }, [isAdmin, profile?.organizacion_id]);

  const empOpc = [SEL_EMP, ...empleados.map(e => ({ value: e.id, label: `${e.apellido}, ${e.nombre}` }))];
  const recOpc = [SEL_REC, ...RECONOCIMIENTOS.map(r => ({ value: r.title, label: r.title }))];

  const asignar = async () => {
    if (!form.empleado_id || !form.titulo || !form.fecha) {
      setMsg('Empleado, reconocimiento y fecha son obligatorios.');
      return;
    }
    setGuardando(true); setMsg(null);
    const cat = RECONOCIMIENTOS.find(r => r.title === form.titulo);
    const { error } = await supabase.from('acciones_disciplinarias').insert({
      empleado_id:     form.empleado_id,
      organizacion_id: profile.organizacion_id,
      tipo:            'reconocimiento',
      gravedad:        'leve',
      fecha:           form.fecha,
      asunto:          form.titulo,
      descripcion:     cat?.desc || null,
      emitido_por:     profile.id,
    });
    setGuardando(false);
    if (error) { setMsg(error.message); return; }
    setModal(false);
    setForm({ empleado_id: '', titulo: '', fecha: HOY });
    cargarMisEmblemas();
  };

  return (
    <div>
      {/* Botón asignar — solo admin */}
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <Btn onClick={() => { setMsg(null); setModal(true); }}>
            + Asignar reconocimiento
          </Btn>
        </div>
      )}

      <Reconocimientos data={data} usuario={{ nombre: profile?.nombre || '' }} defaultMode="mios" />

      {/* Modal asignación */}
      <Modal open={modal} onClose={() => setModal(false)} title="Asignar reconocimiento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Empleado">
            <TSelect value={form.empleado_id}
              onChange={e => setForm(f => ({ ...f, empleado_id: e.target.value }))}
              options={empOpc} />
          </Field>
          <Field label="Reconocimiento">
            <TSelect value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              options={recOpc} />
          </Field>
          {/* Vista previa del emblema seleccionado */}
          {form.titulo && (() => {
            const cat = RECONOCIMIENTOS.find(r => r.title === form.titulo);
            return cat ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14,
                background: T.tealXL, borderRadius: 12, padding: '12px 16px' }}>
                <Emblem shape={cat.shape} glyph={cat.glyph} palette={cat.palette} ribbon={cat.ribbon} size={64} />
                <div>
                  <div style={{ fontWeight: 700, color: T.hi, fontSize: 14 }}>{cat.title}</div>
                  <div style={{ color: T.mid, fontSize: 12.5, marginTop: 3 }}>{cat.desc}</div>
                </div>
              </div>
            ) : null;
          })()}
          <Field label="Fecha">
            <TInput type="date" value={form.fecha}
              onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          </Field>
          {msg && <div style={{ color: T.crit, fontSize: 13 }}>{msg}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn onClick={asignar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Asignar'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const AUTOSERVICIO = [
  { id: 'mi_perfil',          label: 'Mi perfil',        Comp: MiPerfilTab },
  { id: 'mis_documentos',     label: 'Mis documentos',   Comp: MisDocumentosTab },
  { id: 'mis_vacaciones',     label: 'Vacaciones',        Comp: MisVacacionesTab },
  { id: 'mi_expediente',      label: 'Mi expediente',    Comp: MiExpedienteTab },
  { id: 'reconocimientos',    label: 'Mis reconocimientos', Comp: ReconocimientosTab },
];

const GESTION = [
  { id: 'empleados',        label: 'Empleados',    Comp: EmpleadosTab,                             roles: ['admin','auditor'] },
  { id: 'asistencia',       label: 'Asistencia',   Comp: AsistenciaTab,                            roles: ['admin','auditor'] },
  { id: 'nomina',           label: 'Nómina',       Comp: () => <Pendiente label="Nómina" />,       roles: ['admin','auditor'] },
  { id: 'prestaciones',     label: 'Prestaciones', Comp: () => <Pendiente label="Prestaciones" />, roles: ['admin','auditor'] },
  { id: 'vacaciones_admin', label: 'Aprobaciones', Comp: AprobacionesTab,                          roles: ['admin','auditor'] },
  { id: 'disciplina_admin', label: 'Disciplina',   Comp: DisciplinaTab,                            roles: ['admin'] },
];

export function RRHHScreen() {
  const { profile } = useAuth();
  const rol = profile?.rol;

  const tabs = useMemo(() => {
    const gestion = GESTION.filter((t) => t.roles.includes(rol));
    return [...AUTOSERVICIO, ...gestion];
  }, [rol]);

  const [activa, setActiva] = useState(tabs[0]?.id);
  const Actual = tabs.find((t) => t.id === activa)?.Comp || (() => null);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ color: T.hi, marginTop: 0, fontSize: 20, fontWeight: 700 }}>Recursos Humanos</h1>

      <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${T.border}`, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiva(t.id)}
            style={{
              padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13.5,
              color: activa === t.id ? T.tealDk : T.mid,
              borderBottom: activa === t.id ? `2px solid ${T.teal}` : '2px solid transparent',
              fontWeight: activa === t.id ? 700 : 500,
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Actual />
    </div>
  );
}
