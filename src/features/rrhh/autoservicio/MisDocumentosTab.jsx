// src/features/rrhh/autoservicio/MisDocumentosTab.jsx
// ⚠️ AUTOSERVICIO — solo documentos propios (RLS). Sin montos.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Btn, IconBtn, Ico } from '../../../shared/ui';
import { useMiEmpleado } from '../lib/useMiEmpleado';
import { subirDocumento, urlFirmada, borrarArchivo } from '../lib/storage';

// Documentos requeridos (sin contrato — ese es área administrativa)
const REQUERIDOS = [
  { value: 'cv',             label: 'Currículum (CV)',                    desc: 'CV actualizado en PDF' },
  { value: 'dpi',            label: 'DPI',                               desc: 'Copia del DPI (ambas caras)' },
  { value: 'igss',           label: 'Carné IGSS',                        desc: 'Copia del carné del IGSS' },
  { value: 'titulo',         label: 'Título / Diploma',                   desc: 'Título o diploma de estudios' },
  { value: 'ant_policiacos', label: 'Antecedentes policiacos',           desc: 'Constancia de antecedentes policiacos vigente' },
  { value: 'ant_penales',    label: 'Antecedentes penales',              desc: 'Constancia de antecedentes penales vigente' },
  { value: 'rtu',            label: 'RTU',                               desc: 'Registro Tributario Unificado (SAT)' },
  { value: 'renas',          label: 'RENAS',                             desc: 'Registro Nacional de Actos del Estado Civil' },
];

function DocCard({ tipo, doc, onSubir, onDescargar, onEliminar, subiendo }) {
  const fileRef = useRef(null);
  const cargado = !!doc;

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${cargado ? T.ok : T.border}`,
      borderRadius: 12, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Estado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, color: T.hi, fontSize: 14 }}>{tipo.label}</div>
          <div style={{ color: T.lo, fontSize: 12, marginTop: 2 }}>{tipo.desc}</div>
        </div>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 999,
          background: cargado ? T.okBg : T.warnBg,
          color: cargado ? T.ok : T.warn,
          whiteSpace: 'nowrap',
        }}>
          {cargado ? '✓ Cargado' : 'Pendiente'}
        </span>
      </div>

      {/* Archivo cargado */}
      {doc && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: T.canvas, borderRadius: 8, padding: '6px 10px' }}>
          <span style={{ color: T.mid, fontSize: 13, overflow: 'hidden',
                         textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
            {doc.nombre_archivo}
          </span>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <IconBtn icon={<Ico.Download s={14}/>} onClick={() => onDescargar(doc)} title="Descargar" />
            <IconBtn icon={<Ico.Trash s={14}/>} onClick={() => onEliminar(doc)} title="Eliminar" danger />
          </div>
        </div>
      )}

      {/* Botón subir */}
      <div>
        <Btn
          variant={cargado ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={subiendo === tipo.value}
          icon={<Ico.Upload s={13}/>}
        >
          {subiendo === tipo.value ? 'Subiendo…' : cargado ? 'Reemplazar' : 'Subir'}
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/png,image/jpeg"
          hidden
          onChange={(e) => { onSubir(e, tipo.value); e.target.value = ''; }}
        />
      </div>
    </div>
  );
}

export default function MisDocumentosTab() {
  const { empleado, loading } = useMiEmpleado();
  const [docs, setDocs] = useState([]);
  const [subiendo, setSubiendo] = useState(null); // value del tipo que se está subiendo
  const [msg, setMsg] = useState(null);

  const cargar = useCallback(async () => {
    if (!empleado) return;
    const { data } = await supabase.from('empleado_documentos')
      .select('*').eq('empleado_id', empleado.id).order('created_at', { ascending: false });
    setDocs(data || []);
  }, [empleado]);

  useEffect(() => { cargar(); }, [cargar]);

  const onSubir = async (e, tipoValue) => {
    const file = e.target.files?.[0];
    if (!file || !empleado) return;
    setSubiendo(tipoValue); setMsg(null);
    try {
      // Si ya existe uno del mismo tipo, lo reemplazamos
      const existente = docs.find((d) => d.tipo === tipoValue);
      if (existente) {
        await borrarArchivo('rrhh-documentos', existente.storage_path);
        await supabase.from('empleado_documentos').delete().eq('id', existente.id);
      }
      const path = await subirDocumento(empleado.id, tipoValue, file);
      const { error } = await supabase.from('empleado_documentos').insert({
        empleado_id: empleado.id, tipo: tipoValue, nombre_archivo: file.name,
        storage_path: path, mime: file.type, tamano_bytes: file.size,
      });
      if (error) throw error;
      cargar();
    } catch (err) { setMsg(err.message); }
    setSubiendo(null);
  };

  const descargar = async (d) => {
    const url = await urlFirmada('rrhh-documentos', d.storage_path);
    if (url) window.open(url, '_blank');
  };

  const eliminar = async (d) => {
    try {
      await borrarArchivo('rrhh-documentos', d.storage_path);
      const { error } = await supabase.from('empleado_documentos').delete().eq('id', d.id);
      if (error) throw error;
      cargar();
    } catch (err) { setMsg(err.message); }
  };

  if (loading) return <div style={{ color: T.lo, padding: 24 }}>Cargando…</div>;
  if (!empleado) return <div style={{ color: T.lo, padding: 24 }}>Tu expediente aún no está creado. Contacta a administración.</div>;

  const cargados = REQUERIDOS.filter((t) => docs.find((d) => d.tipo === t.value)).length;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 860 }}>
      {/* Resumen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12,
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: T.hi }}>
            {cargados} de {REQUERIDOS.length} documentos cargados
          </div>
          <div style={{ color: T.lo, fontSize: 13 }}>
            {cargados === REQUERIDOS.length
              ? 'Tu expediente documental está completo.'
              : 'Por favor sube los documentos pendientes.'}
          </div>
        </div>
        {/* Barra de progreso */}
        <div style={{ width: 120, height: 8, background: T.border, borderRadius: 999, flexShrink: 0 }}>
          <div style={{
            width: `${(cargados / REQUERIDOS.length) * 100}%`,
            height: '100%', borderRadius: 999,
            background: cargados === REQUERIDOS.length ? T.ok : T.teal,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {msg && <div style={{ color: T.crit, fontSize: 13 }}>{msg}</div>}

      {/* Grid de tarjetas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {REQUERIDOS.map((tipo) => (
          <DocCard
            key={tipo.value}
            tipo={tipo}
            doc={docs.find((d) => d.tipo === tipo.value) || null}
            onSubir={onSubir}
            onDescargar={descargar}
            onEliminar={eliminar}
            subiendo={subiendo}
          />
        ))}
      </div>
    </div>
  );
}
