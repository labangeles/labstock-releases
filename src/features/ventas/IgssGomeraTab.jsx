import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { T, Btn, fmtQ, Modal, Field, TInput, TSelect } from '../../shared/ui';
import { useAuth } from '../../contexts/AuthContext';
import { parseDTE } from './lib/parseDTE';

const ESTADO_CFG = {
  pendiente:     { bg: '#FEF9C3', color: '#92400E', label: 'Pendiente' },
  pagada:        { bg: '#D1FAE5', color: '#065F46', label: 'Pagada' },
  en_correccion: { bg: '#FEE2E2', color: '#991B1B', label: 'En corrección' },
  anulada:       { bg: '#F3F4F6', color: '#6B7280', label: 'Anulada' },
};

function fmtFecha(d) {
  if (!d) return '—';
  const [y, m, dia] = d.split('-');
  return `${dia}/${m}/${y}`;
}

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.pendiente;
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontSize: 11.5, fontWeight: 700,
      borderRadius: 6, padding: '3px 9px', whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

/* ── Extrae líneas de detalle del XML DTE almacenado ── */
function parsearItems(xmlRaw) {
  if (!xmlRaw) return [];
  try {
    const doc = new DOMParser().parseFromString(xmlRaw, 'application/xml');
    const byName = (parent, name) =>
      parent.getElementsByTagName(name)[0] || parent.getElementsByTagName(`dte:${name}`)[0];
    const txt = (el, name) => byName(el, name)?.textContent?.trim() || '';
    const allItems = [
      ...Array.from(doc.getElementsByTagName('Item')),
      ...Array.from(doc.getElementsByTagName('dte:Item')),
    ];
    return allItems.map(el => ({
      linea:         el.getAttribute('NumeroLinea') || '',
      tipo:          el.getAttribute('BienOrServicio') === 'B' ? 'Bien' : 'Servicio',
      cantidad:      txt(el, 'Cantidad'),
      unidad:        txt(el, 'UnidadMedida'),
      descripcion:   txt(el, 'Descripcion'),
      precioUnit:    parseFloat(txt(el, 'PrecioUnitario') || '0'),
      descuento:     parseFloat(txt(el, 'Descuento') || '0'),
      total:         parseFloat(txt(el, 'Total') || '0'),
    }));
  } catch { return []; }
}

/* ── Fila de factura parseada (preview antes de guardar) ─── */
function FilaPreview({ item, onRemove }) {
  const ok = !item.error;
  return (
    <tr style={{ borderBottom: `1px solid ${T.border}`, background: ok ? T.surface : '#FEF2F2' }}>
      <td style={{ padding: '8px 12px', fontSize: 12, color: T.mid }}>{item.archivo}</td>
      {ok ? (
        <>
          <td style={{ padding: '8px 12px', fontSize: 12, color: T.mid }}>{item.serie}-{item.numero_factura}</td>
          <td style={{ padding: '8px 12px', fontSize: 12, color: T.mid }}>{fmtFecha(item.fecha_emision)}</td>
          <td style={{ padding: '8px 12px', fontSize: 12, color: T.hi, textAlign: 'right' }}>{fmtQ(item.monto_total)}</td>
          <td style={{ padding: '8px 12px', fontSize: 12, color: '#D97706', textAlign: 'right' }}>{fmtQ(item.retencion_iva)}</td>
          <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: T.ok, textAlign: 'right' }}>{fmtQ(item.pago_esperado)}</td>
        </>
      ) : (
        <td colSpan={5} style={{ padding: '8px 12px', fontSize: 12, color: T.crit }}>
          ⚠️ {item.error}
        </td>
      )}
      <td style={{ padding: '8px 12px' }}>
        <button onClick={() => onRemove(item.archivo)} style={{ background: 'none', border: 'none',
          cursor: 'pointer', color: T.crit, fontSize: 14, padding: '0 4px' }}>✕</button>
      </td>
    </tr>
  );
}

/* ─── IgssGomeraTab ──────────────────────────────────────── */
export default function IgssGomeraTab() {
  const { profile } = useAuth();
  const isSecretaria = profile?.rol === 'secretaria';

  const [facturas,       setFacturas]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [guardando,      setGuardando]      = useState(false);
  const [preview,        setPreview]        = useState([]);
  const [showPrev,       setShowPrev]       = useState(false);
  const [editItem,       setEditItem]       = useState(null);
  const [editForm,       setEditForm]       = useState({});
  const [detailItem,     setDetailItem]     = useState(null);
  const [msg,            setMsg]            = useState('');
  const [loadError,      setLoadError]      = useState('');
  const [editErr,        setEditErr]        = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const fileRef = useRef(null);

  const cargar = useCallback(async () => {
    if (!profile?.organizacion_id) return;
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase.from('ventas_facturas')
      .select('*').eq('organizacion_id', profile.organizacion_id)
      .eq('categoria', 'igss').order('fecha_emision', { ascending: false });
    if (error) setLoadError('Error al cargar las facturas. Intenta de nuevo.');
    else setFacturas(data || []);
    setLoading(false);
  }, [profile?.organizacion_id]);

  useEffect(() => { cargar(); }, [cargar]);

  /* ── Parsear archivos XML seleccionados ── */
  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    fileRef.current.value = '';
    const resultados = await Promise.all(files.map(async (f) => {
      try {
        const texto = await f.text();
        const data  = parseDTE(texto);
        return { ...data, archivo: f.name, xml_raw: texto };
      } catch (err) {
        return { archivo: f.name, error: err.message };
      }
    }));
    setPreview(resultados);
    setShowPrev(true);
  };

  const quitarPreview = (nombre) =>
    setPreview(p => p.filter(x => x.archivo !== nombre));

  /* ── Guardar facturas confirmadas ── */
  const guardar = async () => {
    const validas = preview.filter(p => !p.error);
    if (!validas.length) return;
    setGuardando(true);
    let ok = 0, dup = 0;
    const errores = [];

    for (const item of validas) {
      const { error } = await supabase.from('ventas_facturas').insert({
        organizacion_id: profile.organizacion_id,
        categoria:       'igss',
        uuid_sat:        item.uuid_sat,
        serie:           item.serie,
        numero_factura:  item.numero_factura,
        nit_receptor:    item.nit_receptor,
        nombre_receptor: item.nombre_receptor,
        fecha_emision:   item.fecha_emision,
        subtotal:        item.subtotal,
        iva_monto:       item.iva_monto,
        monto_total:     item.monto_total,
        retencion_iva:   item.retencion_iva,
        pago_esperado:   item.pago_esperado,
        xml_raw:         item.xml_raw,
        estado:          'pendiente',
      });
      if (!error) ok++;
      else if (error.code === '23505') dup++;
      else errores.push(error.message || error.code || 'Error desconocido');
    }

    setGuardando(false);
    setShowPrev(false);
    setPreview([]);

    if (errores.length) {
      setMsg(`❌ Error al guardar: ${errores[0]}`);
      setTimeout(() => setMsg(''), 12000);
      return;
    }
    const partes = [];
    if (ok)  partes.push(`${ok} factura(s) guardada(s)`);
    if (dup) partes.push(`${dup} duplicada(s) ignorada(s)`);
    setMsg(partes.join(' · '));
    setTimeout(() => setMsg(''), 5000);
    cargar();
  };

  /* ── Marcar como pagada con fecha/hora actual ── */
  const marcarPagada = async (f) => {
    const ahora    = new Date();
    const fecha_pago = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`;
    const hora_pago  = ahora.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: true });
    const { error } = await supabase.from('ventas_facturas').update({
      estado:     'pagada',
      fecha_pago,
      notas:      (f.notas ? f.notas + '\n' : '') + `Pagada el ${fecha_pago} a las ${hora_pago}`,
      updated_at: ahora.toISOString(),
    }).eq('id', f.id);
    if (error) { window.alert('Error al marcar como pagada. Intenta de nuevo.'); return; }
    cargar();
  };

  /* ── Eliminar factura ── */
  const eliminar = async (f) => {
    if (!window.confirm(`¿Eliminar la factura ${f.serie}-${f.numero_factura}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('ventas_facturas').delete().eq('id', f.id);
    if (error) { window.alert('Error al eliminar la factura. Intenta de nuevo.'); return; }
    cargar();
  };

  /* ── Abrir edición ── */
  const abrirEditar = (f) => {
    setEditItem(f);
    setEditErr('');
    setEditForm({ estado: f.estado, notas: f.notas || '', fecha_pago: f.fecha_pago || '' });
  };

  const guardarEditar = async () => {
    setEditErr('');
    const { error } = await supabase.from('ventas_facturas').update({
      estado:     editForm.estado,
      notas:      editForm.notas,
      fecha_pago: editForm.fecha_pago || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editItem.id);
    if (error) { setEditErr('Error al guardar. Intenta de nuevo.'); return; }
    setEditItem(null);
    cargar();
  };

  /* ── Filtro por monto de depósito ── */
  const facturasFiltradas = filtroBusqueda.trim()
    ? facturas.filter(f => {
        const q = filtroBusqueda.trim().replace(/[^0-9.]/g, '');
        if (!q) return true;
        return String(Number(f.pago_esperado).toFixed(2)).includes(q) ||
               String(Number(f.monto_total).toFixed(2)).includes(q) ||
               (f.serie || '').toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
               (f.numero_factura || '').toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
               (f.nombre_receptor || '').toLowerCase().includes(filtroBusqueda.toLowerCase());
      })
    : facturas;

  /* ── Totales (solo activas) ── */
  const activas    = facturas.filter(f => f.estado !== 'anulada');
  const totalBruto = activas.reduce((s, f) => s + (Number(f.monto_total) || 0), 0);
  const totalIVA   = activas.reduce((s, f) => s + (Number(f.retencion_iva) || 0), 0);
  const totalNeto  = activas.reduce((s, f) => s + (Number(f.pago_esperado) || 0), 0);
  const pendientes = activas.filter(f => f.estado === 'pendiente').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Encabezado + botón */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: T.hi, margin: 0 }}>IGSS Gomera — Facturas emitidas</h2>
          <p style={{ fontSize: 12.5, color: T.lo, marginTop: 3 }}>
            Carga los XML del DTE para registrar facturas al IGSS. El IVA (12%) es retenido por el IGSS.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".xml" multiple style={{ display: 'none' }}
            onChange={onFiles} />
          <Btn onClick={() => fileRef.current?.click()}>+ Cargar XML</Btn>
          <Btn variant="secondary" onClick={cargar}>Actualizar</Btn>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith('❌') ? T.critBg : T.okBg,
          border: `1px solid ${msg.startsWith('❌') ? T.crit : T.ok}44`,
          borderRadius: 10, padding: '10px 16px', fontSize: 13,
          color: msg.startsWith('❌') ? T.crit : T.ok, fontWeight: 600 }}>
          {msg}
        </div>
      )}

      {/* Tarjetas de resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total facturas',    val: activas.length, fmt: v => v,   color: T.teal,    bg: T.tealXL },
          { label: 'Pendientes pago',   val: pendientes,     fmt: v => v,   color: '#D97706', bg: '#FEF9C3' },
          { label: 'Monto total',       val: totalBruto,     fmt: fmtQ,     color: T.hi,      bg: T.canvas },
          { label: 'Depósito esperado', val: totalNeto,      fmt: fmtQ,     color: T.ok,      bg: '#D1FAE5' },
        ].map(({ label, val, fmt, color, bg }) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: '12px 16px',
            border: `1px solid ${color}33` }}>
            <div style={{ fontSize: 18, fontWeight: 800, color }}>{fmt(val)}</div>
            <div style={{ fontSize: 11.5, color, opacity: 0.8, fontWeight: 600, marginTop: 2 }}>{label}</div>
            {label === 'Monto total' && (
              <div style={{ fontSize: 10.5, color: '#D97706', marginTop: 4 }}>
                IVA retenido: {fmtQ(totalIVA)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Barra de búsqueda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.lo}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={filtroBusqueda}
            onChange={e => setFiltroBusqueda(e.target.value)}
            placeholder="Buscar por monto, factura o receptor…"
            style={{ width: '100%', padding: '8px 12px 8px 32px', border: `1px solid ${T.border}`,
              borderRadius: 8, fontFamily: 'inherit', fontSize: 13, color: T.hi,
              background: 'var(--input-bg)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {filtroBusqueda && (
          <button onClick={() => setFiltroBusqueda('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.lo, fontSize: 12 }}>
            Limpiar
          </button>
        )}
        {filtroBusqueda && (
          <span style={{ fontSize: 12, color: T.lo }}>
            {facturasFiltradas.length} resultado(s)
          </span>
        )}
      </div>

      {/* Tabla de facturas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: T.lo }}>Cargando…</div>
      ) : loadError ? (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#991B1B', flex: 1 }}>{loadError}</span>
          <Btn variant="secondary" size="sm" onClick={cargar}>Reintentar</Btn>
        </div>
      ) : facturasFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.lo, fontSize: 13 }}>
          {filtroBusqueda ? 'Sin resultados para esa búsqueda.' : 'No hay facturas registradas. Carga archivos XML del DTE.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.canvas }}>
                {['Factura','Fecha','Monto total','IVA retenido','Depósito esperado','Estado','Acciones'].map(h => (
                  <th key={h} style={{ padding: '8px 12px',
                    textAlign: ['Monto total','IVA retenido','Depósito esperado'].includes(h) ? 'right' : 'left',
                    fontSize: 11, fontWeight: 700, color: T.lo, textTransform: 'uppercase',
                    letterSpacing: '0.07em', borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facturasFiltradas.map((f, i) => (
                <tr key={f.id} style={{ background: i % 2 === 0 ? T.surface : T.canvas,
                  borderBottom: `1px solid ${T.border}`,
                  opacity: f.estado === 'anulada' ? 0.45 : 1 }}>
                  {/* Factura — clic para ver detalle */}
                  <td style={{ padding: '10px 12px', cursor: 'pointer' }}
                    onClick={() => setDetailItem(f)}>
                    <div style={{ fontWeight: 600, color: T.tealDk, fontSize: 13,
                      textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                      {f.serie}-{f.numero_factura}
                    </div>
                    <div style={{ fontSize: 11, color: T.lo, marginTop: 2 }}>
                      {f.nombre_receptor || f.nit_receptor}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: T.mid, whiteSpace: 'nowrap' }}>
                    {fmtFecha(f.fecha_emision)}
                  </td>
                  <td style={{ padding: '10px 12px', color: T.hi, textAlign: 'right', fontWeight: 600 }}>
                    {fmtQ(f.monto_total)}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#D97706', textAlign: 'right' }}>
                    −{fmtQ(f.retencion_iva)}
                  </td>
                  <td style={{ padding: '10px 12px', color: T.ok, textAlign: 'right', fontWeight: 700 }}>
                    {fmtQ(f.pago_esperado)}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <EstadoBadge estado={f.estado} />
                    {f.fecha_pago && (
                      <div style={{ fontSize: 10.5, color: T.lo, marginTop: 3 }}>
                        {fmtFecha(f.fecha_pago)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'flex-end' }}>
                      {/* Secretaria: solo puede ver detalle y usar el lápiz para corrección/anulación */}
                      {!isSecretaria && f.estado !== 'pagada' && f.estado !== 'anulada' && (
                        <button onClick={() => marcarPagada(f)} title="Marcar como pagada ahora"
                          style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 6,
                            padding: '5px 11px', cursor: 'pointer', color: '#065F46',
                            fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          ✓ Pagado
                        </button>
                      )}
                      <button onClick={() => abrirEditar(f)} title="Editar estado / notas"
                        style={{ background: T.canvas, border: `1px solid ${T.border}`, borderRadius: 6,
                          padding: '5px 7px', cursor: 'pointer', color: T.lo,
                          lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      {!isSecretaria && (
                        <button onClick={() => eliminar(f)} title="Eliminar"
                          style={{ background: T.critBg, border: `1px solid #FECACA`, borderRadius: 6,
                            padding: '5px 7px', cursor: 'pointer', color: T.crit,
                            lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/>
                            <path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Preview de XML parseados */}
      <Modal open={showPrev} onClose={() => { setShowPrev(false); setPreview([]); }}
        title="Confirmar facturas a cargar" maxWidth={820}>
        <p style={{ fontSize: 12.5, color: T.lo, marginBottom: 14 }}>
          Revisa los datos extraídos antes de guardar. Puedes quitar archivos con errores.
        </p>
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: T.canvas }}>
                {['Archivo','Factura','Fecha','Total','IVA retenido','Depósito',''].map(h => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'left',
                    fontSize: 10.5, fontWeight: 700, color: T.lo, textTransform: 'uppercase',
                    borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map(item => (
                <FilaPreview key={item.archivo} item={item} onRemove={quitarPreview} />
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: T.lo }}>
            {preview.filter(p => !p.error).length} factura(s) válida(s) de {preview.length}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="secondary" onClick={() => { setShowPrev(false); setPreview([]); }}>Cancelar</Btn>
            <Btn onClick={guardar} disabled={guardando || !preview.some(p => !p.error)}>
              {guardando ? 'Guardando…' : 'Guardar facturas'}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal: Editar estado/notas */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Editar factura" maxWidth={380}>
        {editItem && (
          <>
            <p style={{ fontSize: 12.5, color: T.lo, marginBottom: 16 }}>
              {editItem.serie}-{editItem.numero_factura} · {fmtQ(editItem.monto_total)}
            </p>
            <Field label="Estado">
              <TSelect value={editForm.estado} onChange={e => setEditForm(f => ({ ...f, estado: e.target.value }))}
                options={isSecretaria
                  ? [
                      { value: 'pendiente',     label: 'Pendiente' },
                      { value: 'en_correccion', label: 'En corrección' },
                      { value: 'anulada',       label: 'Anulada' },
                    ]
                  : [
                      { value: 'pendiente',     label: 'Pendiente' },
                      { value: 'pagada',        label: 'Pagada' },
                      { value: 'en_correccion', label: 'En corrección' },
                      { value: 'anulada',       label: 'Anulada' },
                    ]
                } />
            </Field>
            {editForm.estado === 'pagada' && !isSecretaria && (
              <Field label="Fecha de pago">
                <TInput type="date" value={editForm.fecha_pago}
                  onChange={e => setEditForm(f => ({ ...f, fecha_pago: e.target.value }))} />
              </Field>
            )}
            <Field label="Notas internas">
              <TInput value={editForm.notas} placeholder="Ej: Enviada a corrección el 15/06"
                onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))} />
            </Field>
            {editErr && (
              <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '8px 12px',
                fontSize: 12.5, color: '#991B1B', marginBottom: 4 }}>{editErr}</div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setEditItem(null)}>Cancelar</Btn>
              <Btn onClick={guardarEditar}>Guardar</Btn>
            </div>
          </>
        )}
      </Modal>

      {/* Modal: Detalle de factura (líneas del DTE) */}
      <Modal open={!!detailItem} onClose={() => setDetailItem(null)}
        title={`Detalle — ${detailItem?.serie}-${detailItem?.numero_factura}`} maxWidth={680}>
        {detailItem && (() => {
          const items = parsearItems(detailItem.xml_raw);
          return (
            <>
              {/* Encabezado */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Receptor', value: detailItem.nombre_receptor || detailItem.nit_receptor },
                  { label: 'Fecha emisión', value: fmtFecha(detailItem.fecha_emision) },
                  { label: 'Estado', value: ESTADO_CFG[detailItem.estado]?.label || detailItem.estado },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: T.canvas, borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10.5, color: T.lo, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, color: T.hi, fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Líneas de detalle */}
              {items.length > 0 ? (
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: T.canvas }}>
                        {['#','Tipo','Cant.','Unidad','Descripción','P. Unit.','Descuento','Total'].map(h => (
                          <th key={h} style={{ padding: '7px 10px', textAlign: h === 'Descripción' ? 'left' : 'right',
                            fontSize: 10, fontWeight: 700, color: T.lo, textTransform: 'uppercase',
                            letterSpacing: '0.06em', borderBottom: `1px solid ${T.border}`,
                            ...(h === '#' || h === 'Tipo' || h === 'Cant.' || h === 'Unidad' ? { textAlign: 'left' } : {}) }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}`,
                          background: i % 2 === 0 ? T.surface : T.canvas }}>
                          <td style={{ padding: '8px 10px', fontSize: 11.5, color: T.lo }}>{it.linea}</td>
                          <td style={{ padding: '8px 10px', fontSize: 11.5, color: T.mid }}>{it.tipo}</td>
                          <td style={{ padding: '8px 10px', fontSize: 11.5, color: T.mid }}>{it.cantidad}</td>
                          <td style={{ padding: '8px 10px', fontSize: 11.5, color: T.mid }}>{it.unidad}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12.5, color: T.hi,
                            fontWeight: 500, maxWidth: 260, wordBreak: 'break-word' }}>{it.descripcion}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: T.mid,
                            textAlign: 'right' }}>{fmtQ(it.precioUnit)}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: '#D97706',
                            textAlign: 'right' }}>{it.descuento > 0 ? `−${fmtQ(it.descuento)}` : '—'}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12.5, fontWeight: 700,
                            color: T.hi, textAlign: 'right' }}>{fmtQ(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: T.lo, fontSize: 12.5 }}>
                  No se encontraron líneas de detalle en el XML almacenado.
                </div>
              )}

              {/* Totales del pie */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24,
                background: T.canvas, borderRadius: 8, padding: '10px 16px' }}>
                {[
                  { label: 'Subtotal', value: detailItem.subtotal, color: T.mid },
                  { label: 'IVA retenido', value: detailItem.retencion_iva, color: '#D97706' },
                  { label: 'Depósito esperado', value: detailItem.pago_esperado, color: T.ok },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10.5, color: T.lo, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color }}>{fmtQ(value)}</div>
                  </div>
                ))}
              </div>

              {detailItem.notas && (
                <div style={{ marginTop: 12, background: '#FEFCE8', borderRadius: 8,
                  padding: '8px 12px', fontSize: 12, color: '#92400E' }}>
                  <strong>Notas:</strong> {detailItem.notas}
                </div>
              )}
            </>
          );
        })()}
      </Modal>
    </div>
  );
}
