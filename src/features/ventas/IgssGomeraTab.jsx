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
  const [facturas,  setFacturas]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [preview,   setPreview]   = useState([]);       // items parseados esperando confirmación
  const [showPrev,  setShowPrev]  = useState(false);
  const [editItem,  setEditItem]  = useState(null);     // factura siendo editada
  const [editForm,  setEditForm]  = useState({});
  const [msg,       setMsg]       = useState('');
  const fileRef = useRef(null);

  const cargar = useCallback(async () => {
    if (!profile?.organizacion_id) return;
    setLoading(true);
    const { data } = await supabase.from('ventas_facturas')
      .select('*').eq('organizacion_id', profile.organizacion_id)
      .eq('categoria', 'igss').order('fecha_emision', { ascending: false });
    setFacturas(data || []);
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
    let ok = 0, dup = 0, err = 0;

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
      else err++;
    }

    setGuardando(false);
    setShowPrev(false);
    setPreview([]);
    const partes = [];
    if (ok)  partes.push(`${ok} factura(s) guardada(s)`);
    if (dup) partes.push(`${dup} duplicada(s) ignorada(s)`);
    if (err) partes.push(`${err} con error`);
    setMsg(partes.join(' · '));
    setTimeout(() => setMsg(''), 4000);
    cargar();
  };

  /* ── Cambiar estado de factura ── */
  const cambiarEstado = async (id, estado) => {
    await supabase.from('ventas_facturas').update({ estado, updated_at: new Date().toISOString() }).eq('id', id);
    cargar();
  };

  /* ── Eliminar factura ── */
  const eliminar = async (f) => {
    if (!window.confirm(`¿Eliminar la factura ${f.serie}-${f.numero_factura}? Esta acción no se puede deshacer.`)) return;
    await supabase.from('ventas_facturas').delete().eq('id', f.id);
    cargar();
  };

  /* ── Abrir edición de nota ── */
  const abrirEditar = (f) => {
    setEditItem(f);
    setEditForm({ estado: f.estado, notas: f.notas || '', fecha_pago: f.fecha_pago || '' });
  };

  const guardarEditar = async () => {
    await supabase.from('ventas_facturas').update({
      estado:     editForm.estado,
      notas:      editForm.notas,
      fecha_pago: editForm.fecha_pago || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editItem.id);
    setEditItem(null);
    cargar();
  };

  /* ── Totales ── */
  const activas    = facturas.filter(f => f.estado !== 'anulada');
  const totalBruto = activas.reduce((s, f) => s + Number(f.monto_total), 0);
  const totalIVA   = activas.reduce((s, f) => s + Number(f.retencion_iva), 0);
  const totalNeto  = activas.reduce((s, f) => s + Number(f.pago_esperado), 0);
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
        <div style={{ background: T.okBg, border: `1px solid ${T.ok}44`, borderRadius: 10,
          padding: '10px 16px', fontSize: 13, color: T.ok, fontWeight: 600 }}>
          ✅ {msg}
        </div>
      )}

      {/* Tarjetas de resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total facturas',   val: activas.length,     fmt: v => v,        color: T.teal,   bg: T.tealXL },
          { label: 'Pendientes pago',  val: pendientes,         fmt: v => v,        color: '#D97706', bg: '#FEF9C3' },
          { label: 'Monto total',      val: totalBruto,         fmt: fmtQ,          color: T.hi,     bg: T.canvas },
          { label: 'Depósito esperado',val: totalNeto,          fmt: fmtQ,          color: T.ok,     bg: '#D1FAE5' },
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

      {/* Tabla de facturas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: T.lo }}>Cargando…</div>
      ) : facturas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.lo, fontSize: 13 }}>
          No hay facturas registradas. Carga archivos XML del DTE.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.canvas }}>
                {['Factura','Fecha','Monto total','IVA retenido','Depósito esperado','Estado',''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === '' ? 'center' : 'left',
                    fontSize: 11, fontWeight: 700, color: T.lo, textTransform: 'uppercase',
                    letterSpacing: '0.07em', borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facturas.map((f, i) => (
                <tr key={f.id} style={{ background: i % 2 === 0 ? T.surface : T.canvas,
                  borderBottom: `1px solid ${T.border}`,
                  opacity: f.estado === 'anulada' ? 0.45 : 1 }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: T.hi, fontSize: 13 }}>
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
                        Pagada {fmtFecha(f.fecha_pago)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button onClick={() => abrirEditar(f)} title="Editar estado / notas"
                        style={{ background: T.tealXL, border: 'none', borderRadius: 6,
                          padding: '5px 8px', cursor: 'pointer', color: T.tealDk, fontSize: 12 }}>
                        ✏️
                      </button>
                      <button onClick={() => eliminar(f)} title="Eliminar"
                        style={{ background: T.critBg, border: 'none', borderRadius: 6,
                          padding: '5px 8px', cursor: 'pointer', color: T.crit, fontSize: 12 }}>
                        🗑
                      </button>
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
                options={[
                  { value: 'pendiente',     label: 'Pendiente' },
                  { value: 'pagada',        label: 'Pagada' },
                  { value: 'en_correccion', label: 'En corrección' },
                  { value: 'anulada',       label: 'Anulada' },
                ]} />
            </Field>
            {editForm.estado === 'pagada' && (
              <Field label="Fecha de pago">
                <TInput type="date" value={editForm.fecha_pago}
                  onChange={e => setEditForm(f => ({ ...f, fecha_pago: e.target.value }))} />
              </Field>
            )}
            <Field label="Notas internas">
              <TInput value={editForm.notas} placeholder="Ej: Enviada a corrección el 15/06"
                onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))} />
            </Field>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setEditItem(null)}>Cancelar</Btn>
              <Btn onClick={guardarEditar}>Guardar</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
