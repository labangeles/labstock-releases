// src/components/Reconocimientos.jsx — Sección completa de emblemas
// LabStock · Lab. Clínico Los Ángeles
//
// Catálogo de emblemas + vista "Mis emblemas" (ganados/bloqueados).
// Depende de Emblem.jsx (mismo folder).
//
// USO
//   import Reconocimientos from '../components/Reconocimientos';
//   <Reconocimientos data={emblemasDelEmpleado} usuario={{ nombre }} />
//
// CONECTAR A TU BACKEND
//   Cada item tiene `earned` (bool) y `fecha`. Reemplaza el arreglo
//   RECONOCIMIENTOS por los datos del empleado logueado.

import { useState } from 'react';
import Emblem, { PAL } from './Emblem';

/* ── CATÁLOGO ────────────────────────────────────────────────
   shape:   medallion | sunburst | hexagon | shield
   palette: gold (Honor) | steel (Distinción) | teal (Mérito)
   glyph:   star clock trophy team flask bulb laurel heart target sun shield gear
   ribbon:  cinta inferior (para las distinciones de mayor peso)  */
export const RECONOCIMIENTOS = [
  { id:'empleado',   title:'Empleado del mes',          desc:'Reconocimiento mensual al colaborador más destacado.',                    glyph:'star',   palette:'gold',  shape:'sunburst',  ribbon:true,  earned:false },
  { id:'puntual',    title:'Puntualidad sobresaliente', desc:'Cumplimiento ejemplar de horarios de entrada y salida.',                  glyph:'clock',  palette:'teal',  shape:'medallion',               earned:false },
  { id:'desempeno',  title:'Desempeño excepcional',     desc:'Resultados que superan significativamente las expectativas del puesto.',  glyph:'trophy', palette:'gold',  shape:'medallion', ribbon:true,  earned:false },
  { id:'equipo',     title:'Espíritu de equipo',        desc:'Apoyo constante a compañeros y contribución al ambiente positivo.',       glyph:'team',   palette:'teal',  shape:'medallion',               earned:false },
  { id:'calidad',    title:'Calidad en resultados',     desc:'Precisión y cuidado en el procesamiento y reporte de muestras.',          glyph:'flask',  palette:'steel', shape:'hexagon',                 earned:false },
  { id:'iniciativa', title:'Iniciativa y proactividad', desc:'Identificación y resolución de problemas sin necesidad de ser indicado.', glyph:'bulb',   palette:'teal',  shape:'medallion',               earned:false },
  { id:'antiguedad', title:'Años de servicio',          desc:'Reconocimiento por la trayectoria y fidelidad con la organización.',      glyph:'laurel', palette:'gold',  shape:'medallion', ribbon:true,  earned:false },
  { id:'paciente',   title:'Atención al paciente',      desc:'Trato amable, empático y profesional hacia los pacientes.',               glyph:'heart',  palette:'teal',  shape:'medallion',               earned:false },
  { id:'metas',      title:'Superación de metas',       desc:'Logro o superación de los objetivos establecidos para el período.',       glyph:'target', palette:'gold',  shape:'medallion',               earned:false },
  { id:'actitud',    title:'Actitud positiva',          desc:'Disposición y energía que inspiran a los demás en el equipo.',            glyph:'sun',    palette:'teal',  shape:'sunburst',                earned:false },
  { id:'compromiso', title:'Compromiso con la calidad', desc:'Adherencia estricta a protocolos y buenas prácticas de laboratorio.',     glyph:'shield', palette:'steel', shape:'shield',                  earned:false },
  { id:'innovacion', title:'Innovación y mejora',       desc:'Propuesta o implementación de mejoras en procesos internos.',             glyph:'gear',   palette:'teal',  shape:'hexagon',                 earned:false },
];

const cardBase = {
  background: '#FFF', borderRadius: 16, padding: '22px 20px 18px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
  gap: 4, position: 'relative', transition: 'all .18s',
  border: '1px solid #E7EEF1', boxShadow: '0 1px 2px rgba(20,40,52,0.04)',
};

function EmblemCard({ r, mode }) {
  const [hov, setHov] = useState(false);
  const locked = mode === 'mios' && !r.earned;
  const pal = PAL[r.palette];
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        ...cardBase,
        border: `1px solid ${hov && !locked ? '#CDEBEA' : '#E7EEF1'}`,
        boxShadow: hov && !locked ? '0 10px 30px rgba(43,191,190,0.14)' : cardBase.boxShadow,
        transform: hov && !locked ? 'translateY(-3px)' : 'none',
      }}>
      {/* Etiqueta de nivel */}
      <span style={{
        position: 'absolute', top: 12, right: 12,
        fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
        color: locked ? '#AEBBC0' : pal.rim[2],
        background: locked ? '#F1F5F6' : pal.face[0],
        padding: '3px 8px', borderRadius: 20,
        border: `1px solid ${locked ? '#E3E9EB' : pal.face[1]}`,
      }}>{pal.tier}</span>

      {/* Emblema SVG */}
      <div style={{
        position: 'relative', marginBottom: 6,
        filter: locked ? 'grayscale(0.5)' : 'none',
        opacity: locked ? 0.85 : 1,
        transition: 'transform .25s',
        transform: hov && !locked ? 'scale(1.05)' : 'scale(1)',
      }}>
        <Emblem shape={r.shape} glyph={r.glyph} palette={locked ? 'lock' : r.palette} ribbon={r.ribbon} size={92} />
        {locked && (
          <span style={{
            position: 'absolute', right: 6, bottom: 14,
            width: 24, height: 24, borderRadius: '50%',
            background: '#fff', border: '1px solid #E3E9EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.10)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="#94A4AA" strokeWidth="2.4" strokeLinecap="round">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
        )}
      </div>

      <div style={{
        fontSize: 14.5, fontWeight: 700,
        color: locked ? '#7A8A91' : '#152028',
        letterSpacing: '-0.01em', lineHeight: 1.25,
      }}>{r.title}</div>
      <div style={{
        fontSize: 11.8,
        color: locked ? '#9DABB1' : '#64757E',
        lineHeight: 1.45, maxWidth: 210,
      }}>{r.desc}</div>

      {mode === 'mios' && (
        <div style={{
          marginTop: 8, fontSize: 10.5, fontWeight: 600,
          color: r.earned ? '#12A050' : '#AEBBC0',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {r.earned ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="#12A050" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Obtenido · {r.fecha}
            </>
          ) : 'Por desbloquear'}
        </div>
      )}
    </div>
  );
}

export default function Reconocimientos({ data = RECONOCIMIENTOS, usuario = {}, defaultMode = 'catalogo' }) {
  const [mode, setMode] = useState(defaultMode);
  const earnedN = data.filter(r => r.earned).length;
  const destacado = data.find(r => r.id === 'empleado' && r.earned);

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Encabezado */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 14,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#152028', letterSpacing: '-0.025em', margin: 0 }}>
            Reconocimientos
          </h1>
          <p style={{ fontSize: 13, color: '#8696A0', marginTop: 5 }}>
            Emblemas que el equipo se gana cada mes por su desempeño y compromiso.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {mode === 'mios' && (
            <span style={{ fontSize: 12.5, color: '#5A6A74' }}>
              <b style={{ color: '#1A9696' }}>{earnedN}</b> / {data.length} obtenidos
            </span>
          )}
          {/* Toggle Catálogo / Mis emblemas */}
          <div style={{ display: 'flex', background: '#E3EBEE', borderRadius: 10, padding: 3 }}>
            {[['catalogo','Catálogo'],['mios','Mis emblemas']].map(([id, label]) => (
              <button key={id} onClick={() => setMode(id)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
                background: mode === id ? '#fff' : 'transparent',
                color: mode === id ? '#152028' : '#6B7B85',
                boxShadow: mode === id ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                transition: 'all .12s',
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Banner "Empleado del mes" — solo si lo tiene ganado */}
      {mode === 'mios' && destacado && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22,
          background: 'linear-gradient(100deg, #16807F, #2BBFBE)',
          borderRadius: 16, padding: '18px 24px',
          boxShadow: '0 10px 30px rgba(43,191,190,0.28)',
        }}>
          <Emblem shape="sunburst" glyph="star" palette="gold" ribbon size={78} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Distinción del mes
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginTop: 3, letterSpacing: '-0.01em' }}>
              {usuario.nombre} · Empleado del mes
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>
              {destacado.fecha} — por su liderazgo y precisión en el control de bodega.
            </div>
          </div>
        </div>
      )}

      {/* Cuadrícula de emblemas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(216px, 1fr))', gap: 16 }}>
        {data.map(r => <EmblemCard key={r.id} r={r} mode={mode} />)}
      </div>
    </div>
  );
}
