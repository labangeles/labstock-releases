// src/features/rrhh/gestion/ExpedienteAdminTab.jsx
// Vista administrativa: navegar y exportar expediente completo de cualquier empleado.
import React, { useState, useEffect, useCallback } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { supabase } from '../../../lib/supabase';
import { T, Btn, TSelect, Ico } from '../../../shared/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { urlFirmada } from '../lib/storage';
import Emblem from '../../../components/Emblem';
import logoUrl from '../../../assets/logo-icon-teal.png';

/* ── constantes ─────────────────────────────────────────────── */
const DOCS_REQ = [
  { value: 'cv',             label: 'Currículum (CV)'         },
  { value: 'dpi',            label: 'DPI'                      },
  { value: 'igss',           label: 'Carné IGSS'              },
  { value: 'titulo',         label: 'Título / Diploma'         },
  { value: 'ant_policiacos', label: 'Antecedentes policiacos' },
  { value: 'ant_penales',    label: 'Antecedentes penales'    },
  { value: 'rtu',            label: 'RTU'                      },
  { value: 'renas',          label: 'RENAS'                    },
];

// Solo tipos disciplinarios — reconocimientos van en su propio módulo
const TIPO_INFO = {
  llamada_atencion:     { txt:'Llamada de atención',  c:'#B45309', bg:'#FEF3C7' },
  amonestacion_escrita: { txt:'Amonestación escrita', c:'#DC2626', bg:'#FEE2E2' },
  suspension:           { txt:'Suspensión',           c:'#DC2626', bg:'#FEE2E2' },
};

const VACACACIONES_ESTADO = {
  solicitado: { txt:'Pendiente', c:'#B45309', bg:'#FEF3C7' },
  aprobado:   { txt:'Aprobado',  c:'#16A34A', bg:'#DCFCE7' },
  rechazado:  { txt:'Rechazado', c:'#DC2626', bg:'#FEE2E2' },
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

/* ── helpers ────────────────────────────────────────────────── */
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

async function toBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise(resolve => {
      const r = new FileReader();
      r.onload  = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

function emblemHtml(cfg, size = 84) {
  try {
    return renderToStaticMarkup(
      <Emblem shape={cfg.shape} glyph={cfg.glyph} palette={cfg.palette} ribbon={cfg.ribbon || false} size={size} />
    );
  } catch { return ''; }
}

function fmtFecha(s, opts = { day:'numeric', month:'long', year:'numeric' }) {
  if (!s) return '—';
  try { return new Date(s + 'T12:00:00').toLocaleDateString('es-GT', opts); }
  catch { return s; }
}

function emblemSvg(cfg, size = 56) {
  try {
    return renderToStaticMarkup(
      <Emblem shape={cfg.shape} glyph={cfg.glyph} palette={cfg.palette} ribbon={cfg.ribbon || false} size={size} />
    );
  } catch { return ''; }
}

/* ── certificado de reconocimientos ─────────────────────────── */
function buildCertHTML({ nombreCompleto, cargo, sede, ingreso, hoy, orgNombre,
                         fotoBase64, inicialFoto, unicos, conteo, totalRecon,
                         logoBase64, adminNombre, labCompleto }) {
  const fotoTag = fotoBase64
    ? `<img src="${fotoBase64}" style="width:130px;height:130px;border-radius:50%;object-fit:cover;border:4px solid rgba(255,255,255,0.5);flex-shrink:0;" />`
    : `<div style="width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,0.18);border:4px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:800;color:#fff;flex-shrink:0;">${inicialFoto}</div>`;

  const DEFAULT_CFG = { shape:'medallion', glyph:'star', palette:'teal', ribbon:false };
  const badgesHTML = unicos.map(r => {
    const info  = RECON_MAP[r.asunto] || { ...DEFAULT_CFG, desc: esc(r.asunto) };
    const veces = conteo[r.asunto];
    const fStr  = r.fecha
      ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-GT', { day:'numeric', month:'long', year:'numeric' })
      : '';
    return `<div style="background:#f0fffe;border:1.5px solid #b2e8e8;border-radius:12px;padding:14px 16px;display:flex;gap:16px;align-items:center;">
      <div style="flex-shrink:0;">${emblemHtml(info, 84)}</div>
      <div>
        <div style="font-weight:700;color:#0B4F4F;font-size:14px;margin-bottom:4px;">
          ${esc(r.asunto)}${veces > 1 ? ` <span style="font-size:11px;background:#d0f0f0;color:#0B6B6A;border-radius:20px;padding:1px 8px;font-weight:700;margin-left:4px;">x${veces}</span>` : ''}
        </div>
        <div style="color:#436B6B;font-size:12px;line-height:1.5;">${info.desc}</div>
        ${fStr ? `<div style="color:#2BBFBE;font-size:11px;margin-top:5px;font-weight:600;">${esc(fStr)}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/>
<title>Certificado — ${esc(nombreCompleto)}</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html,body{background:#e8f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a2a2a;}
  .page{width:794px;margin:24px auto;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.15);overflow:hidden;}
  .header{background:linear-gradient(135deg,#2BBFBE 0%,#0a7070 100%);-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:40px 44px;display:flex;align-items:center;gap:32px;color:#fff;}
  .org-label{font-size:10px;letter-spacing:.15em;text-transform:uppercase;opacity:.72;margin-bottom:6px;}
  .cert-title{font-size:17px;font-weight:600;margin-bottom:14px;opacity:.88;}
  .emp-nombre{font-size:30px;font-weight:800;letter-spacing:-.03em;line-height:1.1;margin-bottom:6px;}
  .body{padding:36px 44px 44px;}
  .stats{display:flex;gap:14px;margin-bottom:28px;}
  .stat{flex:1;text-align:center;border-radius:13px;padding:18px 10px;background:#f0fffe;border:1.5px solid #b2e8e8;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .stat-num{font-size:32px;font-weight:800;color:#2BBFBE;line-height:1;margin-bottom:5px;}
  .stat-lbl{font-size:11.5px;color:#436B6B;}
  .section-hd{font-size:10px;font-weight:700;color:#9AB8B8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:14px;}
  .badges{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:28px;}
  .merito{background:#f7fdfd;border-left:5px solid #2BBFBE;border-radius:0 10px 10px 0;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:16px 22px;margin-bottom:32px;font-size:13.5px;color:#2a4444;line-height:1.8;font-style:italic;}
  .footer{border-top:1px solid #d8ecec;padding-top:24px;display:flex;justify-content:space-between;align-items:flex-end;}
  .firma{text-align:center;}
  .firma-line{width:180px;height:1px;background:#2BBFBE;margin:0 auto 7px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .firma-lbl{font-size:11px;color:#9AB8B8;}
  @media print{html,body{background:#fff;}.page{margin:0;border-radius:0;box-shadow:none;width:100%;}}
</style></head><body>
<div class="page">
  <div class="header">
    ${fotoTag}
    <div style="flex:1;">
      ${logoBase64 ? `<div style="display:flex;align-items:center;gap:11px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.22);">
        <img src="${logoBase64}" style="height:42px;width:auto;filter:brightness(0) invert(1);opacity:.9;" />
        <div><div style="font-size:18px;font-weight:800;color:#fff;">Los Ángeles</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.5);letter-spacing:.1em;text-transform:uppercase;margin-top:2px;">Mucho más que un diagnóstico</div></div>
      </div>` : ''}
      <div class="org-label">${esc(labCompleto)}</div>
      <div class="cert-title">Certificado de Reconocimiento Laboral</div>
      <div class="emp-nombre">${esc(nombreCompleto)}</div>
      ${cargo   ? `<div style="font-size:14px;opacity:.82;margin-top:3px;">${esc(cargo)}</div>` : ''}
      ${sede    ? `<div style="font-size:12px;opacity:.62;margin-top:3px;">📍 ${esc(sede)}</div>` : ''}
      ${ingreso ? `<div style="font-size:12px;opacity:.62;margin-top:4px;">Colaborador desde: ${esc(ingreso)}</div>` : ''}
    </div>
  </div>
  <div class="body">
    <div class="stats">
      <div class="stat"><div class="stat-num">${totalRecon}</div><div class="stat-lbl">Reconocimientos totales</div></div>
      <div class="stat"><div class="stat-num">${unicos.length}</div><div class="stat-lbl">Categorías distintas</div></div>
      <div class="stat"><div style="display:flex;justify-content:center;margin-bottom:2px;">${emblemHtml({ shape:'sunburst', glyph:'star', palette:'gold', ribbon:false }, 58)}</div><div class="stat-lbl">Colaborador destacado</div></div>
    </div>
    ${unicos.length > 0 ? `<div class="section-hd">Méritos obtenidos</div><div class="badges">${badgesHTML}</div>` : ''}
    <div class="merito">"Por medio de la presente se hace constar que <strong>${esc(nombreCompleto)}</strong>${cargo ? `, en el cargo de ${esc(cargo)},` : ''} ha demostrado un desempeño sobresaliente y ha sido acreedor/a de ${totalRecon} reconocimiento${totalRecon !== 1 ? 's' : ''} en ${unicos.length} categoría${unicos.length !== 1 ? 's' : ''} diferentes. Su dedicación, actitud y compromiso son un ejemplo para el equipo de ${esc(labCompleto)}."</div>
    <div class="footer">
      <div class="firma">
        <div style="font-size:13.5px;font-weight:700;color:#0B4F4F;">${esc(adminNombre)}</div>
        <div class="firma-line" style="margin-top:8px;"></div>
        <div class="firma-lbl">Autorizado y emitido por</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;color:#b2dede;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Fecha de emisión</div>
        <div style="font-size:12.5px;color:#6B9898;font-weight:600;">${hoy}</div>
      </div>
    </div>
  </div>
</div>
</body></html>`;
}

async function mostrarCertificado({ empleado, reconocimientos, fotoUrl, orgNombre, logoBase64, adminNombre, sedeName }) {
  const nombreCompleto = `${empleado.nombre || ''} ${empleado.apellido || ''}`.trim();
  const cargo   = empleado.cargos?.nombre || '';
  const sede    = sedeName || empleado.sedes?.nombre || '';
  const ingreso = empleado.fecha_ingreso
    ? new Date(empleado.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-GT', { day:'numeric', month:'long', year:'numeric' })
    : '';
  const hoy = new Date().toLocaleDateString('es-GT', { day:'numeric', month:'long', year:'numeric' });
  const labCompleto = sede ? `Laboratorio Clínico Ángeles — ${sede}` : (orgNombre || 'Laboratorio Clínico Ángeles');

  const vistos = new Set();
  const unicos = reconocimientos.filter(r => { if (vistos.has(r.asunto)) return false; vistos.add(r.asunto); return true; });
  const conteo = {};
  reconocimientos.forEach(r => { conteo[r.asunto] = (conteo[r.asunto] || 0) + 1; });

  const fotoBase64  = fotoUrl ? await toBase64(fotoUrl) : null;
  const inicialFoto = (nombreCompleto[0] || '').toUpperCase();

  const html = buildCertHTML({
    nombreCompleto, cargo, sede, ingreso, hoy, orgNombre,
    fotoBase64, inicialFoto, unicos, conteo, totalRecon: reconocimientos.length,
    logoBase64, adminNombre, labCompleto,
  });

  document.getElementById('__cert_overlay__')?.remove();
  const overlay = document.createElement('div');
  overlay.id = '__cert_overlay__';
  Object.assign(overlay.style, { position:'fixed', inset:'0', zIndex:'9998', display:'flex', flexDirection:'column', background:'#0B4F4F' });

  const toolbar = document.createElement('div');
  Object.assign(toolbar.style, { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 20px', background:'#0B4F4F', flexShrink:'0' });
  toolbar.innerHTML = `
    <span style="color:#fff;font-size:14px;font-weight:700;">Vista previa — Certificado de Reconocimientos</span>
    <div style="display:flex;gap:10px;">
      <button id="__cert_print__" style="background:#2BBFBE;color:#fff;border:none;border-radius:8px;padding:8px 20px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;">🖨️ &nbsp;Imprimir / Guardar PDF</button>
      <button id="__cert_close__" style="background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.25);border-radius:8px;padding:8px 16px;font-size:13.5px;cursor:pointer;font-family:inherit;">✕ &nbsp;Cerrar</button>
    </div>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'flex:1;border:none;width:100%;background:#e8f4f4;';
  iframe.setAttribute('sandbox', 'allow-same-origin');
  overlay.appendChild(toolbar);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
  toolbar.querySelector('#__cert_close__').onclick = () => overlay.remove();
  toolbar.querySelector('#__cert_print__').onclick = () => iframe.contentWindow?.print();
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
}

/* ── generador de HTML ──────────────────────────────────────── */
function buildFichaHTML({ empleado, docs, vacaciones, acciones, saldo, logoB64, fotoB64, labCompleto, adminNombre }) {
  const nombre   = `${empleado.nombre || ''} ${empleado.apellido || ''}`.trim();
  const cargo    = empleado.cargos?.nombre || '';
  const sede     = empleado.sedes?.nombre  || '';
  const ingreso  = fmtFecha(empleado.fecha_ingreso);
  const hoy      = new Date().toLocaleDateString('es-GT', { day:'numeric', month:'long', year:'numeric' });

  const inicial  = (nombre[0] || '').toUpperCase();
  const fotoTag  = fotoB64
    ? `<img src="${fotoB64}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.5);flex-shrink:0;"/>`
    : `<div style="width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.18);border:3px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:800;color:#fff;flex-shrink:0;">${inicial}</div>`;

  // Documentos
  const docsMap = {};
  docs.forEach(d => { docsMap[d.tipo] = d; });
  const docsCompletos = DOCS_REQ.filter(r => docsMap[r.value]).length;
  const docsHTML = DOCS_REQ.map(r => {
    const d = docsMap[r.value];
    return `<div style="display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:8px;background:${d ? '#F0FDF4' : '#FFF7ED'};border:1px solid ${d ? '#BBF7D0' : '#FED7AA'};">
      <div style="width:22px;height:22px;border-radius:50%;background:${d ? '#16A34A' : '#D97706'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          ${d ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}
        </svg>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12.5px;font-weight:600;color:${d ? '#15803D' : '#92400E'};">${esc(r.label)}</div>
        ${d ? `<div style="font-size:10.5px;color:#6B7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(d.nombre_archivo)}</div>` : '<div style="font-size:10.5px;color:#92400E;">Pendiente</div>'}
      </div>
    </div>`;
  }).join('');

  // Vacaciones
  const saldoHTML = saldo ? `
    <div style="display:flex;gap:12px;margin-bottom:16px;">
      <div style="flex:1;text-align:center;background:#F0FFFE;border:1.5px solid #B2E8E8;border-radius:10px;padding:12px 8px;">
        <div style="font-size:24px;font-weight:800;color:#2BBFBE;">${saldo.dias_anuales ?? '—'}</div>
        <div style="font-size:11px;color:#436B6B;">Días al año</div>
      </div>
      <div style="flex:1;text-align:center;background:#FEF3C7;border:1.5px solid #FDE68A;border-radius:10px;padding:12px 8px;">
        <div style="font-size:24px;font-weight:800;color:#B45309;">${saldo.dias_tomados ?? 0}</div>
        <div style="font-size:11px;color:#92400E;">Tomados</div>
      </div>
      <div style="flex:1;text-align:center;background:#DCFCE7;border:1.5px solid #BBF7D0;border-radius:10px;padding:12px 8px;">
        <div style="font-size:24px;font-weight:800;color:#16A34A;">${saldo.dias_disponibles ?? '—'}</div>
        <div style="font-size:11px;color:#15803D;">Disponibles</div>
      </div>
    </div>` : '';

  const vacRows = vacaciones.slice(0, 20).map(v => {
    const est = VACACACIONES_ESTADO[v.estado] || VACACACIONES_ESTADO.solicitado;
    return `<tr style="border-bottom:1px solid #E5F0F0;">
      <td style="padding:7px 10px;font-size:12px;color:#1E3A3A;">${esc(fmtFecha(v.fecha_inicio, {day:'numeric',month:'short',year:'numeric'}))} → ${esc(fmtFecha(v.fecha_fin, {day:'numeric',month:'short',year:'numeric'}))}</td>
      <td style="padding:7px 10px;text-align:center;font-size:12px;color:#436B6B;">${v.dias_habiles ?? '—'}</td>
      <td style="padding:7px 10px;">
        <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${est.bg};color:${est.c};font-weight:600;">${est.txt}</span>
      </td>
      ${v.nota_aprobacion ? `<td style="padding:7px 10px;font-size:11px;color:#6B7280;">${esc(v.nota_aprobacion)}</td>` : '<td></td>'}
    </tr>`;
  }).join('');

  // Solo acciones disciplinarias — sin reconocimientos
  const discipl    = acciones.filter(a => a.tipo !== 'reconocimiento');
  const accionesHTML = discipl.map(a => {
    const info = TIPO_INFO[a.tipo] || { txt: a.tipo, c:'#6B7280', bg:'#F3F4F6' };
    const iconPath = a.tipo === 'suspension'
      ? '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>'
      : a.tipo === 'amonestacion_escrita'
        ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
        : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>';
    return `<div style="display:flex;gap:14px;align-items:flex-start;padding:12px;border-radius:10px;border:1px solid #E5E7EB;background:#FAFAFA;margin-bottom:8px;">
      <div style="width:42px;height:42px;border-radius:50%;background:${info.bg};border:2px solid ${info.c}33;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${info.c}" stroke-width="2" stroke-linecap="round">${iconPath}</svg>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
          <span style="font-size:11px;padding:1px 8px;border-radius:999px;background:${info.bg};color:${info.c};font-weight:600;">${esc(info.txt)}</span>
          <span style="font-size:11px;color:#9CA3AF;">${esc(fmtFecha(a.fecha, {day:'numeric',month:'short',year:'numeric'}))}</span>
        </div>
        <div style="font-weight:700;font-size:13.5px;color:#1E3A3A;">${esc(a.asunto)}</div>
        ${a.descripcion ? `<div style="font-size:12px;color:#436B6B;margin-top:3px;line-height:1.5;">${esc(a.descripcion)}</div>` : ''}
        ${a.acuse_recibo ? `<div style="font-size:11px;color:#16A34A;margin-top:4px;">
          ✓ Acuse registrado ${a.fecha_acuse ? fmtFecha(a.fecha_acuse, {day:'numeric',month:'short',year:'numeric'}) : ''}
        </div>` : '<div style="font-size:11px;color:#B45309;margin-top:4px;">Pendiente de acuse</div>'}
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Ficha de Empleado — ${esc(nombre)}</title>
<style>
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html, body { background:#E8F4F4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; color:#1a2a2a; }
  .page { width:794px; margin:24px auto; background:#fff; border-radius:16px; box-shadow:0 8px 40px rgba(0,0,0,0.15); overflow:hidden; }
  .header { background:linear-gradient(135deg,#2BBFBE 0%,#0a7070 100%); -webkit-print-color-adjust:exact; print-color-adjust:exact; padding:32px 40px; display:flex; align-items:center; gap:28px; color:#fff; }
  .header-info { flex:1; }
  .logo-row { display:flex; align-items:center; gap:10px; margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.2); }
  .logo-name { font-size:17px; font-weight:800; color:#fff; letter-spacing:-.02em; line-height:1.1; }
  .logo-sub  { font-size:9px; color:rgba(255,255,255,0.5); letter-spacing:.1em; text-transform:uppercase; margin-top:2px; }
  .org-lbl { font-size:9.5px; letter-spacing:.15em; text-transform:uppercase; opacity:.65; margin-bottom:4px; }
  .doc-tipo { font-size:11px; font-weight:700; background:rgba(255,255,255,0.15); padding:3px 10px; border-radius:20px; display:inline-block; margin-bottom:8px; }
  .emp-nombre { font-size:26px; font-weight:800; letter-spacing:-.03em; line-height:1.1; margin-bottom:4px; }
  .emp-sub { font-size:13px; opacity:.82; }
  .emp-meta { font-size:11.5px; opacity:.62; margin-top:3px; }
  .body { padding:30px 40px 40px; }
  .section { margin-bottom:26px; }
  .section-hd { font-size:10px; font-weight:700; color:#9AB8B8; text-transform:uppercase; letter-spacing:.12em; margin-bottom:12px; padding-bottom:8px; border-bottom:1.5px solid #E0F0F0; }
  .data-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 20px; }
  .data-item { display:flex; flex-direction:column; }
  .data-lbl { font-size:10px; color:#9AB8B8; text-transform:uppercase; letter-spacing:.08em; margin-bottom:2px; }
  .data-val { font-size:13px; color:#1E3A3A; font-weight:500; }
  .docs-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .vac-table { width:100%; border-collapse:collapse; font-size:12.5px; }
  .vac-table th { text-align:left; padding:7px 10px; font-size:10px; font-weight:700; color:#9AB8B8; text-transform:uppercase; letter-spacing:.08em; border-bottom:2px solid #E0F0F0; }
  .footer { border-top:1px solid #D8ECEC; padding-top:20px; margin-top:8px; display:flex; justify-content:space-between; align-items:flex-end; }
  .firma-line { width:160px; height:1px; background:#2BBFBE; margin:8px 0 6px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .firma-lbl { font-size:11px; color:#9AB8B8; }
  @media print { html, body { background:#fff; } .page { margin:0; border-radius:0; box-shadow:none; width:100%; } }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    ${fotoTag}
    <div class="header-info">
      ${logoB64 ? `
      <div class="logo-row">
        <img src="${logoB64}" style="height:36px;width:auto;filter:brightness(0) invert(1);opacity:.9;" />
        <div><div class="logo-name">Los Ángeles</div><div class="logo-sub">Mucho más que un diagnóstico</div></div>
      </div>` : ''}
      <div class="org-lbl">${esc(labCompleto)}</div>
      <div class="doc-tipo">Ficha de Colaborador</div>
      <div class="emp-nombre">${esc(nombre)}</div>
      ${cargo  ? `<div class="emp-sub">${esc(cargo)}</div>` : ''}
      ${sede   ? `<div class="emp-meta">📍 ${esc(sede)}</div>` : ''}
      ${ingreso !== '—' ? `<div class="emp-meta">Colaborador desde: ${esc(ingreso)}</div>` : ''}
    </div>
  </div>

  <div class="body">

    <!-- DATOS PERSONALES -->
    <div class="section">
      <div class="section-hd">Datos personales</div>
      <div class="data-grid">
        ${empleado.dpi       ? `<div class="data-item"><span class="data-lbl">DPI</span><span class="data-val">${esc(empleado.dpi)}</span></div>` : ''}
        ${empleado.nit       ? `<div class="data-item"><span class="data-lbl">NIT</span><span class="data-val">${esc(empleado.nit)}</span></div>` : ''}
        ${empleado.numero_igss ? `<div class="data-item"><span class="data-lbl">No. IGSS</span><span class="data-val">${esc(empleado.numero_igss)}</span></div>` : ''}
        ${empleado.fecha_nacimiento ? `<div class="data-item"><span class="data-lbl">Fecha nacimiento</span><span class="data-val">${esc(fmtFecha(empleado.fecha_nacimiento))}</span></div>` : ''}
        ${empleado.sexo      ? `<div class="data-item"><span class="data-lbl">Sexo</span><span class="data-val">${empleado.sexo === 'M' ? 'Masculino' : 'Femenino'}</span></div>` : ''}
        ${empleado.estado_civil ? `<div class="data-item"><span class="data-lbl">Estado civil</span><span class="data-val" style="text-transform:capitalize;">${esc(empleado.estado_civil)}</span></div>` : ''}
        ${empleado.telefono  ? `<div class="data-item"><span class="data-lbl">Teléfono</span><span class="data-val">${esc(empleado.telefono)}</span></div>` : ''}
        ${empleado.correo    ? `<div class="data-item"><span class="data-lbl">Correo</span><span class="data-val">${esc(empleado.correo)}</span></div>` : ''}
        ${empleado.direccion ? `<div class="data-item" style="grid-column:span 2"><span class="data-lbl">Dirección</span><span class="data-val">${esc(empleado.direccion)}${empleado.municipio ? `, ${esc(empleado.municipio)}` : ''}${empleado.departamento_residencia ? `, ${esc(empleado.departamento_residencia)}` : ''}</span></div>` : ''}
        ${empleado.emergencia_nombre ? `<div class="data-item" style="grid-column:span 2"><span class="data-lbl">Contacto de emergencia</span><span class="data-val">${esc(empleado.emergencia_nombre)}${empleado.emergencia_parentesco ? ` (${esc(empleado.emergencia_parentesco)})` : ''} · ${esc(empleado.emergencia_telefono || '—')}</span></div>` : ''}
      </div>
    </div>

    <!-- DOCUMENTOS -->
    <div class="section">
      <div class="section-hd">Documentos del expediente · ${docsCompletos}/${DOCS_REQ.length} cargados</div>
      <div class="docs-grid">${docsHTML}</div>
    </div>

    <!-- VACACIONES -->
    <div class="section">
      <div class="section-hd">Vacaciones y permisos</div>
      ${saldoHTML}
      ${vacaciones.length > 0 ? `
      <table class="vac-table">
        <thead><tr>
          <th>Período</th><th>Días hábiles</th><th>Estado</th><th>Nota</th>
        </tr></thead>
        <tbody>${vacRows}</tbody>
      </table>` : '<div style="font-size:13px;color:#9AB8B8;padding:8px 0;">Sin solicitudes registradas.</div>'}
    </div>

    <!-- ACCIONES DISCIPLINARIAS -->
    <div class="section">
      <div class="section-hd">Historial disciplinario (${discipl.length})</div>
      ${discipl.length > 0 ? accionesHTML : '<div style="font-size:13px;color:#9AB8B8;padding:8px 0;">Sin acciones disciplinarias registradas.</div>'}
    </div>

    <div class="footer">
      <div>
        <div style="font-size:13.5px;font-weight:700;color:#0B4F4F;">${esc(adminNombre)}</div>
        <div class="firma-line"></div>
        <div class="firma-lbl">Generado por</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;color:#B2DEDE;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Fecha de emisión</div>
        <div style="font-size:12.5px;color:#6B9898;font-weight:600;">${hoy}</div>
      </div>
    </div>

  </div>
</div>
</body>
</html>`;
}

function mostrarFicha(html) {
  document.getElementById('__ficha_overlay__')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '__ficha_overlay__';
  Object.assign(overlay.style, {
    position:'fixed', inset:'0', zIndex:'9999',
    display:'flex', flexDirection:'column', background:'#0B4F4F',
  });

  const toolbar = document.createElement('div');
  Object.assign(toolbar.style, {
    display:'flex', justifyContent:'space-between', alignItems:'center',
    padding:'10px 20px', background:'#0B4F4F', flexShrink:'0',
  });
  toolbar.innerHTML = `
    <span style="color:#fff;font-size:14px;font-weight:700;">Vista previa — Ficha de Empleado</span>
    <div style="display:flex;gap:10px;">
      <button id="__ficha_print__"
        style="background:#2BBFBE;color:#fff;border:none;border-radius:8px;
               padding:8px 20px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;">
        🖨️ &nbsp;Imprimir / Guardar PDF
      </button>
      <button id="__ficha_close__"
        style="background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.25);
               border-radius:8px;padding:8px 16px;font-size:13.5px;cursor:pointer;font-family:inherit;">
        ✕ &nbsp;Cerrar
      </button>
    </div>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'flex:1;border:none;width:100%;background:#E8F4F4;';
  iframe.setAttribute('sandbox', 'allow-same-origin');

  overlay.appendChild(toolbar);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);

  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();

  overlay.querySelector('#__ficha_print__').onclick = () => iframe.contentWindow.print();
  overlay.querySelector('#__ficha_close__').onclick  = () => overlay.remove();
}

/* ── componente principal ────────────────────────────────────── */
export default function ExpedienteAdminTab() {
  const { profile } = useAuth();
  const [empleados, setEmpleados] = useState([]);
  const [selId,     setSelId]     = useState('');
  const [empleado,  setEmpleado]  = useState(null);
  const [docs,      setDocs]      = useState([]);
  const [vacas,     setVacas]     = useState([]);
  const [acciones,  setAcciones]  = useState([]);
  const [saldo,     setSaldo]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [exportando,    setExportando]    = useState(false);
  const [exportandoCert,setExportandoCert] = useState(false);
  const [seccion,   setSeccion]   = useState('perfil'); // perfil | docs | vacas | historial

  useEffect(() => { document.getElementById('__ficha_overlay__')?.remove(); }, []);

  /* cargar lista de empleados */
  useEffect(() => {
    if (!profile?.organizacion_id) return;
    supabase.from('empleados')
      .select('id, nombre, apellido, cargos(nombre), sedes(nombre)')
      .eq('organizacion_id', profile.organizacion_id)
      .eq('activo', true)
      .order('apellido')
      .then(({ data }) => setEmpleados(data || []));
  }, [profile?.organizacion_id]);

  /* cargar datos del empleado seleccionado */
  const cargar = useCallback(async () => {
    if (!selId) { setEmpleado(null); return; }
    setLoading(true); setLoadError(null);
    try {
      const [emp, docsRes, vacRes, acRes, saldoRes] = await Promise.all([
        supabase.from('empleados').select('*, cargos(nombre), sedes(nombre)').eq('id', selId).maybeSingle(),
        supabase.from('empleado_documentos').select('*').eq('empleado_id', selId).order('created_at', { ascending: false }),
        supabase.from('vacaciones_permisos').select('*').eq('empleado_id', selId).order('fecha_inicio', { ascending: false }),
        supabase.from('acciones_disciplinarias').select('*').eq('empleado_id', selId).order('fecha', { ascending: false }),
        supabase.from('v_saldo_vacaciones').select('*').eq('empleado_id', selId).maybeSingle(),
      ]);
      if (emp.error) throw emp.error;
      if (docsRes.error) throw docsRes.error;
      if (vacRes.error) throw vacRes.error;
      if (acRes.error) throw acRes.error;
      setEmpleado(emp.data || null);
      setDocs(docsRes.data || []);
      setVacas(vacRes.data || []);
      setAcciones(acRes.data || []);
      setSaldo(saldoRes.data || null);
    } catch {
      setLoadError('Error al cargar el expediente. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [selId]);

  useEffect(() => { cargar(); }, [cargar]);

  const exportarFicha = async () => {
    if (!empleado) return;
    setExportando(true);
    try {
      const [{ data: org }, logoB64, fotoB64] = await Promise.all([
        supabase.from('organizaciones').select('nombre').eq('id', profile.organizacion_id).maybeSingle(),
        toBase64(logoUrl).catch(() => null),
        empleado.foto_path
          ? urlFirmada('rrhh-fotos', empleado.foto_path).then(u => u ? toBase64(u) : null).catch(() => null)
          : Promise.resolve(null),
      ]);
      const sede     = empleado.sedes?.nombre || '';
      const labCompleto = sede ? `Laboratorio Clínico Ángeles — ${sede}` : (org?.nombre || 'Laboratorio Clínico Ángeles');
      const html = buildFichaHTML({
        empleado, docs, vacaciones: vacas, acciones, saldo,
        logoB64, fotoB64, labCompleto, adminNombre: profile.nombre || 'Administrador',
      });
      mostrarFicha(html);
    } finally {
      setExportando(false);
    }
  };

  const exportarCertificado = async () => {
    if (!empleado) return;
    const recons = acciones.filter(a => a.tipo === 'reconocimiento');
    if (recons.length === 0) return;
    setExportandoCert(true);
    try {
      const [{ data: org }, logoB64, fotoUrl] = await Promise.all([
        supabase.from('organizaciones').select('nombre').eq('id', profile.organizacion_id).maybeSingle(),
        toBase64(logoUrl).catch(() => null),
        empleado.foto_path ? urlFirmada('rrhh-fotos', empleado.foto_path).catch(() => null) : Promise.resolve(null),
      ]);
      await mostrarCertificado({
        empleado,
        reconocimientos: recons,
        fotoUrl,
        orgNombre: org?.nombre || 'Laboratorio',
        logoBase64: logoB64,
        adminNombre: profile.nombre || 'Administrador',
        sedeName: empleado.sedes?.nombre || '',
      });
    } finally {
      setExportandoCert(false);
    }
  };

  const abrirDoc = async (doc) => {
    const url = await urlFirmada('rrhh-documentos', doc.storage_path);
    if (url) window.open(url, '_blank');
  };

  const empOpciones = [
    { value: '', label: 'Selecciona un empleado…' },
    ...empleados.map(e => ({
      value: e.id,
      label: `${e.apellido}, ${e.nombre}${e.cargos?.nombre ? ` — ${e.cargos.nombre}` : ''}${e.sedes?.nombre ? ` · ${e.sedes.nombre}` : ''}`,
    })),
  ];

  const docsMap = {};
  docs.forEach(d => { docsMap[d.tipo] = d; });
  const docsCompletos = DOCS_REQ.filter(r => docsMap[r.value]).length;
  const discipl = acciones.filter(a => a.tipo !== 'reconocimiento');

  const SECCIONES = [
    { id:'perfil',    label:'Perfil' },
    { id:'docs',      label:`Documentos ${selId ? `(${docsCompletos}/${DOCS_REQ.length})` : ''}` },
    { id:'vacas',     label:`Vacaciones ${selId && saldo ? `(${saldo.dias_disponibles ?? '?'} disp.)` : ''}` },
    { id:'historial', label:`Disciplina (${discipl.length})` },
  ];

  return (
    <div style={{ display:'grid', gap:16, maxWidth:900 }}>

      {/* Selector + export */}
      <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:280 }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.lo, textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:6 }}>
            Seleccionar empleado
          </div>
          <TSelect value={selId} onChange={e => { setSelId(e.target.value); setSeccion('perfil'); }} options={empOpciones} />
        </div>
        {empleado && (
          <div style={{ display:'flex', gap:8 }}>
            <Btn onClick={exportarFicha} disabled={exportando} icon={<Ico.Download s={14}/>}>
              {exportando ? 'Generando…' : 'Exportar ficha PDF'}
            </Btn>
            <Btn
              variant="secondary"
              onClick={exportarCertificado}
              disabled={exportandoCert || acciones.filter(a => a.tipo === 'reconocimiento').length === 0}
              icon={<Ico.Check s={14}/>}
              title={acciones.filter(a => a.tipo === 'reconocimiento').length === 0 ? 'Este empleado no tiene reconocimientos' : ''}
            >
              {exportandoCert ? 'Generando…' : 'Certificado de reconocimientos'}
            </Btn>
          </div>
        )}
      </div>

      {loading && <div style={{ color:T.lo, padding:16 }}>Cargando expediente…</div>}

      {!loading && loadError && (
        <div style={{ background:'#FEE2E2', border:'1px solid #FECACA', borderRadius:10,
          padding:'12px 16px', color:'#991B1B', fontSize:13, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          {loadError}
          <button onClick={cargar} style={{ background:'none', border:'none', cursor:'pointer',
            color:'#991B1B', fontWeight:700, fontSize:13 }}>Reintentar</button>
        </div>
      )}

      {!loading && empleado && (
        <>
          {/* Tarjeta resumen empleado */}
          <div style={{ background:`linear-gradient(135deg, ${T.tealXL} 0%, ${T.surface} 100%)`, border:`1px solid ${T.teal}44`, borderRadius:12, padding:'16px 20px', display:'flex', gap:16, alignItems:'center' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:T.teal+'22', border:`2px solid ${T.teal}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:20, fontWeight:800, color:T.tealDk }}>
              {(empleado.nombre?.[0] || '').toUpperCase()}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, color:T.hi, fontSize:15 }}>{empleado.nombre} {empleado.apellido}</div>
              <div style={{ color:T.lo, fontSize:13 }}>{empleado.cargos?.nombre || '—'} · {empleado.sedes?.nombre || '—'}</div>
            </div>
            <div style={{ display:'flex', gap:20, textAlign:'center' }}>
              <div><div style={{ fontWeight:700, color:T.tealDk, fontSize:17 }}>{docsCompletos}/{DOCS_REQ.length}</div><div style={{ fontSize:11, color:T.lo }}>Docs</div></div>
              <div><div style={{ fontWeight:700, color:'#B45309', fontSize:17 }}>{discipl.length}</div><div style={{ fontSize:11, color:T.lo }}>Disciplinarias</div></div>
              <div><div style={{ fontWeight:700, color:'#1D4ED8', fontSize:17 }}>{saldo?.dias_disponibles ?? '—'}</div><div style={{ fontSize:11, color:T.lo }}>Días vac.</div></div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{ display:'flex', gap:2, borderBottom:`1px solid ${T.border}` }}>
            {SECCIONES.map(s => (
              <button key={s.id} onClick={() => setSeccion(s.id)} style={{
                padding:'8px 14px', border:'none', background:'none', cursor:'pointer',
                fontFamily:'inherit', fontSize:13,
                color: seccion === s.id ? T.tealDk : T.mid,
                borderBottom: seccion === s.id ? `2px solid ${T.teal}` : '2px solid transparent',
                fontWeight: seccion === s.id ? 700 : 500, marginBottom:-1,
              }}>{s.label}</button>
            ))}
          </div>

          {/* ── PERFIL ── */}
          {seccion === 'perfil' && (
            <div style={{ display:'grid', gap:10 }}>
              {[
                { l:'DPI', v:empleado.dpi }, { l:'NIT', v:empleado.nit },
                { l:'No. IGSS', v:empleado.numero_igss }, { l:'Fecha nacimiento', v:fmtFecha(empleado.fecha_nacimiento) },
                { l:'Sexo', v:empleado.sexo === 'M' ? 'Masculino' : empleado.sexo === 'F' ? 'Femenino' : null },
                { l:'Estado civil', v:empleado.estado_civil },
                { l:'Teléfono', v:empleado.telefono }, { l:'Correo', v:empleado.correo },
                { l:'Dirección', v:[empleado.direccion, empleado.municipio, empleado.departamento_residencia].filter(Boolean).join(', ') || null },
                { l:'Ingreso', v:fmtFecha(empleado.fecha_ingreso) },
              ].filter(x => x.v).map(x => (
                <div key={x.l} style={{ display:'flex', gap:12, padding:'8px 14px', background:T.surface, border:`1px solid ${T.border}`, borderRadius:8 }}>
                  <span style={{ color:T.lo, fontSize:12.5, width:140, flexShrink:0 }}>{x.l}</span>
                  <span style={{ color:T.hi, fontSize:13, fontWeight:500 }}>{x.v}</span>
                </div>
              ))}
              {(empleado.emergencia_nombre || empleado.emergencia_telefono) && (
                <div style={{ padding:'12px 14px', background:T.surface, border:`1px solid ${T.border}`, borderRadius:8 }}>
                  <div style={{ fontSize:11, color:T.lo, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Contacto de emergencia</div>
                  <div style={{ color:T.hi, fontSize:13, fontWeight:500 }}>
                    {empleado.emergencia_nombre}{empleado.emergencia_parentesco ? ` (${empleado.emergencia_parentesco})` : ''}{empleado.emergencia_telefono ? ` · ${empleado.emergencia_telefono}` : ''}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DOCUMENTOS ── */}
          {seccion === 'docs' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:10 }}>
              {DOCS_REQ.map(tipo => {
                const d = docsMap[tipo.value];
                return (
                  <div key={tipo.value} style={{ background:T.surface, border:`1px solid ${d ? T.ok : T.border}`, borderRadius:10, padding:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div>
                        <div style={{ fontWeight:600, color:T.hi, fontSize:13.5 }}>{tipo.label}</div>
                        {d && <div style={{ color:T.lo, fontSize:11.5, marginTop:2, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.nombre_archivo}</div>}
                      </div>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:d ? T.okBg : T.warnBg, color:d ? T.ok : T.warn, whiteSpace:'nowrap' }}>
                        {d ? '✓ Cargado' : 'Pendiente'}
                      </span>
                    </div>
                    {d && (
                      <Btn variant="secondary" size="sm" icon={<Ico.Download s={12}/>} onClick={() => abrirDoc(d)}>
                        Abrir / Descargar
                      </Btn>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── VACACIONES ── */}
          {seccion === 'vacas' && (
            <div style={{ display:'grid', gap:12 }}>
              {saldo && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
                  {[
                    { l:'Días al año', v:saldo.dias_anuales ?? '—', c:T.teal },
                    { l:'Días tomados', v:saldo.dias_tomados ?? 0, c:'#B45309' },
                    { l:'Días disponibles', v:saldo.dias_disponibles ?? '—', c:'#16A34A' },
                  ].map(x => (
                    <div key={x.l} style={{ textAlign:'center', background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:14 }}>
                      <div style={{ fontSize:28, fontWeight:800, color:x.c }}>{x.v}</div>
                      <div style={{ fontSize:12, color:T.lo, marginTop:3 }}>{x.l}</div>
                    </div>
                  ))}
                </div>
              )}
              {vacas.length === 0
                ? <div style={{ color:T.lo, padding:12 }}>Sin solicitudes de vacaciones.</div>
                : vacas.map(v => {
                    const est = VACACACIONES_ESTADO[v.estado] || VACACACIONES_ESTADO.solicitado;
                    return (
                      <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:T.surface, border:`1px solid ${T.border}`, borderRadius:8 }}>
                        <div>
                          <div style={{ color:T.hi, fontSize:13.5, fontWeight:500 }}>
                            {fmtFecha(v.fecha_inicio, {day:'numeric',month:'short',year:'numeric'})} → {fmtFecha(v.fecha_fin, {day:'numeric',month:'short',year:'numeric'})} · <b>{v.dias_habiles}</b> día(s)
                          </div>
                          {v.nota_aprobacion && <div style={{ color:T.lo, fontSize:12, marginTop:2 }}>Nota: {v.nota_aprobacion}</div>}
                        </div>
                        <span style={{ fontSize:12, padding:'3px 10px', borderRadius:999, background:est.bg, color:est.c, fontWeight:600 }}>{est.txt}</span>
                      </div>
                    );
                  })
              }
            </div>
          )}

          {/* ── DISCIPLINA ── */}
          {seccion === 'historial' && (
            <div style={{ display:'grid', gap:10 }}>
              {discipl.length === 0
                ? <div style={{ color:T.lo, padding:12 }}>Sin acciones disciplinarias registradas.</div>
                : discipl.map(a => {
                    const info = TIPO_INFO[a.tipo] || { txt:a.tipo, c:T.mid, bg:T.canvas };
                    return (
                      <div key={a.id} style={{ display:'flex', gap:14, alignItems:'flex-start', padding:14, background:T.surface, border:`1px solid ${T.border}`, borderRadius:10 }}>
                        <div style={{ width:42, height:42, borderRadius:'50%', background:info.bg, border:`2px solid ${info.c}33`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={info.c} strokeWidth={2} strokeLinecap="round">
                            {a.tipo === 'suspension'
                              ? <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>
                              : a.tipo === 'amonestacion_escrita'
                                ? <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
                                : <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>
                            }
                          </svg>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background:info.bg, color:info.c, fontWeight:600 }}>{info.txt}</span>
                            <span style={{ fontSize:12, color:T.lo }}>{fmtFecha(a.fecha, {day:'numeric',month:'short',year:'numeric'})}</span>
                          </div>
                          <div style={{ fontWeight:700, color:T.hi, fontSize:14 }}>{a.asunto}</div>
                          {a.descripcion && <div style={{ color:T.mid, fontSize:13, marginTop:3 }}>{a.descripcion}</div>}
                          {a.acuse_recibo
                            ? <div style={{ fontSize:12, color:'#16A34A', marginTop:5, display:'flex', gap:5, alignItems:'center' }}>
                                <Ico.Check s={12}/> Acuse registrado {a.fecha_acuse ? fmtFecha(a.fecha_acuse, {day:'numeric',month:'short',year:'numeric'}) : ''}
                              </div>
                            : <div style={{ fontSize:12, color:'#B45309', marginTop:5 }}>Pendiente de acuse</div>
                          }
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          )}
        </>
      )}

      {!loading && !empleado && selId && (
        <div style={{ color:T.lo, padding:24 }}>No se encontró el expediente.</div>
      )}
    </div>
  );
}
