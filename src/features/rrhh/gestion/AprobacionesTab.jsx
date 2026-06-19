// src/features/rrhh/gestion/AprobacionesTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Btn } from '../../../shared/ui';
import { useAuth } from '../../../contexts/AuthContext';

const FILTROS = [
  { value: 'solicitado', label: 'Pendientes' },
  { value: 'todos',      label: 'Todos'      },
  { value: 'aprobado',   label: 'Aprobados'  },
  { value: 'rechazado',  label: 'Rechazados' },
];

const BADGE = {
  solicitado: { c: T.warn, bg: T.warnBg, txt: 'Pendiente' },
  aprobado:   { c: T.ok,   bg: T.okBg,   txt: 'Aprobado'  },
  rechazado:  { c: T.crit, bg: T.critBg, txt: 'Rechazado' },
};

function fmtFecha(s) {
  if (!s) return '—';
  try { return new Date(s + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

export default function AprobacionesTab() {
  const { profile } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filtro,      setFiltro]      = useState('solicitado');
  const [notas,       setNotas]       = useState({});       // { [id]: string }
  const [notaOpen,    setNotaOpen]    = useState({});       // { [id]: bool }
  const [procesando,  setProcesando]  = useState(null);
  const [msg,         setMsg]         = useState(null);
  const [loadError,   setLoadError]   = useState(null);

  const cargar = useCallback(async () => {
    if (!profile?.organizacion_id) return;
    setLoading(true); setLoadError(null);
    try {
      let q = supabase
        .from('vacaciones_permisos')
        .select('*, empleados!inner(nombre, apellido, organizacion_id, sedes(nombre))')
        .eq('empleados.organizacion_id', profile.organizacion_id)
        .order('created_at', { ascending: false });
      if (filtro !== 'todos') q = q.eq('estado', filtro);
      const { data, error } = await q;
      if (error) throw error;
      setSolicitudes(data || []);
    } catch {
      setLoadError('Error al cargar las solicitudes. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [filtro, profile?.organizacion_id]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleNota = (id) =>
    setNotaOpen(n => ({ ...n, [id]: !n[id] }));

  const responder = async (id, aprobar) => {
    setProcesando(id); setMsg(null);
    const { error } = await supabase.rpc('rpc_responder_vacaciones', {
      p_id: id, p_aprobar: aprobar, p_nota: notas[id]?.trim() || null,
    });
    if (error) setMsg(error.message);
    else {
      setNotas(n   => { const c = { ...n };    delete c[id]; return c; });
      setNotaOpen(n => { const c = { ...n };   delete c[id]; return c; });
      cargar();
    }
    setProcesando(null);
  };

  if (loading) return <div style={{ color: T.lo, padding: 24 }}>Cargando…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 4 }}>
        {FILTROS.map(f => (
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

      {loadError && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10,
          padding: '12px 16px', color: '#991B1B', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {loadError}
          <button onClick={cargar} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: '#991B1B', fontWeight: 700, fontSize: 13 }}>Reintentar</button>
        </div>
      )}

      {msg && <div style={{ color: T.crit, fontSize: 13 }}>{msg}</div>}

      {solicitudes.length === 0 && (
        <div style={{ color: T.lo, padding: 16 }}>No hay solicitudes en esta categoría.</div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {solicitudes.map(s => {
          const b        = BADGE[s.estado] || BADGE.solicitado;
          const emp      = s.empleados;
          const pendiente = s.estado === 'solicitado';
          const abierta  = notaOpen[s.id] || false;

          return (
            <div key={s.id} style={{ background: T.surface, border: `1px solid ${pendiente ? T.warn + '55' : T.border}`,
                                     borderRadius: 12, padding: 16 }}>

              {/* Cabecera */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: T.hi, fontSize: 15 }}>
                    {emp?.nombre} {emp?.apellido}
                  </div>
                  <div style={{ color: T.lo, fontSize: 12.5, marginTop: 1 }}>
                    {emp?.sedes?.nombre || 'Sin sede'}
                  </div>
                </div>
                <span style={{ color: b.c, background: b.bg, padding: '3px 12px',
                               borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {b.txt}
                </span>
              </div>

              {/* Detalle del período */}
              <div style={{ marginTop: 10, padding: '10px 12px', background: T.canvas,
                            borderRadius: 8, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 10, color: T.lo, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Período</div>
                  <div style={{ fontSize: 13.5, color: T.hi, fontWeight: 500 }}>
                    {fmtFecha(s.fecha_inicio)} → {fmtFecha(s.fecha_fin)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: T.lo, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Días hábiles</div>
                  <div style={{ fontSize: 13.5, color: T.hi, fontWeight: 700 }}>{s.dias_habiles}</div>
                </div>
                {s.motivo && (
                  <div>
                    <div style={{ fontSize: 10, color: T.lo, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Motivo</div>
                    <div style={{ fontSize: 13, color: T.mid }}>{s.motivo}</div>
                  </div>
                )}
              </div>

              {/* Nota ya existente (solicitudes resueltas) */}
              {!pendiente && s.nota_aprobacion && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8,
                              background: s.estado === 'aprobado' ? T.okBg : T.critBg,
                              border: `1px solid ${s.estado === 'aprobado' ? T.ok + '44' : T.crit + '44'}` }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: b.c, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                    Comentario
                  </div>
                  <div style={{ fontSize: 13, color: T.hi }}>{s.nota_aprobacion}</div>
                </div>
              )}

              {/* Acciones (solo pendientes) */}
              {pendiente && (
                <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>

                  {/* Toggle nota */}
                  <button onClick={() => toggleNota(s.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none',
                             border: 'none', cursor: 'pointer', color: abierta ? T.teal : T.lo,
                             fontSize: 13, fontFamily: 'inherit', padding: 0, width: 'fit-content' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {abierta ? 'Ocultar comentario' : 'Agregar comentario (opcional)'}
                  </button>

                  {/* Textarea de nota */}
                  {abierta && (
                    <textarea
                      rows={3}
                      placeholder="Escribe un comentario para el empleado…"
                      value={notas[s.id] || ''}
                      onChange={e => setNotas(n => ({ ...n, [s.id]: e.target.value }))}
                      style={{ width: '100%', borderRadius: 8, border: `1px solid ${T.border}`,
                               padding: '8px 10px', fontFamily: 'inherit', fontSize: 13,
                               color: T.hi, background: T.canvas, resize: 'vertical',
                               outline: 'none', boxSizing: 'border-box' }}
                    />
                  )}

                  {/* Botones */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={() => responder(s.id, true)} disabled={procesando === s.id}>
                      {procesando === s.id ? '…' : 'Aprobar'}
                    </Btn>
                    <Btn variant="danger" onClick={() => responder(s.id, false)} disabled={procesando === s.id}>
                      {procesando === s.id ? '…' : 'Rechazar'}
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
