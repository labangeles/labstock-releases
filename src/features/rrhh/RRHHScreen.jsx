// src/features/rrhh/RRHHScreen.jsx
// Raíz del módulo. Autoservicio para TODOS los roles; gestión para admin/auditor.
import React, { useState, useMemo } from 'react';
import { T } from '../../shared/ui';
import { useAuth } from '../../contexts/AuthContext';

import MiPerfilTab from './autoservicio/MiPerfilTab';
import MisDocumentosTab from './autoservicio/MisDocumentosTab';
import MisVacacionesTab from './autoservicio/MisVacacionesTab';
import MiExpedienteTab from './autoservicio/MiExpedienteTab';
import EmpleadosTab from './gestion/EmpleadosTab';
import AprobacionesTab from './gestion/AprobacionesTab';
import DisciplinaTab from './gestion/DisciplinaTab';

const Pendiente = ({ label }) => (
  <div style={{ color: T.lo, padding: 24, fontSize: 14 }}>
    La pestaña "{label}" está en desarrollo.
  </div>
);

const AUTOSERVICIO = [
  { id: 'mi_perfil',      label: 'Mi perfil',      Comp: MiPerfilTab },
  { id: 'mis_documentos', label: 'Mis documentos', Comp: MisDocumentosTab },
  { id: 'mis_vacaciones', label: 'Vacaciones',      Comp: MisVacacionesTab },
  { id: 'mi_expediente',  label: 'Mi expediente',  Comp: MiExpedienteTab },
];

const GESTION = [
  { id: 'empleados',        label: 'Empleados',    Comp: EmpleadosTab,                             roles: ['admin','auditor'] },
  { id: 'asistencia',       label: 'Asistencia',   Comp: () => <Pendiente label="Asistencia" />,   roles: ['admin','auditor'] },
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
