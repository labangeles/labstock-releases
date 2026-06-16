// Alertas personales de RRHH: documentos, reconocimientos, procesos administrativos
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Ico } from '../../../shared/ui';

const DOCS_REQ = [
  { value: 'cv',             label: 'Currículum (CV)' },
  { value: 'dpi',            label: 'DPI' },
  { value: 'igss',           label: 'Carné IGSS' },
  { value: 'titulo',         label: 'Título / Diploma' },
  { value: 'ant_policiacos', label: 'Antecedentes policiacos' },
  { value: 'ant_penales',    label: 'Antecedentes penales' },
  { value: 'rtu',            label: 'RTU' },
  { value: 'renas',          label: 'RENAS' },
];

function Alerta({ color, bg, icon, titulo, detalle, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? bg : T.surface,
        border: `1px solid ${color}44`, borderLeft: `4px solid ${color}`,
        borderRadius: 12, padding: '13px 16px', cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
      <div style={{ marginTop: 1 }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 700, color: T.hi, fontSize: 13.5 }}>{titulo}</div>
        <div style={{ color: T.mid, fontSize: 12.5, marginTop: 3, lineHeight: 1.4 }}>{detalle}</div>
      </div>
    </div>
  );
}

export function AlertasRRHH({ profile, onNav }) {
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      const { data: emp } = await supabase.from('empleados')
        .select('id').eq('profile_id', profile.id).maybeSingle();
      if (!emp) { setEstado({ docsFaltantes: [], reconocimientos: [], procesos: [] }); return; }

      const [docs, acciones] = await Promise.all([
        supabase.from('empleado_documentos').select('tipo').eq('empleado_id', emp.id),
        supabase.from('acciones_disciplinarias').select('*')
          .eq('empleado_id', emp.id).order('fecha', { ascending: false }),
      ]);

      const cargados = new Set((docs.data || []).map((d) => d.tipo));
      const docsFaltantes = DOCS_REQ.filter((d) => !cargados.has(d.value));
      const todas = acciones.data || [];
      const reconocimientos = todas.filter((a) => a.tipo === 'reconocimiento' && !a.acuse_recibo);
      const procesos = todas.filter((a) => a.tipo !== 'reconocimiento' && !a.acuse_recibo);
      setEstado({ docsFaltantes, reconocimientos, procesos });
    };
    cargar();
  }, [profile.id]);

  if (!estado) return null;
  const { docsFaltantes, reconocimientos, procesos } = estado;
  if (!docsFaltantes.length && !reconocimientos.length && !procesos.length) return null;

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.lo, textTransform: 'uppercase',
                    letterSpacing: '0.09em', marginBottom: 12 }}>
        Mis alertas de Recursos Humanos
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {docsFaltantes.length > 0 && (
          <Alerta
            color={T.warn} bg={T.warnBg}
            icon={<Ico.Receipt s={17} c={T.warn}/>}
            titulo={`${docsFaltantes.length} documento(s) pendiente(s)`}
            detalle={docsFaltantes.map((d) => d.label).join(' · ')}
            onClick={() => onNav('rrhh')}
          />
        )}
        {reconocimientos.map((r) => (
          <Alerta key={r.id}
            color={T.ok} bg={T.okBg}
            icon={<Ico.Check s={17} c={T.ok}/>}
            titulo="¡Tienes un reconocimiento!"
            detalle={`${r.asunto} · ${r.fecha}`}
            onClick={() => onNav('rrhh')}
          />
        ))}
        {procesos.map((p) => (
          <Alerta key={p.id}
            color={T.crit} bg={T.critBg}
            icon={<Ico.Warn s={17} c={T.crit}/>}
            titulo="Proceso administrativo pendiente de acuse"
            detalle={`${p.asunto} · ${p.fecha}`}
            onClick={() => onNav('rrhh')}
          />
        ))}
      </div>
    </div>
  );
}
