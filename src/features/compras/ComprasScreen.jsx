import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { T, Ico, Btn, IconBtn, Modal, Field, TInput, TSelect, fmtQ } from '../../shared/ui';

/* ── Constantes ──────────────────────────────────────── */
const TIPOS_DOC = [
  { value: 'fisica',        label: 'Factura física' },
  { value: 'electronica',   label: 'Factura electrónica' },
  { value: 'pdf_proveedor', label: 'PDF enviado por proveedor' },
];
const CATEGORIAS = [
  { value: 'reactivo',     label: 'Reactivo' },
  { value: 'descartables', label: 'Descartables y consumibles' },
  { value: 'equipo',       label: 'Equipo' },
  { value: 'miscelaneos',  label: 'Misceláneos' },
];
const UNITS = [
  'frascos','unidades','cajas','paquetes','rollos','pares',
  'litros','mL','tubos','tiras reactivas','láminas','resmas','bidones','kits',
];

const CAT_LABEL      = Object.fromEntries(CATEGORIAS.map(c => [c.value, c.label]));
const TIPO_DOC_LABEL = Object.fromEntries(TIPOS_DOC.map(t => [t.value, t.label]));

const today   = () => new Date().toISOString().split('T')[0];
const fmtDate = iso => iso
  ? new Date(iso + 'T12:00:00').toLocaleDateString('es-GT', { day:'2-digit', month:'short', year:'numeric' })
  : '—';
const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + (parseInt(days) || 0));
  return d.toISOString().split('T')[0];
};

/* ── Badge vencimiento ───────────────────────────────── */
function VencBadge({ fecha }) {
  if (!fecha) return <span style={{ color:T.lo, fontSize:12 }}>—</span>;
  const now = new Date(); now.setHours(0,0,0,0);
  const d   = Math.round((new Date(fecha+'T12:00:00') - now) / 86400000);
  let c = T.ok, bg = T.okBg, txt = `${d}d`;
  if (d < 0)       { c = T.crit; bg = T.critBg; txt = `Vencido ${Math.abs(d)}d`; }
  else if (d === 0){ c = T.crit; bg = T.critBg; txt = 'Hoy'; }
  else if (d <= 7) { c = T.warn; bg = T.warnBg; }
  return <span style={{ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600, background:bg, color:c }}>{txt}</span>;
}

/* ── Selector de proveedor del catálogo ──────────────── */
function ProveedorSelect({ organizacionId, value, onChange, onRequestAdd }) {
  const [list, setList]   = useState([]);
  const [q, setQ]         = useState('');
  const [open, setOpen]   = useState(false);
  const ref = useRef(null);

  const loadList = useCallback(async () => {
    const { data } = await supabase.from('proveedores')
      .select('id,nombre,codigo_interno,nit')
      .eq('organizacion_id', organizacionId)
      .eq('activo', true)
      .order('nombre');
    setList(data || []);
  }, [organizacionId]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = q
    ? list.filter(p =>
        p.nombre.toLowerCase().includes(q.toLowerCase()) ||
        (p.codigo_interno||'').toLowerCase().includes(q.toLowerCase()))
    : list;

  const pick = p => { onChange(p); setQ(''); setOpen(false); };
  const clear = () => { onChange(null); setQ(''); };

  const displayVal = value ? value.nombre : '';

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
        <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
          color:T.lo, pointerEvents:'none' }}><Ico.Search s={14}/></span>
        <input
          value={value ? displayVal : q}
          readOnly={!!value}
          onChange={e => { setQ(e.target.value); onChange(null); setOpen(true); }}
          onFocus={() => { if (!value) setOpen(true); }}
          placeholder="Seleccionar proveedor..."
          style={{ flex:1, padding:'8px 36px 8px 32px', border:`1px solid ${value ? T.teal : T.border}`,
            borderRadius:8, fontFamily:'inherit', fontSize:13, color:T.hi,
            background: value ? T.tealXL : 'var(--input-bg)', outline:'none',
            cursor: value ? 'default' : 'text' }}
        />
        {value && (
          <button onClick={clear} style={{ position:'absolute', right:8, background:'none', border:'none',
            cursor:'pointer', color:T.lo, display:'flex', padding:4, borderRadius:4 }}>
            <Ico.XClose s={12}/>
          </button>
        )}
      </div>

      {open && !value && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:60, marginTop:4,
          background:T.surface, border:`1px solid ${T.border}`, borderRadius:10,
          boxShadow:'0 8px 24px rgba(0,0,0,0.12)', overflow:'hidden', maxHeight:220, overflowY:'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding:'14px 16px' }}>
              <div style={{ fontSize:12.5, color:T.lo, marginBottom:10 }}>
                {q ? `Sin coincidencias para "${q}"` : 'Sin proveedores registrados'}
              </div>
              <Btn size="sm" icon={<Ico.Plus s={12}/>} onClick={() => { setOpen(false); onRequestAdd?.(); }}>
                Agregar proveedor
              </Btn>
            </div>
          ) : (
            filtered.map(p => (
              <div key={p.id} onMouseDown={() => pick(p)}
                style={{ padding:'10px 14px', cursor:'pointer', display:'flex', gap:12,
                  alignItems:'center', borderBottom:`1px solid ${T.border}`, transition:'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = T.tealXL}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.hi }}>{p.nombre}</div>
                  <div style={{ fontSize:11, color:T.lo, marginTop:1 }}>
                    {[p.codigo_interno && `Cód: ${p.codigo_interno}`, p.nit && `NIT: ${p.nit}`]
                      .filter(Boolean).join(' · ') || 'Sin código / NIT'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Buscador de insumos del inventario ──────────────── */
function ItemSearch({ sedeId, excludeIds, onAdd }) {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!q.trim() || !sedeId) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('items')
        .select('id,nombre,categoria,unidad')
        .eq('sede_id', sedeId).eq('activo', true)
        .ilike('nombre', `%${q}%`).limit(8);
      setResults((data || []).filter(r => !excludeIds.includes(r.id)));
    }, 220);
    return () => clearTimeout(t);
  }, [q, sedeId, excludeIds]);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = item => {
    onAdd({ _id: Date.now(), item_id: item.id, nombre: item.nombre,
      categoria: item.categoria || 'miscelaneos', unidad: item.unidad || UNITS[0], cantidad: '1' });
    setQ(''); setResults([]); setOpen(false);
  };

  return (
    <div ref={ref} style={{ position:'relative', flex:1 }}>
      <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
        color:T.lo, pointerEvents:'none', zIndex:1 }}><Ico.Search s={14}/></span>
      <input value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={e => { setOpen(true); e.target.style.borderColor = T.teal; }}
        onBlur={e => e.target.style.borderColor = T.border}
        placeholder={sedeId ? 'Buscar insumo del catálogo...' : 'Selecciona una sede primero'}
        disabled={!sedeId}
        style={{ width:'100%', padding:'8px 12px 8px 32px', border:`1px solid ${T.border}`,
          borderRadius:8, fontFamily:'inherit', fontSize:13, color:T.hi,
          background: sedeId ? 'var(--input-bg)' : T.canvas, outline:'none', boxSizing:'border-box',
          cursor: sedeId ? 'text' : 'not-allowed' }}/>
      {open && results.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:60, marginTop:4,
          background:T.surface, border:`1px solid ${T.border}`, borderRadius:10,
          boxShadow:'0 8px 24px rgba(0,0,0,0.12)', overflow:'hidden' }}>
          {results.map(r => (
            <div key={r.id} onMouseDown={() => pick(r)}
              style={{ padding:'10px 14px', cursor:'pointer', display:'flex', gap:10, alignItems:'center',
                borderBottom:`1px solid ${T.border}`, transition:'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = T.tealXL}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500, color:T.hi }}>{r.nombre}</div>
                <div style={{ fontSize:11, color:T.lo }}>{CAT_LABEL[r.categoria]||r.categoria} · {r.unidad}</div>
              </div>
              <Ico.Plus s={13} c={T.teal}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Agregar ítem sin catalogar ──────────────────────── */
function FreeItemRow({ onAdd }) {
  const [nombre, setNombre]     = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [unidad, setUnidad]     = useState(UNITS[0]);
  const [cat, setCat]           = useState('miscelaneos');

  const add = () => {
    if (!nombre.trim()) return;
    onAdd({ _id: Date.now(), item_id:null, nombre:nombre.trim(), categoria:cat, unidad, cantidad });
    setNombre(''); setCantidad('1'); setUnidad(UNITS[0]);
  };

  return (
    <div style={{ background:T.warnBg, border:`1px solid ${T.warn}55`, borderRadius:8,
      padding:'10px 12px', marginTop:8 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#92400E', marginBottom:8,
        textTransform:'uppercase', letterSpacing:'0.06em' }}>
        Agregar sin vincular al catálogo
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 70px 110px 130px auto', gap:8, alignItems:'end' }}>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:T.mid, display:'block', marginBottom:4 }}>Nombre del producto</label>
          <TInput value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Agua destilada" onKeyDown={e => e.key==='Enter' && add()}/>
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:T.mid, display:'block', marginBottom:4 }}>Cantidad</label>
          <TInput type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} min="0.01"/>
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:T.mid, display:'block', marginBottom:4 }}>Unidad</label>
          <TSelect value={unidad} onChange={e => setUnidad(e.target.value)} options={UNITS}/>
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:T.mid, display:'block', marginBottom:4 }}>Categoría</label>
          <TSelect value={cat} onChange={e => setCat(e.target.value)} options={CATEGORIAS}/>
        </div>
        <div style={{ paddingBottom:2 }}>
          <Btn size="sm" onClick={add} icon={<Ico.Plus s={13}/>}>Agregar</Btn>
        </div>
      </div>
    </div>
  );
}

/* ── Lista de líneas del pedido ──────────────────────── */
function LineItems({ lines, onChange, onRemove, readOnly }) {
  if (!lines.length) return null;
  const cols = readOnly ? '1fr 80px 110px 130px' : '1fr 80px 110px 130px 32px';
  return (
    <div style={{ border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden', marginBottom:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:cols, padding:'7px 12px',
        background:'var(--table-head-bg)', borderBottom:`1px solid ${T.border}` }}>
        {['Producto','Cant.','Unidad','Categoría'].map((h,i) => (
          <span key={i} style={{ fontSize:10, fontWeight:700, color:T.lo,
            textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</span>
        ))}
      </div>
      {lines.map((line, i) => (
        <div key={line._id || line.id}
          style={{ display:'grid', gridTemplateColumns:cols, padding:'10px 12px', alignItems:'center',
            gap:8, borderBottom:i < lines.length-1 ? `1px solid ${T.border}` : 'none',
            background: line.item_id ? '#F0FAFA' : 'transparent' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:500, color:T.hi }}>{line.nombre}</div>
            <div style={{ fontSize:10.5, marginTop:2 }}>
              {line.item_id
                ? <span style={{ color:T.tealDk }}>▸ Vinculado al inventario</span>
                : <span style={{ color:T.lo }}>Sin vincular</span>}
            </div>
          </div>
          {readOnly ? (
            <div style={{ fontSize:13, fontWeight:600, color:T.hi, textAlign:'right' }}>{line.cantidad}</div>
          ) : (
            <input type="text" inputMode="numeric" value={line.cantidad}
              onChange={e => onChange({ ...line, cantidad:e.target.value })}
              style={{ padding:'5px 8px', border:`1px solid ${T.border}`, borderRadius:6,
                fontFamily:'inherit', fontSize:13, color:T.hi, background:'var(--input-bg)',
                outline:'none', textAlign:'right', width:'100%', boxSizing:'border-box' }}/>
          )}
          <div style={{ fontSize:12, color:T.mid }}>{line.unidad || '—'}</div>
          <div>
            <span style={{ background:T.tealXL, color:T.tealDk,
              border:`1px solid ${T.tealL}`, padding:'2px 7px',
              borderRadius:12, fontSize:11 }}>
              {CAT_LABEL[line.categoria] || line.categoria || '—'}
            </span>
          </div>
          {!readOnly && (
            <button onClick={() => onRemove(line._id)}
              style={{ width:28, height:28, border:'none', background:T.critBg, borderRadius:6,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Ico.XClose s={12} c={T.crit}/>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Helpers UI ──────────────────────────────────────── */
const SecHdr = ({ label }) => (
  <div style={{ fontSize:11, fontWeight:700, color:T.lo, textTransform:'uppercase',
    letterSpacing:'0.08em', marginBottom:10 }}>{label}</div>
);
const Divider = () => <div style={{ background:T.border, height:1, margin:'6px 0 16px' }}/>;

/* ══════════════════════════════════════════════════════
   MODAL: Nueva Compra
══════════════════════════════════════════════════════ */
function NuevaCompraModal({ profile, sedes, onSave, onClose, onGoProveedores }) {
  const sedesHab = sedes.filter(s => s.permite_compras);
  const isAdmin  = profile?.rol === 'admin';

  const defaultSede = isAdmin
    ? (sedesHab.length === 1 ? sedesHab[0].id : '')
    : profile?.sede_id || '';

  const [sedeId, setSedeId]       = useState(defaultSede);
  const [proveedor, setProveedor] = useState(null);  // { id, nombre, ... }
  const [lines, setLines]         = useState([]);
  const [showFree, setShowFree]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const [form, setForm] = useState({
    numero_factura: '', tipo_documento: 'fisica',
    fecha_recepcion: today(),
    cadena_frio: false, monto_total: '',
    tipo_pago: 'contado', dias_credito: '30',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));

  const fechaVenc = form.tipo_pago === 'credito' && form.fecha_recepcion && form.dias_credito
    ? addDays(form.fecha_recepcion, form.dias_credito) : null;

  const addLine    = line => setLines(ls => [...ls, line]);
  const updateLine = line => setLines(ls => ls.map(l => l._id === line._id ? line : l));
  const removeLine = id   => setLines(ls => ls.filter(l => l._id !== id));
  const excludeIds = lines.filter(l => l.item_id).map(l => l.item_id);

  const validate = () => {
    if (!sedeId) return 'Selecciona la sede.';
    if (!proveedor?.id) return 'Selecciona un proveedor del catálogo.';
    if (!form.monto_total || isNaN(+form.monto_total) || +form.monto_total <= 0)
      return 'Ingresa el monto total de la factura.';
    if (lines.length === 0) return 'Agrega al menos un producto.';
    if (form.tipo_pago === 'credito' && (!form.dias_credito || parseInt(form.dias_credito) < 1))
      return 'Indica los días de crédito otorgados.';
    return null;
  };

  const save = async () => {
    const e = validate();
    if (e) { setErr(e); return; }
    setSaving(true); setErr('');

    const { data: compra, error: ce } = await supabase.from('compras').insert({
      sede_id:          sedeId,
      organizacion_id:  profile.organizacion_id,
      proveedor_id:     proveedor.id,
      numero_factura:   form.numero_factura.trim() || null,
      tipo_documento:   form.tipo_documento,
      fecha_recepcion:  form.fecha_recepcion,
      cadena_frio:      form.cadena_frio,
      monto_total:      +form.monto_total,
      tipo_pago:        form.tipo_pago,
      dias_credito:     form.tipo_pago === 'credito' ? parseInt(form.dias_credito) : null,
      fecha_vencimiento: fechaVenc || null,
      registrado_por:   profile.id,
    }).select().single();

    if (ce) { setErr(ce.message); setSaving(false); return; }

    const { error: ie } = await supabase.from('compra_items').insert(
      lines.map(l => ({
        compra_id: compra.id, item_id: l.item_id || null,
        nombre: l.nombre, cantidad: +l.cantidad || 0,
        unidad: l.unidad || null, categoria: l.categoria || null,
      }))
    );
    if (ie) { setErr(ie.message); setSaving(false); return; }

    // Auto-incrementar stock para ítems vinculados
    for (const l of lines.filter(li => li.item_id)) {
      const qty = +l.cantidad;
      if (qty <= 0) continue;
      const { data: item } = await supabase.from('items')
        .select('id,cantidad_actual,cantidad_maxima').eq('id', l.item_id).single();
      if (item) {
        const nueva = item.cantidad_actual + qty;
        await supabase.from('items').update({
          cantidad_actual: item.cantidad_maxima != null
            ? Math.min(item.cantidad_maxima, nueva)
            : nueva
        }).eq('id', l.item_id);
      }
    }

    setSaving(false); onSave(); onClose();
  };

  const sedeName = sedes.find(s => s.id === sedeId)?.nombre;

  return (
    <div>
      {/* Sede fija (secretaria) o selector (admin) */}
      {isAdmin ? (
        <Field label="Sede que registra la compra">
          <select value={sedeId} onChange={e => setSedeId(e.target.value)}
            style={{ width:'100%', padding:'8px 11px', border:`1px solid ${T.border}`, borderRadius:8,
              fontFamily:'inherit', fontSize:13, color:T.hi, background:'var(--input-bg)',
              outline:'none', boxSizing:'border-box', cursor:'pointer' }}>
            <option value="">Seleccionar sede...</option>
            {sedesHab.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </Field>
      ) : (
        <div style={{ background:T.tealXL, border:`1px solid ${T.tealL}`, borderRadius:8,
          padding:'8px 12px', marginBottom:14, fontSize:13, color:T.tealDk }}>
          Sede: <strong>{sedeName || '—'}</strong>
        </div>
      )}

      {/* ── Sección 1: Datos de la factura ── */}
      <SecHdr label="Sección 1 — Datos de la factura"/>
      <Field label="Proveedor *">
        <ProveedorSelect
          organizacionId={profile.organizacion_id}
          value={proveedor}
          onChange={setProveedor}
          onRequestAdd={() => { onClose(); onGoProveedores?.(); }}/>
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="No. de factura">
          <TInput value={form.numero_factura} onChange={e => set('numero_factura', e.target.value)}
            placeholder="Ej: A-0012345"/>
        </Field>
        <Field label="Fecha de recepción *">
          <TInput type="date" value={form.fecha_recepcion}
            onChange={e => set('fecha_recepcion', e.target.value)}/>
        </Field>
      </div>
      <Field label="Tipo de documento *">
        <TSelect value={form.tipo_documento} onChange={e => set('tipo_documento', e.target.value)}
          options={TIPOS_DOC}/>
      </Field>

      {/* ── Sección 2: Productos ── */}
      <Divider/>
      <SecHdr label="Sección 2 — Productos recibidos"/>
      <div style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center' }}>
        <ItemSearch sedeId={sedeId} excludeIds={excludeIds} onAdd={addLine}/>
        <Btn size="sm" variant="ghost" onClick={() => setShowFree(f => !f)}>
          {showFree ? 'Ocultar' : '+ Sin catalogar'}
        </Btn>
      </div>
      {showFree && <FreeItemRow onAdd={line => { addLine(line); setShowFree(false); }}/>}
      <LineItems lines={lines} onChange={updateLine} onRemove={removeLine} readOnly={false}/>
      {lines.length === 0 && (
        <div style={{ background:T.canvas, borderRadius:8, padding:'18px', textAlign:'center',
          color:T.lo, fontSize:13, marginBottom:12 }}>
          Busca insumos del catálogo o agrega sin catalogar
        </div>
      )}
      <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.hi,
        cursor:'pointer', marginBottom:16 }}>
        <input type="checkbox" checked={form.cadena_frio}
          onChange={e => set('cadena_frio', e.target.checked)}
          style={{ width:15, height:15, accentColor:T.teal, cursor:'pointer' }}/>
        Requiere cadena de frío
      </label>

      {/* ── Sección 3: Pago ── */}
      <Divider/>
      <SecHdr label="Sección 3 — Condiciones de pago"/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Monto total de la factura *">
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)',
              fontSize:13, fontWeight:600, color:T.lo }}>Q</span>
            <input type="text" inputMode="decimal" value={form.monto_total}
              onChange={e => set('monto_total', e.target.value)}
              placeholder="0.00"
              style={{ width:'100%', padding:'8px 11px 8px 24px', border:`1px solid ${T.border}`,
                borderRadius:8, fontFamily:'inherit', fontSize:13, color:T.hi,
                background:'var(--input-bg)', outline:'none', boxSizing:'border-box' }}/>
          </div>
        </Field>
        <Field label="Condición de pago *">
          <TSelect value={form.tipo_pago} onChange={e => set('tipo_pago', e.target.value)}
            options={[{ value:'contado', label:'Contado' }, { value:'credito', label:'Crédito' }]}/>
        </Field>
      </div>
      {form.tipo_pago === 'credito' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Días de crédito otorgados *">
            <TInput type="number" value={form.dias_credito}
              onChange={e => set('dias_credito', e.target.value)} placeholder="30" min="1"/>
          </Field>
          <Field label="Fecha de vencimiento" hint="Calculada automáticamente">
            <div style={{ padding:'8px 11px', background:T.canvas, border:`1px solid ${T.border}`,
              borderRadius:8, fontSize:13, color: fechaVenc ? T.hi : T.lo }}>
              {fechaVenc ? fmtDate(fechaVenc) : '—'}
            </div>
          </Field>
        </div>
      )}

      {err && (
        <div style={{ background:T.critBg, borderRadius:8, padding:'10px 12px',
          fontSize:12.5, color:T.crit, marginBottom:12 }}>{err}</div>
      )}
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={save} disabled={saving} icon={<Ico.Check s={14}/>}>
          {saving ? 'Guardando...' : 'Registrar compra'}
        </Btn>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: Proveedores
══════════════════════════════════════════════════════ */
function ProveedoresTab({ profile, canEdit }) {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);   // null | 'new' | {id,...}
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');
  const [form, setForm]       = useState({ nombre:'', codigo_interno:'', nit:'', telefono:'', correo:'' });
  const setF = (k, v) => setForm(f => ({ ...f, [k]:v }));

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('proveedores')
      .select('*')
      .eq('organizacion_id', profile.organizacion_id)
      .eq('activo', true)
      .order('nombre');
    setList(data || []);
    setLoading(false);
  }, [profile.organizacion_id]);

  useEffect(() => { load(); }, [load]);

  const nextCode = async () => {
    const { data } = await supabase.from('proveedores')
      .select('codigo_interno')
      .eq('organizacion_id', profile.organizacion_id)
      .ilike('codigo_interno', 'PROV-%');
    let max = 0;
    (data || []).forEach(p => {
      const n = parseInt((p.codigo_interno || '').replace('PROV-', ''));
      if (!isNaN(n) && n > max) max = n;
    });
    return `PROV-${String(max + 1).padStart(4, '0')}`;
  };

  const openNew = async () => {
    setErr('');
    const codigo = await nextCode();
    setForm({ nombre:'', codigo_interno: codigo, nit:'', telefono:'', correo:'' });
    setModal('new');
  };
  const openEdit = p => {
    setErr('');
    setForm({ nombre:p.nombre, codigo_interno:p.codigo_interno||'', nit:p.nit||'', telefono:p.telefono||'', correo:p.correo||'' });
    setModal(p);
  };

  const save = async () => {
    if (!form.nombre.trim()) { setErr('El nombre del proveedor es obligatorio.'); return; }
    setSaving(true); setErr('');
    const isNew = modal === 'new';
    const payload = {
      nombre:         form.nombre.trim(),
      codigo_interno: form.codigo_interno.trim() || null,
      nit:            form.nit.trim() || null,
      telefono:       form.telefono.trim() || null,
      correo:         form.correo.trim() || null,
    };
    let error;
    if (isNew) {
      ({ error } = await supabase.from('proveedores').insert({
        ...payload, organizacion_id: profile.organizacion_id
      }));
    } else {
      ({ error } = await supabase.from('proveedores').update(payload).eq('id', modal.id));
    }
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setModal(null); load();
  };

  const disable = async p => {
    if (!window.confirm(`¿Deshabilitar al proveedor "${p.nombre}"?`)) return;
    await supabase.from('proveedores').update({ activo:false }).eq('id', p.id);
    load();
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
        <div>
          <h2 style={{ fontSize:17, fontWeight:700, color:T.hi, margin:0 }}>Proveedores</h2>
          <p style={{ fontSize:12.5, color:T.lo, marginTop:3 }}>
            Catálogo de proveedores para el módulo de compras
          </p>
        </div>
        {canEdit && (
          <Btn icon={<Ico.Plus s={14}/>} onClick={openNew}>Agregar proveedor</Btn>
        )}
      </div>

      <div style={{ background:T.surface, borderRadius:12, border:`1px solid ${T.border}`, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'100px 1.5fr 110px 1fr 72px',
          padding:'8px 18px', background:'var(--table-head-bg)', borderBottom:`1px solid ${T.border}` }}>
          {['Código','Nombre','NIT','Teléfono / Correo',''].map((h,i) => (
            <span key={i} style={{ fontSize:10.5, fontWeight:700, color:T.lo,
              textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</span>
          ))}
        </div>
        {loading ? (
          <div style={{ padding:'40px 20px', textAlign:'center', color:T.lo }}>Cargando...</div>
        ) : list.length === 0 ? (
          <div style={{ padding:'52px 20px', textAlign:'center' }}>
            <div style={{ fontSize:13.5, color:T.lo }}>Sin proveedores registrados</div>
            {canEdit && (
              <Btn style={{ marginTop:14 }} onClick={openNew} icon={<Ico.Plus s={13}/>}>
                Agregar primer proveedor
              </Btn>
            )}
          </div>
        ) : (
          list.map((p, i) => (
            <div key={p.id}
              style={{ display:'grid', gridTemplateColumns:'100px 1.5fr 110px 1fr 72px',
                padding:'12px 18px', alignItems:'center',
                borderBottom: i < list.length-1 ? `1px solid ${T.border}` : 'none' }}>
              <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700,
                color: p.codigo_interno ? T.tealDk : T.border }}>
                {p.codigo_interno || '—'}
              </span>
              <span style={{ fontSize:13, fontWeight:500, color:T.hi }}>{p.nombre}</span>
              <span style={{ fontSize:12, color:T.mid }}>{p.nit || '—'}</span>
              <span style={{ fontSize:12, color:T.mid, overflow:'hidden',
                textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {[p.telefono, p.correo].filter(Boolean).join(' · ') || '—'}
              </span>
              {canEdit && (
                <div style={{ display:'flex', gap:2, justifyContent:'flex-end' }}>
                  <IconBtn icon={<Ico.Edit s={13}/>} onClick={() => openEdit(p)}/>
                  <IconBtn icon={<Ico.Trash s={13}/>} danger onClick={() => disable(p)}/>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal agregar / editar proveedor */}
      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal === 'new' ? 'Agregar proveedor' : 'Editar proveedor'} maxWidth={420}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <div style={{ flex:1 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:T.mid, marginBottom:5 }}>
              Nombre del proveedor *
            </label>
            <TInput value={form.nombre} onChange={e => setF('nombre', e.target.value)}
              placeholder="Ej: Distribuidora Médica S.A." focusOnMount/>
          </div>
          <div style={{ flexShrink:0 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:T.mid, marginBottom:5 }}>
              Código interno
            </label>
            <div style={{ padding:'8px 14px', background:T.tealXL, border:`1px solid ${T.tealL}`,
              borderRadius:8, fontFamily:'monospace', fontSize:13, fontWeight:700,
              color:T.tealDk, letterSpacing:'0.05em', whiteSpace:'nowrap' }}>
              {form.codigo_interno}
            </div>
          </div>
        </div>
        <Field label="NIT">
          <TInput value={form.nit} onChange={e => setF('nit', e.target.value)}
            placeholder="Ej: 1234567-8"/>
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Teléfono">
            <TInput value={form.telefono} onChange={e => setF('telefono', e.target.value)}
              placeholder="Ej: 5555-1234"/>
          </Field>
          <Field label="Correo electrónico">
            <TInput type="email" value={form.correo} onChange={e => setF('correo', e.target.value)}
              placeholder="Ej: ventas@proveedor.com"/>
          </Field>
        </div>
        {err && (
          <div style={{ background:T.critBg, borderRadius:8, padding:'10px 12px',
            fontSize:12.5, color:T.crit, marginBottom:12 }}>{err}</div>
        )}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
          <Btn variant="secondary" onClick={() => setModal(null)}>Cancelar</Btn>
          <Btn onClick={save} disabled={saving} icon={<Ico.Check s={14}/>}>
            {saving ? 'Guardando...' : modal === 'new' ? 'Agregar' : 'Guardar cambios'}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MODAL: Editar Compra (solo campos de cabecera)
══════════════════════════════════════════════════════ */
function EditCompraModal({ profile, compra, onSave, onClose }) {
  const [proveedor, setProveedor] = useState(
    compra.proveedores ? { id: compra.proveedor_id, nombre: compra.proveedores.nombre, ...compra.proveedores } : null
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const [form, setForm]     = useState({
    numero_factura: compra.numero_factura || '',
    tipo_documento: compra.tipo_documento || 'fisica',
    fecha_recepcion: compra.fecha_recepcion || today(),
    cadena_frio: compra.cadena_frio || false,
    monto_total: String(compra.monto_total || ''),
    tipo_pago: compra.tipo_pago || 'contado',
    dias_credito: String(compra.dias_credito || '30'),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fechaVenc = form.tipo_pago === 'credito' && form.fecha_recepcion && form.dias_credito
    ? addDays(form.fecha_recepcion, form.dias_credito) : null;

  const save = async () => {
    if (!proveedor?.id) { setErr('Selecciona un proveedor.'); return; }
    if (!form.monto_total || isNaN(+form.monto_total) || +form.monto_total <= 0) {
      setErr('Ingresa el monto total.'); return;
    }
    setSaving(true); setErr('');
    const { error } = await supabase.from('compras').update({
      proveedor_id:     proveedor.id,
      numero_factura:   form.numero_factura.trim() || null,
      tipo_documento:   form.tipo_documento,
      fecha_recepcion:  form.fecha_recepcion,
      cadena_frio:      form.cadena_frio,
      monto_total:      +form.monto_total,
      tipo_pago:        form.tipo_pago,
      dias_credito:     form.tipo_pago === 'credito' ? parseInt(form.dias_credito) : null,
      fecha_vencimiento: fechaVenc || null,
    }).eq('id', compra.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSave(); onClose();
  };

  return (
    <div>
      <Field label="Proveedor *">
        <ProveedorSelect organizacionId={profile.organizacion_id} value={proveedor} onChange={setProveedor}/>
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="No. de factura">
          <TInput value={form.numero_factura} onChange={e => set('numero_factura', e.target.value)} placeholder="Ej: A-0012345"/>
        </Field>
        <Field label="Fecha de recepción *">
          <TInput type="date" value={form.fecha_recepcion} onChange={e => set('fecha_recepcion', e.target.value)}/>
        </Field>
      </div>
      <Field label="Tipo de documento *">
        <TSelect value={form.tipo_documento} onChange={e => set('tipo_documento', e.target.value)} options={TIPOS_DOC}/>
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Monto total *">
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)',
              fontSize:13, fontWeight:600, color:T.lo }}>Q</span>
            <input type="text" inputMode="decimal" value={form.monto_total}
              onChange={e => set('monto_total', e.target.value)} placeholder="0.00"
              style={{ width:'100%', padding:'8px 11px 8px 24px', border:`1px solid ${T.border}`,
                borderRadius:8, fontFamily:'inherit', fontSize:13, color:T.hi,
                background:'var(--input-bg)', outline:'none', boxSizing:'border-box' }}/>
          </div>
        </Field>
        <Field label="Condición de pago *">
          <TSelect value={form.tipo_pago} onChange={e => set('tipo_pago', e.target.value)}
            options={[{ value:'contado', label:'Contado' }, { value:'credito', label:'Crédito' }]}/>
        </Field>
      </div>
      {form.tipo_pago === 'credito' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Días de crédito *">
            <TInput type="number" value={form.dias_credito} onChange={e => set('dias_credito', e.target.value)} min="1"/>
          </Field>
          <Field label="Fecha de vencimiento" hint="Calculada automáticamente">
            <div style={{ padding:'8px 11px', background:T.canvas, border:`1px solid ${T.border}`,
              borderRadius:8, fontSize:13, color: fechaVenc ? T.hi : T.lo }}>
              {fechaVenc ? fmtDate(fechaVenc) : '—'}
            </div>
          </Field>
        </div>
      )}
      <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:T.hi,
        cursor:'pointer', marginBottom:16 }}>
        <input type="checkbox" checked={form.cadena_frio} onChange={e => set('cadena_frio', e.target.checked)}
          style={{ width:15, height:15, accentColor:T.teal, cursor:'pointer' }}/>
        Requiere cadena de frío
      </label>
      {err && (
        <div style={{ background:T.critBg, borderRadius:8, padding:'10px 12px',
          fontSize:12.5, color:T.crit, marginBottom:12 }}>{err}</div>
      )}
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={save} disabled={saving} icon={<Ico.Check s={14}/>}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Btn>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PANTALLA DE DETALLE DE COMPRA
══════════════════════════════════════════════════════ */
function CompraDetail({ compra, isAdmin, onBack, onEdit, onDelete }) {
  const InfoChip = ({ label, value }) => (
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      <span style={{ fontSize:10.5, fontWeight:700, color:T.lo,
        textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</span>
      <span style={{ fontSize:13, color:T.hi }}>{value || '—'}</span>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Barra superior */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={onBack}
          style={{ display:'flex', alignItems:'center', gap:6,
            background:'transparent', border:`1px solid ${T.border}`,
            cursor:'pointer', fontFamily:'inherit', fontSize:13.5, fontWeight:500,
            color:T.mid, padding:'6px 14px', borderRadius:8, transition:'all 0.12s' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=T.teal;e.currentTarget.style.color=T.tealDk;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.mid;}}>
          <Ico.ChevronLeft s={15}/> Volver a facturas
        </button>
        {isAdmin && (
          <div style={{ display:'flex', gap:8 }}>
            <Btn variant="secondary" size="sm" icon={<Ico.Edit s={13}/>} onClick={onEdit}>
              Editar
            </Btn>
            <button onClick={onDelete}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px',
                background:T.critBg, color:T.crit, border:`1px solid #FECACA`,
                borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              <Ico.Trash s={13} c={T.crit}/>
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Cabecera de la factura */}
      <div style={{ background:T.surface, borderRadius:14, border:`1px solid ${T.border}`, padding:'20px 24px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:19, fontWeight:700, color:T.hi }}>
              {compra.proveedores?.nombre || '—'}
            </div>
            <div style={{ fontSize:12.5, color:T.lo, marginTop:5, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              {compra.numero_factura && <span>Factura #{compra.numero_factura}</span>}
              <span>{TIPO_DOC_LABEL[compra.tipo_documento] || compra.tipo_documento}</span>
              {compra.cadena_frio && (
                <span style={{ background:'rgba(37,99,235,0.15)', color:'#60A5FA',
                  border:'1px solid rgba(37,99,235,0.35)',
                  padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600 }}>❄ Cadena de frío</span>
              )}
            </div>
          </div>
          <div style={{ flexShrink:0 }}>
            {compra.tipo_pago === 'credito'
              ? <span style={{ background:'rgba(99,102,241,0.15)', color:'#818CF8',
                  border:'1px solid rgba(99,102,241,0.35)',
                  padding:'5px 14px', borderRadius:12, fontSize:12, fontWeight:700 }}>Crédito</span>
              : <span style={{ background:T.okBg, color:T.ok, padding:'5px 14px',
                  borderRadius:12, fontSize:12, fontWeight:700 }}>Contado</span>}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',
          gap:18, paddingTop:16, borderTop:`1px solid ${T.border}` }}>
          <InfoChip label="Fecha recepción" value={fmtDate(compra.fecha_recepcion)}/>
          <InfoChip label="Sede" value={compra.sedes?.nombre}/>
          <InfoChip label="Registrado por" value={compra.registrador?.nombre}/>
          {compra.proveedores?.nit && <InfoChip label="NIT proveedor" value={compra.proveedores.nit}/>}
          {compra.proveedores?.telefono && <InfoChip label="Teléfono" value={compra.proveedores.telefono}/>}
          {compra.proveedores?.correo && <InfoChip label="Correo" value={compra.proveedores.correo}/>}
        </div>
      </div>

      {/* Condiciones de pago */}
      <div style={{ background:T.surface, borderRadius:14, border:`1px solid ${T.border}`, padding:'18px 24px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.lo, textTransform:'uppercase',
          letterSpacing:'0.07em', marginBottom:16 }}>Condiciones de pago</div>
        <div style={{ display:'flex', gap:36, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div>
            <div style={{ fontSize:11, color:T.lo, marginBottom:4 }}>Monto total</div>
            <div style={{ fontSize:24, fontWeight:700, color:T.hi }}>{fmtQ(compra.monto_total)}</div>
          </div>
          {compra.tipo_pago === 'credito' && (
            <>
              <div>
                <div style={{ fontSize:11, color:T.lo, marginBottom:4 }}>Días de crédito</div>
                <div style={{ fontSize:17, fontWeight:600, color:T.hi }}>{compra.dias_credito} días</div>
              </div>
              <div>
                <div style={{ fontSize:11, color:T.lo, marginBottom:6 }}>Vencimiento</div>
                <VencBadge fecha={compra.fecha_vencimiento}/>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Productos */}
      <div style={{ background:T.surface, borderRadius:14, border:`1px solid ${T.border}`, padding:'18px 24px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.lo, textTransform:'uppercase',
          letterSpacing:'0.07em', marginBottom:14 }}>
          Productos recibidos ({compra.compra_items?.length || 0})
        </div>
        {compra.compra_items?.length > 0
          ? <LineItems lines={compra.compra_items.map(item => ({ ...item, _id:item.id }))} readOnly/>
          : <div style={{ fontSize:13, color:T.lo }}>Sin productos registrados</div>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PANTALLA PRINCIPAL
══════════════════════════════════════════════════════ */
export function ComprasScreen({ profile, isAdmin, isAuditor, sedes }) {
  const [tab, setTab]               = useState('facturas');
  const [compras, setCompras]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [viewingCompra, setViewing] = useState(null);
  const [searchQ, setSearchQ]       = useState('');
  const [filterSede, setFilterSede] = useState('');
  const [editCompra, setEditCompra] = useState(null);
  const [delCompra, setDelCompra]   = useState(null);
  const [deleting, setDeleting]     = useState(false);
  const [filterDesde, setFDesde]    = useState('');
  const [filterHasta, setFHasta]    = useState('');
  const [filterProv, setFProv]      = useState('');

  const isSecretaria = profile?.rol === 'secretaria';
  const canRegister  = isAdmin || isSecretaria;
  const canEdit      = isAdmin || isSecretaria;
  const sedesHab     = sedes.filter(s => s.permite_compras);
  const sedeActual   = sedes.find(s => s.id === profile?.sede_id);
  const puedeRegistrar = canRegister && (isAdmin || sedeActual?.permite_compras);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('compras')
      .select('*, proveedores(nombre,codigo_interno,nit,telefono,correo), sedes(nombre), compra_items(*), registrador:registrado_por(nombre)')
      .order('fecha_recepcion', { ascending:false })
      .order('created_at', { ascending:false });
    // Secretaria y técnico: solo ven compras de su propia sede
    if (!isAdmin && !isAuditor && profile?.sede_id) {
      q = q.eq('sede_id', profile.sede_id);
    }
    const { data } = await q;
    setCompras(data || []);
    setLoading(false);
  }, [isAdmin, isAuditor, profile?.sede_id]);

  useEffect(() => { load(); }, [load]);

  // Sincronizar viewingCompra con datos frescos tras recarga
  useEffect(() => {
    if (!viewingCompra) return;
    const fresh = compras.find(c => c.id === viewingCompra.id);
    if (fresh) setViewing(fresh);
  }, [compras]);

  const confirmDelete = async () => {
    if (!delCompra) return;
    setDeleting(true);
    await supabase.from('compras').delete().eq('id', delCompra.id);
    setDeleting(false);
    setDelCompra(null);
    setViewing(null);
    load();
  };

  const filtered = compras.filter(c => {
    if (filterSede && c.sede_id !== filterSede) return false;
    if (filterProv && c.proveedor_id !== filterProv) return false;
    if (filterDesde && c.fecha_recepcion < filterDesde) return false;
    if (filterHasta && c.fecha_recepcion > filterHasta) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return (c.proveedores?.nombre || '').toLowerCase().includes(q)
          || (c.numero_factura || '').toLowerCase().includes(q);
    }
    return true;
  });

  const proveedoresUnicos = [...new Map(
    compras.filter(c => c.proveedores).map(c => [c.proveedor_id, c.proveedores])
  ).entries()].map(([id, p]) => ({ id, nombre: p.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const exportCSV = () => {
    const headers = ['Proveedor','Código','NIT','No. Factura','Tipo Doc','Sede',
      'Fecha Recepción','Monto Q','Tipo Pago','Días Crédito','Vencimiento','Cadena Frío','Registrado por'];
    const rows = filtered.map(c => [
      c.proveedores?.nombre || '',
      c.proveedores?.codigo_interno || '',
      c.proveedores?.nit || '',
      c.numero_factura || '',
      TIPO_DOC_LABEL[c.tipo_documento] || c.tipo_documento,
      c.sedes?.nombre || '',
      c.fecha_recepcion || '',
      c.monto_total,
      c.tipo_pago === 'credito' ? 'Crédito' : 'Contado',
      c.dias_credito || '',
      c.fecha_vencimiento || '',
      c.cadena_frio ? 'Sí' : 'No',
      c.registrador?.nombre || '',
    ]);
    const csv = 'sep=,\r\n' + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `compras_${today()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const hayFiltros = filterDesde || filterHasta || filterProv || filterSede || searchQ;
  const limpiarFiltros = () => {
    setFDesde(''); setFHasta(''); setFProv(''); setFilterSede(''); setSearchQ('');
  };

  const totalMonto  = filtered.reduce((s, c) => s + (+c.monto_total || 0), 0);
  const creditosVig = filtered.filter(c => {
    if (c.tipo_pago !== 'credito' || !c.fecha_vencimiento) return false;
    const now = new Date(); now.setHours(0,0,0,0);
    return new Date(c.fecha_vencimiento+'T12:00:00') >= now;
  }).length;

  const showSede = isAdmin || isAuditor;
  const cols = showSede
    ? '1.2fr 100px 100px 110px 90px 90px 16px'
    : '1.2fr 100px 110px 90px 90px 16px';

  /* ── Vista de detalle ── */
  if (viewingCompra) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        <CompraDetail
          compra={viewingCompra}
          isAdmin={isAdmin}
          onBack={() => setViewing(null)}
          onEdit={() => setEditCompra(viewingCompra)}
          onDelete={() => setDelCompra(viewingCompra)}/>

        <Modal open={!!editCompra} onClose={() => setEditCompra(null)}
          title="Editar compra" maxWidth={480}>
          {editCompra && (
            <EditCompraModal profile={profile} compra={editCompra}
              onSave={() => { load(); setEditCompra(null); }}
              onClose={() => setEditCompra(null)}/>
          )}
        </Modal>

        <Modal open={!!delCompra} onClose={() => setDelCompra(null)}
          title="Eliminar compra" maxWidth={400}>
          {delCompra && (
            <div>
              <p style={{ fontSize:13.5, color:T.hi, marginBottom:12 }}>
                ¿Eliminar la compra de{' '}
                <strong>{delCompra.proveedores?.nombre || 'este proveedor'}</strong>
                {delCompra.numero_factura ? ` (Factura #${delCompra.numero_factura})` : ''}?
              </p>
              <div style={{ background:T.warnBg, border:`1px solid ${T.warn}55`, borderRadius:8,
                padding:'10px 14px', marginBottom:20 }}>
                <div style={{ fontSize:12, color:'#92400E', fontWeight:700, marginBottom:4 }}>⚠ Importante</div>
                <div style={{ fontSize:12, color:'#92400E', lineHeight:1.5 }}>
                  El stock vinculado <strong>no se revertirá</strong> automáticamente.
                  Ajusta el inventario manualmente si es necesario.
                </div>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <Btn variant="secondary" onClick={() => setDelCompra(null)}>Cancelar</Btn>
                <button onClick={confirmDelete} disabled={deleting}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
                    background: deleting ? T.border : T.crit, color:'white', border:'none',
                    borderRadius:8, fontFamily:'inherit', fontSize:13, fontWeight:600,
                    cursor: deleting ? 'not-allowed' : 'pointer' }}>
                  <Ico.Trash s={14} c="white"/>
                  {deleting ? 'Eliminando...' : 'Eliminar compra'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  /* ── Vista de lista ── */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:21, fontWeight:700, color:T.hi, letterSpacing:'-0.025em', margin:0 }}>
            Compras
          </h1>
          <p style={{ fontSize:12.5, color:T.lo, marginTop:4 }}>
            Registro de facturas de proveedores
            {!isAdmin && sedeActual ? ` — ${sedeActual.nombre}` : ''}
          </p>
        </div>
        {tab === 'facturas' && canRegister && puedeRegistrar && (
          <Btn icon={<Ico.Plus s={14}/>} onClick={() => setShowModal(true)}>
            Registrar compra
          </Btn>
        )}
        {tab === 'facturas' && canRegister && !puedeRegistrar && (
          <div style={{ fontSize:12, color:T.lo, fontStyle:'italic', maxWidth:200, textAlign:'right' }}>
            Tu sede no tiene habilitado el módulo de compras
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${T.border}` }}>
        {[{ id:'facturas', label:'Facturas' }, { id:'proveedores', label:'Proveedores' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'9px 18px', background:'none', border:'none', cursor:'pointer',
              fontFamily:'inherit',
              borderBottom:`2px solid ${tab===t.id ? T.teal : 'transparent'}`, marginBottom:-1,
              color: tab===t.id ? T.tealDk : T.mid,
              fontSize:13.5, fontWeight: tab===t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Proveedores ── */}
      {tab === 'proveedores' && (
        <ProveedoresTab profile={profile} canEdit={canEdit}/>
      )}

      {/* ── TAB: Facturas ── */}
      {tab === 'facturas' && (
        <>
          <div style={{ display:'flex', gap:12 }}>
            <KpiCard label="Total facturado" value={fmtQ(totalMonto)}
              sub={`${filtered.length} factura${filtered.length!==1?'s':''}`}/>
            <KpiCard label="Créditos vigentes" value={String(creditosVig)}
              sub="facturas a crédito activas"
              accent={creditosVig > 0 ? '#3730A3' : undefined}/>
            {(isAdmin || isAuditor) && sedesHab.length > 0 && (
              <KpiCard label="Sedes con compras" value={String(sedesHab.length)}
                sub={sedesHab.map(s=>s.nombre).join(', ')}/>
            )}
          </div>

          {/* Filtros */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:'14px 16px',
            display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <div style={{ position:'relative', flex:1 }}>
                <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)',
                  color:T.lo, pointerEvents:'none' }}><Ico.Search s={14}/></span>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Buscar por proveedor o no. factura..."
                  style={{ width:'100%', padding:'8px 12px 8px 34px', border:`1px solid ${T.border}`,
                    borderRadius:8, fontFamily:'inherit', fontSize:13, color:T.hi,
                    background:'var(--input-bg)', outline:'none', boxSizing:'border-box' }}
                  onFocus={e => e.target.style.borderColor = T.teal}
                  onBlur={e => e.target.style.borderColor = T.border}/>
              </div>
              {hayFiltros && (
                <button onClick={limpiarFiltros}
                  style={{ padding:'7px 13px', background:'none', border:`1px solid ${T.border}`,
                    borderRadius:8, fontFamily:'inherit', fontSize:12, color:T.lo, cursor:'pointer',
                    whiteSpace:'nowrap' }}>
                  Limpiar filtros
                </button>
              )}
              <button onClick={exportCSV}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
                  background:T.tealXL, border:`1px solid ${T.tealL}`, borderRadius:8,
                  fontFamily:'inherit', fontSize:12.5, fontWeight:600, color:T.tealDk,
                  cursor:'pointer', whiteSpace:'nowrap' }}>
                ↓ Exportar CSV
              </button>
            </div>

            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <label style={{ fontSize:11.5, fontWeight:600, color:T.lo, whiteSpace:'nowrap' }}>Desde</label>
                <input type="date" value={filterDesde} onChange={e => setFDesde(e.target.value)}
                  style={{ padding:'6px 10px', border:`1px solid ${T.border}`, borderRadius:8,
                    fontFamily:'inherit', fontSize:12.5, color:T.hi, background:'var(--input-bg)', outline:'none' }}/>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <label style={{ fontSize:11.5, fontWeight:600, color:T.lo, whiteSpace:'nowrap' }}>Hasta</label>
                <input type="date" value={filterHasta} onChange={e => setFHasta(e.target.value)}
                  style={{ padding:'6px 10px', border:`1px solid ${T.border}`, borderRadius:8,
                    fontFamily:'inherit', fontSize:12.5, color:T.hi, background:'var(--input-bg)', outline:'none' }}/>
              </div>
              {proveedoresUnicos.length > 0 && (
                <select value={filterProv} onChange={e => setFProv(e.target.value)}
                  style={{ padding:'6px 10px', border:`1px solid ${filterProv ? T.teal : T.border}`,
                    borderRadius:8, fontFamily:'inherit', fontSize:12.5, color:T.hi,
                    background: filterProv ? T.tealXL : 'var(--input-bg)', outline:'none', cursor:'pointer' }}>
                  <option value="">Todos los proveedores</option>
                  {proveedoresUnicos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              )}
              {(isAdmin || isAuditor) && sedesHab.length > 1 && (
                <select value={filterSede} onChange={e => setFilterSede(e.target.value)}
                  style={{ padding:'6px 10px', border:`1px solid ${filterSede ? T.teal : T.border}`,
                    borderRadius:8, fontFamily:'inherit', fontSize:12.5, color:T.hi,
                    background: filterSede ? T.tealXL : 'var(--input-bg)', outline:'none', cursor:'pointer' }}>
                  <option value="">Todas las sedes</option>
                  {sedesHab.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              )}
            </div>
          </div>

          <div style={{ background:T.surface, borderRadius:12, border:`1px solid ${T.border}`, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:cols, padding:'8px 18px',
              background:'var(--table-head-bg)', borderBottom:`1px solid ${T.border}` }}>
              {['Proveedor','Fecha',...(showSede?['Sede']:[]),'Monto','Pago','Vencimiento',''].map((h,i) => (
                <span key={i} style={{ fontSize:10.5, fontWeight:700, color:T.lo,
                  textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</span>
              ))}
            </div>

            {loading ? (
              <div style={{ padding:'48px 20px', textAlign:'center', color:T.lo }}>Cargando compras...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding:'52px 20px', textAlign:'center' }}>
                <Ico.File s={30} c={T.border}/>
                <div style={{ fontSize:13.5, color:T.lo, marginTop:10 }}>
                  {compras.length === 0 ? 'Sin compras registradas' : 'Sin resultados'}
                </div>
                {canRegister && puedeRegistrar && compras.length === 0 && (
                  <Btn style={{ marginTop:14 }} onClick={() => setShowModal(true)} icon={<Ico.Plus s={13}/>}>
                    Registrar primera compra
                  </Btn>
                )}
              </div>
            ) : (
              filtered.map((c, i) => (
                <div key={c.id} onClick={() => setViewing(c)}
                  style={{ display:'grid', gridTemplateColumns:cols, padding:'13px 18px',
                    alignItems:'center', gap:12, cursor:'pointer', transition:'background 0.1s',
                    borderBottom: i < filtered.length-1 ? `1px solid ${T.border}` : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--row-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:T.hi }}>
                      {c.proveedores?.nombre || '—'}
                    </div>
                    <div style={{ fontSize:11, color:T.lo, marginTop:2 }}>
                      {c.numero_factura ? `#${c.numero_factura} · ` : ''}
                      {TIPO_DOC_LABEL[c.tipo_documento] || c.tipo_documento}
                      {c.cadena_frio ? ' · ❄' : ''}
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:T.mid }}>{fmtDate(c.fecha_recepcion)}</div>
                  {showSede && <div style={{ fontSize:12, color:T.mid }}>{c.sedes?.nombre||'—'}</div>}
                  <div style={{ fontSize:13, fontWeight:700, color:T.hi }}>{fmtQ(c.monto_total)}</div>
                  <div>
                    {c.tipo_pago==='credito'
                      ? <span style={{ background:'rgba(99,102,241,0.15)', color:'#818CF8', border:'1px solid rgba(99,102,241,0.35)', padding:'3px 8px', borderRadius:12, fontSize:11, fontWeight:600 }}>Crédito</span>
                      : <span style={{ background:T.okBg, color:T.ok, padding:'3px 8px', borderRadius:12, fontSize:11, fontWeight:600 }}>Contado</span>}
                  </div>
                  <div>
                    {c.tipo_pago==='credito'
                      ? <VencBadge fecha={c.fecha_vencimiento}/>
                      : <span style={{ color:T.lo, fontSize:12 }}>—</span>}
                  </div>
                  <span style={{ color:T.lo, fontSize:13, display:'flex', alignItems:'center',
                    justifyContent:'center' }}>›</span>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)}
        title="Registrar compra" maxWidth={560}>
        <NuevaCompraModal
          profile={profile} sedes={sedes}
          onSave={load}
          onClose={() => setShowModal(false)}
          onGoProveedores={() => setTab('proveedores')}/>
      </Modal>
    </div>
  );
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div style={{ flex:1, background:T.surface, borderRadius:12, border:`1px solid ${T.border}`,
      padding:'16px 20px' }}>
      <div style={{ fontSize:11, fontWeight:700, color:T.lo, textTransform:'uppercase',
        letterSpacing:'0.07em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, color:accent||T.hi }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:T.lo, marginTop:3 }}>{sub}</div>}
    </div>
  );
}
