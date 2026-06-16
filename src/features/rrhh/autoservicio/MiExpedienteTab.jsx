// src/features/rrhh/autoservicio/MiExpedienteTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Btn, TInput, TSelect, Ico } from '../../../shared/ui';
import { useMiEmpleado } from '../lib/useMiEmpleado';
import { urlFirmada } from '../lib/storage';
import { useAuth } from '../../../contexts/AuthContext';

const TIPO_LABEL = {
  llamada_atencion:    { txt: 'Llamada de atención',  c: T.warn, bg: T.warnBg },
  amonestacion_escrita:{ txt: 'Amonestación escrita', c: T.crit, bg: T.critBg },
  suspension:          { txt: 'Suspensión',           c: T.crit, bg: T.critBg },
  reconocimiento:      { txt: 'Reconocimiento',       c: T.ok,   bg: T.okBg   },
};

const RECON_MAP = {
  'Empleado del mes':          { icono: '⭐', desc: 'Reconocimiento mensual al colaborador más destacado.' },
  'Puntualidad sobresaliente': { icono: '⏰', desc: 'Cumplimiento ejemplar de horarios de entrada y salida.' },
  'Desempeño excepcional':     { icono: '🏆', desc: 'Resultados que superan las expectativas del puesto.' },
  'Espíritu de equipo':        { icono: '🤝', desc: 'Apoyo constante a compañeros y ambiente de trabajo positivo.' },
  'Calidad en resultados':     { icono: '🔬', desc: 'Precisión y cuidado en el procesamiento y reporte de muestras.' },
  'Iniciativa y proactividad': { icono: '💡', desc: 'Identificación y resolución de problemas sin necesidad de ser indicado.' },
  'Años de servicio':          { icono: '📅', desc: 'Reconocimiento por trayectoria y fidelidad con la organización.' },
  'Atención al paciente':      { icono: '😊', desc: 'Trato amable, empático y profesional hacia los pacientes.' },
  'Superación de metas':       { icono: '📈', desc: 'Logro o superación de los objetivos establecidos para el período.' },
  'Actitud positiva':          { icono: '🌟', desc: 'Disposición y energía que inspiran a los demás en el equipo.' },
  'Compromiso con la calidad': { icono: '🛡️', desc: 'Adherencia estricta a protocolos y buenas prácticas de laboratorio.' },
  'Innovación y mejora':       { icono: '🚀', desc: 'Propuesta o implementación de mejoras en procesos internos.' },
};

/* ── Convierte URL a base64 para embeber la foto sin depender de red al imprimir ── */
async function urlABase64(url) {
  try {
    const res  = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

/* ── Genera el HTML completo del certificado (autocontenido) ── */
function buildCertHTML({ nombreCompleto, cargo, sede, ingreso, hoy, orgNombre,
                          fotoBase64, inicialFoto, unicos, conteo, totalRecon }) {
  const fotoTag = fotoBase64
    ? `<img src="${fotoBase64}" style="width:130px;height:130px;border-radius:50%;object-fit:cover;border:4px solid rgba(255,255,255,0.5);flex-shrink:0;display:block;" />`
    : `<div style="width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,0.18);border:4px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:800;color:#fff;flex-shrink:0;">${inicialFoto}</div>`;

  const badgesHTML = unicos.map(r => {
    const info  = RECON_MAP[r.asunto] || { icono: '🏅', desc: r.asunto };
    const veces = conteo[r.asunto];
    const fStr  = r.fecha
      ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-GT', { day:'numeric', month:'long', year:'numeric' })
      : '';
    return `<div style="background:#f0fffe;border:1.5px solid #b2e8e8;border-radius:12px;padding:14px 16px;display:flex;gap:13px;align-items:flex-start;">
      <div style="font-size:28px;line-height:1;flex-shrink:0;padding-top:2px;">${info.icono}</div>
      <div>
        <div style="font-weight:700;color:#0B4F4F;font-size:14px;margin-bottom:4px;">
          ${r.asunto}${veces > 1 ? ` <span style="font-size:11px;background:#d0f0f0;color:#0B6B6A;border-radius:20px;padding:1px 8px;font-weight:700;margin-left:4px;">x${veces}</span>` : ''}
        </div>
        <div style="color:#436B6B;font-size:12px;line-height:1.5;">${info.desc}</div>
        ${fStr ? `<div style="color:#2BBFBE;font-size:11px;margin-top:5px;font-weight:600;">${fStr}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Certificado — ${nombreCompleto}</title>
<style>
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html, body { background:#e8f4f4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; color:#1a2a2a; }

  .page { width:794px; margin:24px auto; background:#fff; border-radius:16px;
          box-shadow:0 8px 40px rgba(0,0,0,0.15); overflow:hidden; }

  /* ── ENCABEZADO ── */
  .header {
    background:linear-gradient(135deg, #2BBFBE 0%, #0a7070 100%);
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
    padding:40px 44px; display:flex; align-items:center; gap:32px; color:#fff;
  }
  .org-label  { font-size:10px; letter-spacing:.15em; text-transform:uppercase; opacity:.72; margin-bottom:6px; }
  .cert-title { font-size:17px; font-weight:600; margin-bottom:14px; opacity:.88; }
  .emp-nombre { font-size:30px; font-weight:800; letter-spacing:-.03em; line-height:1.1; margin-bottom:6px; }
  .emp-sub    { font-size:14px; opacity:.82; margin-top:3px; }
  .emp-meta   { font-size:12px; opacity:.62; margin-top:3px; }

  /* ── CUERPO ── */
  .body { padding:36px 44px 44px; }

  /* ── STATS ── */
  .stats { display:flex; gap:14px; margin-bottom:28px; }
  .stat  {
    flex:1; text-align:center; border-radius:13px; padding:18px 10px;
    background:#f0fffe; border:1.5px solid #b2e8e8;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .stat-num { font-size:32px; font-weight:800; color:#2BBFBE; line-height:1; margin-bottom:5px; }
  .stat-lbl { font-size:11.5px; color:#436B6B; }

  /* ── MÉRITOS ── */
  .section-hd { font-size:10px; font-weight:700; color:#9AB8B8; text-transform:uppercase;
                letter-spacing:.12em; margin-bottom:14px; }
  .badges     { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:28px; }

  /* ── PÁRRAFO ── */
  .merito {
    background:#f7fdfd; border-left:5px solid #2BBFBE; border-radius:0 10px 10px 0;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
    padding:16px 22px; margin-bottom:32px; font-size:13.5px; color:#2a4444;
    line-height:1.8; font-style:italic;
  }

  /* ── FIRMAS ── */
  .footer { border-top:1px solid #d8ecec; padding-top:24px;
            display:flex; justify-content:space-between; align-items:flex-end; }
  .firma      { text-align:center; }
  .firma-line { width:180px; height:1px; background:#2BBFBE; margin:0 auto 7px;
                -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .firma-lbl  { font-size:11px; color:#9AB8B8; }

  @media print {
    html, body { background:#fff; }
    .page   { margin:0; border-radius:0; box-shadow:none; width:100%; }
    .header { border-radius:0; }
  }
</style>
</head>
<body>

<div class="page">

  <div class="header">
    ${fotoTag}
    <div style="flex:1;">
      <div class="org-label">${orgNombre}</div>
      <div class="cert-title">Certificado de Reconocimiento Laboral</div>
      <div class="emp-nombre">${nombreCompleto}</div>
      ${cargo  ? `<div class="emp-sub">${cargo}</div>` : ''}
      ${sede   ? `<div class="emp-meta">📍 ${sede}</div>` : ''}
      ${ingreso? `<div class="emp-meta" style="margin-top:6px;">Colaborador desde: ${ingreso}</div>` : ''}
    </div>
  </div>

  <div class="body">

    <div class="stats">
      <div class="stat">
        <div class="stat-num">${totalRecon}</div>
        <div class="stat-lbl">Reconocimientos totales</div>
      </div>
      <div class="stat">
        <div class="stat-num">${unicos.length}</div>
        <div class="stat-lbl">Categorías distintas</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="font-size:26px;padding-top:2px;">⭐</div>
        <div class="stat-lbl">Colaborador destacado</div>
      </div>
    </div>

    ${unicos.length > 0 ? `
    <div class="section-hd">Méritos obtenidos</div>
    <div class="badges">${badgesHTML}</div>` : ''}

    <div class="merito">
      "Por medio de la presente se hace constar que <strong>${nombreCompleto}</strong>${cargo ? `, en el cargo de ${cargo},` : ''}
      ha demostrado un desempeño sobresaliente y ha sido acreedor/a de ${totalRecon}
      reconocimiento${totalRecon !== 1 ? 's' : ''} en ${unicos.length}
      categoría${unicos.length !== 1 ? 's' : ''} diferentes. Su dedicación, actitud y compromiso
      son un ejemplo para el equipo de ${orgNombre}."
    </div>

    <div class="footer">
      <div class="firma">
        <div class="firma-line"></div>
        <div class="firma-lbl">Director / Gerente General</div>
      </div>
      <div class="firma">
        <div class="firma-line"></div>
        <div class="firma-lbl">Recursos Humanos</div>
      </div>
      <div style="font-size:11.5px;color:#9AB8B8;">Emitido el ${hoy}</div>
    </div>

  </div>
</div>
</body>
</html>`;
}

/* ── Abre el certificado en un iframe de pantalla completa (evita bloqueo de window.open) ── */
async function mostrarCertificado({ empleado, reconocimientos, fotoUrl, orgNombre }) {
  const nombreCompleto = `${empleado.nombre || ''} ${empleado.apellido || ''}`.trim();
  const cargo   = empleado.cargos?.nombre || '';
  const sede    = empleado.sedes?.nombre  || '';
  const ingreso = empleado.fecha_ingreso
    ? new Date(empleado.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-GT', { day:'numeric', month:'long', year:'numeric' })
    : '';
  const hoy = new Date().toLocaleDateString('es-GT', { day:'numeric', month:'long', year:'numeric' });

  const vistos = new Set();
  const unicos = reconocimientos.filter(r => {
    if (vistos.has(r.asunto)) return false; vistos.add(r.asunto); return true;
  });
  const conteo = {};
  reconocimientos.forEach(r => { conteo[r.asunto] = (conteo[r.asunto] || 0) + 1; });

  const fotoBase64  = fotoUrl ? await urlABase64(fotoUrl) : null;
  const inicialFoto = (nombreCompleto[0] || '').toUpperCase();

  const html = buildCertHTML({
    nombreCompleto, cargo, sede, ingreso, hoy, orgNombre,
    fotoBase64, inicialFoto, unicos, conteo, totalRecon: reconocimientos.length,
  });

  const prev = document.getElementById('__cert_overlay__');
  if (prev) prev.remove();

  // Overlay
  const overlay = document.createElement('div');
  overlay.id = '__cert_overlay__';
  Object.assign(overlay.style, {
    position:'fixed', inset:'0', zIndex:'9999',
    display:'flex', flexDirection:'column', background:'#0B4F4F',
  });

  // Barra de controles EXTERIOR al iframe — sin solapamiento
  const toolbar = document.createElement('div');
  Object.assign(toolbar.style, {
    display:'flex', justifyContent:'space-between', alignItems:'center',
    padding:'10px 20px', background:'#0B4F4F', flexShrink:'0',
  });
  toolbar.innerHTML = `
    <span style="color:#fff;font-size:14px;font-weight:700;">
      Vista previa — Certificado de Reconocimientos
    </span>
    <div style="display:flex;gap:10px;">
      <button id="__cert_print__"
        style="background:#2BBFBE;color:#fff;border:none;border-radius:8px;
               padding:8px 20px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;">
        🖨️ &nbsp;Imprimir / Guardar PDF
      </button>
      <button id="__cert_close__"
        style="background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.25);
               border-radius:8px;padding:8px 16px;font-size:13.5px;cursor:pointer;font-family:inherit;">
        ✕ &nbsp;Cerrar
      </button>
    </div>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'flex:1;border:none;width:100%;background:#e8f4f4;';
  iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');

  overlay.appendChild(toolbar);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);

  // Eventos DESPUÉS de que el toolbar esté en el DOM
  document.getElementById('__cert_close__').onclick  = () => overlay.remove();
  document.getElementById('__cert_print__').onclick  = () => iframe.contentWindow?.print();

  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
}

/* ════════════════════════════════════════════════════════════ */
export default function MiExpedienteTab() {
  const { profile } = useAuth();
  const { empleado: miEmpleado, loading: miLoading } = useMiEmpleado();
  const isAdmin = profile?.rol === 'admin';

  const [listaEmp, setListaEmp]     = useState([]);
  const [selEmpId, setSelEmpId]     = useState('');
  const [selEmp, setSelEmp]         = useState(null);
  const [loadingEmp, setLoadingEmp] = useState(false);
  const [items, setItems]           = useState([]);
  const [coment, setComent]         = useState({});
  const [msg, setMsg]               = useState(null);
  const [exportando, setExportando] = useState(false);

  // Eliminar el overlay del certificado al salir de este tab
  useEffect(() => {
    return () => { document.getElementById('__cert_overlay__')?.remove(); };
  }, []);

  useEffect(() => {
    if (!isAdmin || !profile?.organizacion_id) return;
    supabase.from('empleados')
      .select('id, nombre, apellido, cargos(nombre)')
      .eq('organizacion_id', profile.organizacion_id)
      .eq('activo', true)
      .order('apellido')
      .then(({ data }) => setListaEmp(data || []));
  }, [isAdmin, profile?.organizacion_id]);

  useEffect(() => {
    if (!selEmpId) { setSelEmp(null); return; }
    setLoadingEmp(true);
    supabase.from('empleados')
      .select('*, cargos(nombre), sedes(nombre)')
      .eq('id', selEmpId)
      .maybeSingle()
      .then(({ data }) => { setSelEmp(data || null); setLoadingEmp(false); });
  }, [selEmpId]);

  const empleado = selEmpId ? selEmp : miEmpleado;
  const loading  = selEmpId ? loadingEmp : miLoading;

  const cargar = useCallback(async () => {
    if (!empleado) return;
    const { data } = await supabase.from('acciones_disciplinarias')
      .select('*').eq('empleado_id', empleado.id).order('fecha', { ascending: false });
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

  const exportarCertificado = async () => {
    if (!empleado) return;
    setExportando(true);
    try {
      const [{ data: reconocimientos }, { data: org }] = await Promise.all([
        supabase.from('acciones_disciplinarias')
          .select('asunto, fecha')
          .eq('empleado_id', empleado.id)
          .eq('tipo', 'reconocimiento')
          .order('fecha', { ascending: false }),
        supabase.from('organizaciones')
          .select('nombre')
          .eq('id', profile.organizacion_id)
          .maybeSingle(),
      ]);
      let fotoUrl = null;
      if (empleado.foto_path) fotoUrl = await urlFirmada('rrhh-fotos', empleado.foto_path);
      await mostrarCertificado({
        empleado,
        reconocimientos: reconocimientos || [],
        fotoUrl,
        orgNombre: org?.nombre || 'Laboratorio',
      });
    } finally {
      setExportando(false);
    }
  };

  const empOpciones = [
    { value: '', label: 'Mi expediente' },
    ...listaEmp.map(e => ({
      value: e.id,
      label: `${e.apellido}, ${e.nombre}${e.cargos?.nombre ? ` — ${e.cargos.nombre}` : ''}`,
    })),
  ];

  const reconocimientos = items.filter(i => i.tipo === 'reconocimiento');

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 760 }}>

      {isAdmin && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.lo, textTransform: 'uppercase',
                        letterSpacing: '0.09em', marginBottom: 8 }}>
            Ver expediente de
          </div>
          <TSelect value={selEmpId} onChange={e => setSelEmpId(e.target.value)} options={empOpciones} />
        </div>
      )}

      {isAdmin && empleado && (
        <div style={{
          background: `linear-gradient(135deg, ${T.tealXL} 0%, ${T.surface} 100%)`,
          border: `1px solid ${T.teal}44`, borderRadius: 12,
          padding: '14px 18px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontWeight: 700, color: T.tealDk, fontSize: 14 }}>
              Certificado — {empleado.nombre} {empleado.apellido}
            </div>
            <div style={{ color: T.lo, fontSize: 12.5, marginTop: 2 }}>
              {reconocimientos.length} reconocimiento{reconocimientos.length !== 1 ? 's' : ''} en el expediente
            </div>
          </div>
          <Btn onClick={exportarCertificado} disabled={exportando || reconocimientos.length === 0}>
            {exportando ? 'Generando…' : <><Ico.Download s={14}/>&nbsp;Exportar certificado</>}
          </Btn>
        </div>
      )}

      {loading ? (
        <div style={{ color: T.lo, padding: 24 }}>Cargando…</div>
      ) : !empleado ? (
        <div style={{ color: T.lo, padding: 24 }}>
          {selEmpId ? 'No se encontró el expediente.' : 'Tu expediente aún no está creado. Contacta a administración.'}
        </div>
      ) : (
        <>
          {msg && <div style={{ color: T.crit, fontSize: 14 }}>{msg.txt}</div>}
          {items.length === 0 && (
            <div style={{ color: T.lo, padding: 24 }}>No hay registros en este expediente.</div>
          )}
          {items.map((a) => {
            const t    = TIPO_LABEL[a.tipo] || { txt: a.tipo, c: T.mid, bg: T.canvas };
            const esMio = !selEmpId;
            return (
              <div key={a.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: t.c, background: t.bg, padding: '2px 10px', borderRadius: 999, fontSize: 12 }}>
                    {t.txt}
                  </span>
                  <span style={{ color: T.lo, fontSize: 13 }}>{a.fecha}</span>
                </div>
                <h4 style={{ color: T.hi, margin: '8px 0 4px' }}>{a.asunto}</h4>
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
