// src/features/rrhh/autoservicio/MiExpedienteTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Btn, TInput, Ico } from '../../../shared/ui';
import { useMiEmpleado } from '../lib/useMiEmpleado';
import { urlFirmada } from '../lib/storage';
import Emblem from '../../../components/Emblem';

const TIPO_LABEL = {
  llamada_atencion:    { txt: 'Llamada de atención',  c: T.warn, bg: T.warnBg },
  amonestacion_escrita:{ txt: 'Amonestación escrita', c: T.crit, bg: T.critBg },
  suspension:          { txt: 'Suspensión',           c: T.crit, bg: T.critBg },
  reconocimiento:      { txt: 'Reconocimiento',       c: T.ok,   bg: T.okBg   },
};

const RECON_MAP = {
  'Empleado del mes':          { shape:'sunburst',  glyph:'star',   palette:'gold',  ribbon:true,  desc:'Reconocimiento mensual al colaborador más destacado.' },
  'Puntualidad sobresaliente': { shape:'medallion', glyph:'clock',  palette:'teal',  ribbon:false, desc:'Cumplimiento ejemplar de horarios de entrada y salida.' },
  'Desempeño excepcional':     { shape:'medallion', glyph:'trophy', palette:'gold',  ribbon:true,  desc:'Resultados que superan significativamente las expectativas del puesto.' },
  'Espíritu de equipo':        { shape:'medallion', glyph:'team',   palette:'teal',  ribbon:false, desc:'Apoyo constante a compañeros y contribución al ambiente positivo.' },
  'Calidad en resultados':     { shape:'hexagon',   glyph:'flask',  palette:'steel', ribbon:false, desc:'Precisión y cuidado en el procesamiento y reporte de muestras.' },
  'Iniciativa y proactividad': { shape:'medallion', glyph:'bulb',   palette:'teal',  ribbon:false, desc:'Identificación y resolución de problemas sin necesidad de ser indicado.' },
  'Años de servicio':          { shape:'medallion', glyph:'laurel', palette:'gold',  ribbon:true,  desc:'Reconocimiento por trayectoria y fidelidad con la organización.' },
  'Atención al paciente':      { shape:'medallion', glyph:'heart',  palette:'teal',  ribbon:false, desc:'Trato amable, empático y profesional hacia los pacientes.' },
  'Superación de metas':       { shape:'medallion', glyph:'target', palette:'gold',  ribbon:false, desc:'Logro o superación de los objetivos establecidos para el período.' },
  'Actitud positiva':          { shape:'sunburst',  glyph:'sun',    palette:'teal',  ribbon:false, desc:'Disposición y energía que inspiran a los demás en el equipo.' },
  'Compromiso con la calidad': { shape:'shield',    glyph:'shield', palette:'steel', ribbon:false, desc:'Adherencia estricta a protocolos y buenas prácticas de laboratorio.' },
  'Innovación y mejora':       { shape:'hexagon',   glyph:'gear',   palette:'teal',  ribbon:false, desc:'Propuesta o implementación de mejoras en procesos internos.' },
};

/* ════════════════════════════════════════════════════════════ */
export default function MiExpedienteTab() {
  const { empleado, loading } = useMiEmpleado();

  const [items,  setItems]  = useState([]);
  const [coment, setComent] = useState({});
  const [msg,    setMsg]    = useState(null);

  const cargar = useCallback(async () => {
    if (!empleado) return;
    const { data, error } = await supabase.from('acciones_disciplinarias')
      .select('*').eq('empleado_id', empleado.id).order('fecha', { ascending: false });
    if (error) { setMsg({ tipo: 'err', txt: 'Error al cargar el expediente. Intenta de nuevo.' }); return; }
    setItems(data || []);
  }, [empleado]);

  useEffect(() => { cargar(); }, [cargar]);

  const acusar = async (a) => {
    setMsg(null);
    const { error } = await supabase.rpc('rpc_acusar_disciplinaria', {
      p_id: a.id, p_comentario: coment[a.id] || null,
    });
    if (error) setMsg({ tipo: 'err', txt: error.message });
    else cargar();
  };

  const verDoc = async (a) => {
    const url = await urlFirmada('rrhh-documentos', a.documento_path);
    if (url) window.open(url, '_blank');
  };

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 760 }}>

      {loading ? (
        <div style={{ color: T.lo, padding: 24 }}>Cargando…</div>
      ) : !empleado ? (
        <div style={{ color: T.lo, padding: 24 }}>Tu expediente aún no está creado. Contacta a administración.</div>
      ) : (
        <>
          {msg && <div style={{ color: T.crit, fontSize: 14 }}>{msg.txt}</div>}
          {items.length === 0 && (
            <div style={{ color: T.lo, padding: 24 }}>No hay registros en este expediente.</div>
          )}
          {items.map((a) => {
            const t     = TIPO_LABEL[a.tipo] || { txt: a.tipo, c: T.mid, bg: T.canvas };
            const esMio = true;
            return (
              <div key={a.id} style={{ background: T.surface, border: `1px solid ${a.tipo === 'reconocimiento' ? T.teal + '44' : T.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: t.c, background: t.bg, padding: '2px 10px', borderRadius: 999, fontSize: 12 }}>
                    {t.txt}
                  </span>
                  <span style={{ color: T.lo, fontSize: 13 }}>{a.fecha}</span>
                </div>
                {a.tipo === 'reconocimiento' && RECON_MAP[a.asunto] && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '10px 0 6px' }}>
                    <Emblem
                      shape={RECON_MAP[a.asunto].shape}
                      glyph={RECON_MAP[a.asunto].glyph}
                      palette={RECON_MAP[a.asunto].palette}
                      ribbon={RECON_MAP[a.asunto].ribbon}
                      size={64}
                    />
                    <div>
                      <div style={{ fontWeight: 700, color: T.hi, fontSize: 15 }}>{a.asunto}</div>
                      <div style={{ color: T.lo, fontSize: 12.5, marginTop: 2 }}>{RECON_MAP[a.asunto].desc}</div>
                    </div>
                  </div>
                )}
                {a.tipo !== 'reconocimiento' && <h4 style={{ color: T.hi, margin: '8px 0 4px' }}>{a.asunto}</h4>}
                {a.descripcion && <p style={{ color: T.mid, fontSize: 14, marginTop: 0 }}>{a.descripcion}</p>}
                {a.documento_path && (
                  <button onClick={() => verDoc(a)}
                    style={{ color: T.teal, background: 'none', border: 'none', cursor: 'pointer',
                             padding: 0, display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
                    <Ico.Download s={14}/> Ver documento
                  </button>
                )}
                {a.acuse_recibo ? (
                  <div style={{ color: T.ok, fontSize: 13, marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Ico.Check s={14}/>
                    Acuse registrado el {a.fecha_acuse ? new Date(a.fecha_acuse).toLocaleDateString('es-GT') : ''}
                    {a.comentario_empleado && <span style={{ color: T.lo }}> · "{a.comentario_empleado}"</span>}
                  </div>
                ) : esMio ? (
                  <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                    <TInput
                      placeholder="Comentario o descargo (opcional)"
                      value={coment[a.id] || ''}
                      onChange={(e) => setComent((c) => ({ ...c, [a.id]: e?.target ? e.target.value : e }))}
                    />
                    <div><Btn onClick={() => acusar(a)}>Acuso de recibo</Btn></div>
                  </div>
                ) : (
                  <div style={{ color: T.warn, fontSize: 12.5, marginTop: 8 }}>
                    Pendiente de acuse por el empleado
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
