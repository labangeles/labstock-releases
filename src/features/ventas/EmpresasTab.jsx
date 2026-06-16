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

/* ─── EmpresasTab ─────────────────────────────────────────── */
export default function EmpresasTab() {
  const { profile } = useAuth();
  const [facturas,  setFacturas]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [preview,   setPreview]   = useState([]);
  const [showPrev,  setShowPrev]  = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [editForm,  setEditForm]  = useState({});
  const [msg,       setMsg]       = useState('');
  const [filtroNIT, setFiltroNIT] = useState('');
  const fileRef = useRef(null);

  const cargar = useCallback(async () => {
    if (!profile?.organizacion_id) return;
    setLoading(true);
    const { data } = await supabase.from('ventas_facturas')
      .select('*').eq('organizacion_id', profile.organizacion_id)
      .eq('categoria', 'empresa').order('fecha_emision', { ascending: false });
    setFacturas(data || []);
    setLoading(false);
  }, [profile?.organizacion_id]);

  useEffect(() => { cargar(); }, [cargar]);

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

  /* Busca o crea el cliente por NIT */
  const upsertCliente = async (nit, nombre) => {
    const { data: exist } = await supabase.from('ventas_clientes')
      .select('id').eq('nit', nit).eq('organizacion_id', profile.organizacion_id)
      .eq('categoria', 'empresa').maybeSingle();
    if (exist) return exist.id;
    const { data: nuevo } = await supabase.from('ventas_clientes').insert({
      organizacion_id: profile.organizacion_id,
      nit, nombre, categoria: 'empresa',
    }).select('id').single();
    return nuevo?.id || null;
  };

  const guardar = async () => {
    const validas = preview.filter(p => !p.error);
    if (!validas.length) return;
    setGuardando(true);
    let ok = 0, dup = 0, err = 0;

    for (const item of validas) {
      const cliente_id = await upsertCliente(item.nit_receptor, item.nombre_receptor);
      const { error } = await supabase.from('ventas_facturas').insert({
        organizacion_id: profile.organizacion_id,
        cliente_id,
        categoria:       'empresa',
        uuid_sat:        item.uuid_sat,
        serie:           item.serie,
        numero_factura:  item.numero_factura,
        nit_receptor:    item.nit_receptor,
        nombre_receptor: item.nombre_receptor,
        fecha_emision:   item.fecha_emision,
        subtotal:        item.subtotal,
        iva_monto:       item.iva_monto,
        monto_total:     item.monto_total,
        retencion_iva:   0,              // empresas pagan el total (sin retención por defecto)
        pago_esperado:   item.monto_total,
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

  const eliminar = async (f) => {
    if (!window.confirm(`¿Eliminar la factura ${f.serie}-${f.numero_factura}?`)) return;
    await supabase.from('ventas_facturas').delete().eq('id', f.id);
    cargar();
  };

  const abrirEditar = (f) => {
    setEditItem(f);
    setEditForm({ estado: f.estado, notas: f.notas || '', fecha_pago: f.fecha_pago || '' });
  };

  const guardarEditar = async () => {
    await supabase.from('ventas_facturas').update({
      estado: editForm.estado, notas: editForm.notas,
      fecha_pago: editForm.fecha_pago || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editItem.id);
    setEditItem(null);
    cargar();
  };

  /* Filtro por NIT/nombre */
  const filtradas = facturas.filter(f => {
    if (!filtroNIT.trim()) return true;
    const q = filtroNIT.toLowerCase();
    return f.nit_receptor?.toLowerCase().includes(q) ||
           f.nombre_receptor?.toLowerCase().includes(q);
  });

  /* Totales (solo activas) */
  const activas   = filtradas.filter(f => f.estado !== 'anulada');
  const totalMonto = activas.reduce((s, f) => s + Number(f.pago_esperado), 0);
  const pendientes = activas.filter(f => f.estado === 'pendiente').length;

  /* NITs únicos para el filtro rápido */
  const nitsUnicos = [...new Map(facturas.map(f =>
    [f.nit_receptor, f.nombre_receptor])).entries()];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: T.hi, margin: 0 }}>Empresas — Cuentas por cobrar</h2>
          <p style={{ fontSize: 12.5, color: T.lo, marginTop: 3 }}>
            Facturas emitidas pendientes de pago, clasificadas por NIT del receptor.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".xml" multiple style={{ display: 'none' }} onChange={onFiles} />
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

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Total facturas activas', val: activas.length,  fmt: v => v,  color: T.teal,   bg: T.tealXL },
          { label: 'Pendientes de cobro',    val: pendientes,      fmt: v => v,  color: '#D97706', bg: '#FEF9C3' },
          { label: 'Monto por cobrar',        val: totalMonto,     fmt: fmtQ,    color: T.ok,     bg: '#D1FAE5' },
        ].map(({ label, val, fmt, color, bg }) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: '12px 16px', border: `1px solid ${color}33` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{fmt(val)}</div>
            <div style={{ fontSize: 11.5, color, opacity: 0.8, fontWeight: 600, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filtro rápido por empresa */}
      {nitsUnicos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: T.lo, fontWeight: 600 }}>Filtrar:</span>
          <button onClick={() => setFiltroNIT('')}
            style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${!filtroNIT ? T.teal : T.border}`,
              background: !filtroNIT ? T.tealXL : T.surface, color: !filtroNIT ? T.tealDk : T.mid,
              cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: !filtroNIT ? 700 : 500 }}>
            Todas
          </button>
          {nitsUnicos.map(([nit, nombre]) => (
            <button key={nit} onClick={() => setFiltroNIT(nit)}
              style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${filtroNIT === nit ? T.teal : T.border}`,
                background: filtroNIT === nit ? T.tealXL : T.surface,
                color: filtroNIT === nit ? T.tealDk : T.mid,
                cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                fontWeight: filtroNIT === nit ? 700 : 500 }}>
              {nombre || nit}
            </button>
          ))}
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: T.lo }}>Cargando…</div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: T.lo, fontSize: 13 }}>
          No hay facturas. Carga archivos XML del DTE.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.canvas }}>
                {['Empresa / NIT','Factura','Fecha','Monto total','Estado',''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left',
                    fontSize: 11, fontWeight: 700, color: T.lo, textTransform: 'uppercase',
                    letterSpacing: '0.07em', borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f, i) => (
                <tr key={f.id} style={{ background: i % 2 === 0 ? T.surface : T.canvas,
                  borderBottom: `1px solid ${T.border}`, opacity: f.estado === 'anulada' ? 0.45 : 1 }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: T.hi, fontSize: 13 }}>{f.nombre_receptor || '—'}</div>
                    <div style={{ fontSize: 11, color: T.lo, marginTop: 2, fontFamily: 'monospace' }}>{f.nit_receptor}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: T.mid }}>{f.serie}-{f.numero_factura}</td>
                  <td style={{ padding: '10px 12px', color: T.mid, whiteSpace: 'nowrap' }}>{fmtFecha(f.fecha_emision)}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: T.hi, textAlign: 'right' }}>{fmtQ(f.pago_esperado)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <EstadoBadge estado={f.estado} />
                    {f.fecha_pago && (
                      <div style={{ fontSize: 10.5, color: T.lo, marginTop: 3 }}>Pagada {fmtFecha(f.fecha_pago)}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button onClick={() => abrirEditar(f)} title="Editar"
                        style={{ background: T.tealXL, border: 'none', borderRadius: 6,
                          padding: '5px 8px', cursor: 'pointer', color: T.tealDk, fontSize: 12 }}>✏️</button>
                      <button onClick={() => eliminar(f)} title="Eliminar"
                        style={{ background: T.critBg, border: 'none', borderRadius: 6,
                          padding: '5px 8px', cursor: 'pointer', color: T.crit, fontSize: 12 }}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal preview */}
      <Modal open={showPrev} onClose={() => { setShowPrev(false); setPreview([]); }}
        title="Confirmar facturas a cargar" maxWidth={760}>
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: T.canvas }}>
                {['Archivo','Receptor / NIT','Factura','Fecha','Total',''].map(h => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10.5,
                    fontWeight: 700, color: T.lo, textTransform: 'uppercase', borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map(item => (
                <tr key={item.archivo} style={{ borderBottom: `1px solid ${T.border}`,
                  background: item.error ? '#FEF2F2' : T.surface }}>
                  <td style={{ padding: '8px 12px', fontSize: 12, color: T.mid }}>{item.archivo}</td>
                  {item.error ? (
                    <td colSpan={4} style={{ padding: '8px 12px', fontSize: 12, color: T.crit }}>⚠️ {item.error}</td>
                  ) : (
                    <>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.hi }}>{item.nombre_receptor}</div>
                        <div style={{ fontSize: 10.5, color: T.lo, fontFamily: 'monospace' }}>{item.nit_receptor}</div>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: T.mid }}>{item.serie}-{item.numero_factura}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: T.mid }}>{item.fecha_emision}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: T.hi, textAlign: 'right' }}>{fmtQ(item.monto_total)}</td>
                    </>
                  )}
                  <td style={{ padding: '8px 12px' }}>
                    <button onClick={() => quitarPreview(item.archivo)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.crit, fontSize: 14 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: T.lo }}>
            {preview.filter(p => !p.error).length} válida(s) de {preview.length}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="secondary" onClick={() => { setShowPrev(false); setPreview([]); }}>Cancelar</Btn>
            <Btn onClick={guardar} disabled={guardando || !preview.some(p => !p.error)}>
              {guardando ? 'Guardando…' : 'Guardar facturas'}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal editar */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Editar factura" maxWidth={360}>
        {editItem && (
          <>
            <p style={{ fontSize: 12.5, color: T.lo, marginBottom: 16 }}>
              {editItem.nombre_receptor} · {editItem.serie}-{editItem.numero_factura}
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
            <Field label="Notas">
              <TInput value={editForm.notas} placeholder="Observaciones internas"
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
