// src/features/rrhh/gestion/AprobacionesTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Btn, TInput } from '../../../shared/ui';

const FILTROS = [
  { value: 'solicitado', label: 'Pendientes' },
  { value: 'todos',      label: 'Todos' },
  { value: 'aprobado',   label: 'Aprobados' },
  { value: 'rechazado',  label: 'Rechazados' },
];

const BADGE = {
  solicitado: { c: T.warn, bg: T.warnBg, txt: 'Pendiente' },
  aprobado:   { c: T.ok,   bg: T.okBg,   txt: 'Aprobado'  },
  rechazado:  { c: T.crit, bg: T.critBg, txt: 'Rechazado' },
};

export default function AprobacionesTab() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('solicitado');
  const [notas, setNotas] = useState({});
  const [procesando, setProcesando] = useState(null);
  const [msg, setMsg] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const q = supabase
      .from('vacaciones_permisos')
      .select('*, empleados(nombre, apellido, sedes(nombre))')
      .order('created_at', { ascending: false });
    if (filtro !== 'todos') q.eq('estado', filtro);
    const { data } = await q;
    setSolicitudes(data || []);
    setLoading(false);
  }, [filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  const responder = async (id, aprobar) => {
    setProcesando(id); setMsg(null);
    const { error } = await supabase.rpc('rpc_responder_vacaciones', {
      p_id: id, p_aprobar: aprobar, p_nota: notas[id] || null,
    });
    if (error) setMsg({ txt: error.message });
    else { setNotas((n) => { const c = { ...n }; delete c[id]; return c; }); cargar(); }
    setProcesando(null);
  };

  if (loading) return <div style={{ color: T.lo, padding: 24 }}>Cargando…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 4 }}>
        {FILTROS.map((f) => (
          <button key={f.value} onClick={() => setFiltro(f.value)}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                     fontFamily: 'inherit', fontSize: 13,
                     background: filtro === f.value ? T.teal : T.canvas,
                     color: filtro === f.value ? '#fff' : T.mid,
                     fontWeight: filtro === f.value ? 600 : 400 }}>
            {f.label}
          </button>
        ))}
      </div>

      {msg && <div style={{ color: T.crit, fontSize: 13 }}>{msg.txt}</div>}

      {solicitudes.length === 0 && (
        <div style={{ color: T.lo, padding: 16 }}>No hay solicitudes en esta categoría.</div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {solicitudes.map((s) => {
          const b = BADGE[s.estado] || BADGE.solicitado;
          const emp = s.empleados;
          const pendiente = s.estado === 'solicitado';
          return (
            <div key={s.id} style={{ background: T.surface, border: `1px solid ${T.border}`,
                                     borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, color: T.hi }}>
                    {emp?.nombre} {emp?.apellido}
                    <span style={{ color: T.lo, fontWeight: 400, fontSize: 13 }}>
                      {' '}· {emp?.sedes?.nombre || 'Sin sede'}
                    </span>
                  </div>
                  <div style={{ color: T.mid, fontSize: 14, marginTop: 4 }}>
                    {s.fecha_inicio} → {s.fecha_fin}
                    <strong style={{ color: T.hi }}> · {s.dias_habiles} día(s)</strong>
                  </div>
                  {s.motivo && (
                    <div style={{ color: T.lo, fontSize: 13, marginTop: 2 }}>
                      Motivo: {s.motivo}
                    </div>
                  )}
                  {s.nota_aprobacion && (
                    <div style={{ color: T.lo, fontSize: 13, marginTop: 2 }}>
                      Nota: {s.nota_aprobacion}
                    </div>
                  )}
                </div>
                <span style={{ color: b.c, background: b.bg, padding: '3px 12px',
                               borderRadius: 999, fontSize: 12, whiteSpace: 'nowrap' }}>
                  {b.txt}
                </span>
              </div>

              {pendiente && (
                <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                  <TInput
                    placeholder="Nota para el empleado (opcional)"
                    value={notas[s.id] || ''}
                    onChange={(e) => setNotas((n) => ({ ...n, [s.id]: e?.target ? e.target.value : e }))}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={() => responder(s.id, true)} disabled={procesando === s.id}>
                      Aprobar
                    </Btn>
                    <Btn variant="danger" onClick={() => responder(s.id, false)} disabled={procesando === s.id}>
                      Rechazar
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
