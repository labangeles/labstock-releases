import { useState, useEffect, useCallback } from 'react';
import { T, Ico, Btn, IconBtn, Modal, Field, TInput, fmtQ } from '../../shared/ui';
import { supabase } from '../../lib/supabase';

/* ── constantes ────────────────────────────────────────────── */
const CATS   = ['Alquiler','Personal','Servicios básicos','Comunicaciones','Seguros','Otros'];
const BANCOS = [
  'Banrural','Banco Industrial (BI)','G&T Continental','Banco Agromercantil (BAM)',
  'BAC Guatemala','Banco de los Trabajadores (Bantrab)','Banco Reformador',
  'Banco Inmobiliario','Banco de Antigua','Banco Internacional','Ficohsa Guatemala',
  'Banco Promerica','Vivibanco','Bancréito','Banpaís',
];
const MESES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS   = Array.from({length:31}, (_,i) => ({ value:String(i+1), label:`Día ${i+1}` }));

const selStyle = {
  padding:'7px 13px', border:`1px solid ${T.border}`, borderRadius:8,
  fontFamily:'inherit', fontSize:13, color:T.hi, background:T.surface,
  outline:'none', cursor:'pointer',
};
const fmtFecha = iso => iso
  ? new Date(iso+'T12:00:00').toLocaleDateString('es-GT',{day:'2-digit',month:'short',year:'numeric'})
  : '—';

/* ── StatMini ──────────────────────────────────────────────── */
function StatMini({label, value, color, bg}) {
  return (
    <div style={{background:bg, borderRadius:10, padding:'12px 16px', border:`1px solid ${color}33`}}>
      <div style={{fontSize:10.5, fontWeight:700, color, textTransform:'uppercase',
        letterSpacing:'0.07em', marginBottom:4}}>{label}</div>
      <div style={{fontSize:17, fontWeight:800, color}}>{value}</div>
    </div>
  );
}

/* ── Sel ────────────────────────────────────────────────────── */
function Sel({label, value, onChange, children, hint}) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:'block', fontSize:12, fontWeight:600, color:T.mid, marginBottom:5}}>
        {label}{hint&&<span style={{fontWeight:400,color:T.lo,marginLeft:6}}>{hint}</span>}
      </label>
      <select value={value} onChange={onChange}
        style={{width:'100%', padding:'8px 11px', border:`1px solid ${T.border}`, borderRadius:8,
          fontFamily:'inherit', fontSize:13, color:T.hi, background:'var(--input-bg)',
          outline:'none', boxSizing:'border-box', cursor:'pointer'}}>
        {children}
      </select>
    </div>
  );
}

/* ── Export CSV ─────────────────────────────────────────────── */
function exportChecklist(items, sedes, mes, anio) {
  const mesNombre = MESES[mes - 1];
  const sedeName  = id => id ? (sedes.find(s => s.id === id)?.nombre || '—') : 'General';
  const headers   = ['Nombre','Categoría','Sede','Monto Mensual (Q)','Estado','Fecha Pago',
    'Monto Pagado (Q)','Método','Comprobante','Beneficiario','Banco','No. Cuenta','Notas'];
  const rows = items.map(({ gasto, pago }) => [
    gasto.nombre, gasto.categoria, sedeName(gasto.sede_id),
    gasto.monto_mensual,
    pago?.pagado ? 'Pagado' : 'Pendiente',
    pago?.fecha_pago || '',
    pago?.monto_pagado || '',
    pago?.metodo_pago || '',
    pago?.comprobante || '',
    gasto.beneficiario || '',
    gasto.banco || '',
    gasto.numero_cuenta || '',
    pago?.notas || '',
  ]);
  const csv = 'sep=,\r\n' + [headers, ...rows]
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `Gastos_Fijos_${mesNombre}_${anio}.csv`; a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════════════════════════
   TAB 1 — CHECKLIST DEL MES
══════════════════════════════════════════════════════════════ */
function ChecklistTab({ profile, sedes, readOnly }) {
  const now = new Date();
  const [mes,      setMes]      = useState(now.getMonth() + 1);
  const [anio,     setAnio]     = useState(now.getFullYear());
  const [filSede,  setFilSede]  = useState('');
  const [items,    setItems]    = useState([]);
  const [loading,  setLoad]     = useState(false);
  const [pagoModal,setPagoModal]= useState(null); // { gasto, pago }
  const [pagoForm, setPagoForm] = useState({});
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoad(true);

    let q = supabase.from('gastos_fijos').select('*').eq('activo', true);
    if (filSede) q = q.eq('sede_id', filSede);
    const { data: gastos } = await q;

    if (!gastos || gastos.length === 0) { setItems([]); setLoad(false); return; }

    const gastoIds = gastos.map(g => g.id);
    const { data: pagos } = await supabase
      .from('gastos_fijos_pagos')
      .select('*')
      .in('gasto_fijo_id', gastoIds)
      .eq('mes', mes).eq('anio', anio);

    const pagoMap = {};
    for (const p of (pagos || [])) pagoMap[p.gasto_fijo_id] = p;

    // Auto-crear registros para los que no tienen pago este mes (solo admin)
    if (!readOnly) {
      const missing = gastos.filter(g => !pagoMap[g.id]);
      if (missing.length > 0) {
        const inserts = missing.map(g => ({
          gasto_fijo_id:   g.id,
          organizacion_id: g.organizacion_id,
          sede_id:         g.sede_id,
          mes, anio,
          pagado: false,
        }));
        const { data: created } = await supabase
          .from('gastos_fijos_pagos').insert(inserts).select();
        for (const p of (created || [])) pagoMap[p.gasto_fijo_id] = p;
      }
    }

    const combined = gastos.map(g => ({ gasto: g, pago: pagoMap[g.id] || null }));
    combined.sort((a, b) => {
      if (!!a.pago?.pagado !== !!b.pago?.pagado) return a.pago?.pagado ? 1 : -1;
      return (a.gasto.dia_vencimiento || 99) - (b.gasto.dia_vencimiento || 99);
    });

    setItems(combined);
    setLoad(false);
  }, [mes, anio, filSede]);

  useEffect(() => { load(); }, [load]);

  const openPago = ({ gasto, pago }) => {
    setPagoForm({
      fecha_pago:   new Date().toISOString().split('T')[0],
      monto_pagado: String(gasto.monto_mensual),
      metodo_pago:  gasto.tipo_pago || 'efectivo',
      comprobante:  '',
      notas:        '',
    });
    setPagoModal({ gasto, pago });
  };

  const confirmarPago = async () => {
    if (!pagoModal?.pago) return;
    setSaving(true);
    const monto = parseFloat(pagoForm.monto_pagado);
    await supabase.from('gastos_fijos_pagos').update({
      pagado:         true,
      fecha_pago:     pagoForm.fecha_pago || null,
      monto_pagado:   isNaN(monto) ? pagoModal.gasto.monto_mensual : monto,
      metodo_pago:    pagoForm.metodo_pago,
      comprobante:    pagoForm.comprobante || null,
      notas:          pagoForm.notas || null,
      registrado_por: profile.id,
    }).eq('id', pagoModal.pago.id);
    setSaving(false);
    setPagoModal(null);
    load();
  };

  const desmarcar = async (pago) => {
    if (!window.confirm('¿Desmarcar este pago? Se borrará la información registrada.')) return;
    await supabase.from('gastos_fijos_pagos').update({
      pagado:false, fecha_pago:null, monto_pagado:null,
      metodo_pago:null, comprobante:null, notas:null, registrado_por:null,
    }).eq('id', pago.id);
    load();
  };

  const sedeName = id => id ? (sedes.find(s => s.id === id)?.nombre || '—') : 'General';
  const nPagados   = items.filter(i => i.pago?.pagado).length;
  const nPendientes = items.filter(i => !i.pago?.pagado).length;
  const totalPagado    = items.filter(i => i.pago?.pagado)
    .reduce((s,i) => s + Number(i.pago.monto_pagado || i.gasto.monto_mensual), 0);
  const totalPendiente = items.filter(i => !i.pago?.pagado)
    .reduce((s,i) => s + Number(i.gasto.monto_mensual), 0);

  const anios = [now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1];

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Filtros */}
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',
        background:T.surface,borderRadius:10,padding:'11px 16px',border:`1px solid ${T.border}`}}>
        <Ico.Calendar s={14} c={T.lo}/>
        <select value={mes} onChange={e=>setMes(Number(e.target.value))} style={selStyle}>
          {MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={anio} onChange={e=>setAnio(Number(e.target.value))} style={selStyle}>
          {anios.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{width:1,height:22,background:T.border,margin:'0 2px'}}/>
        <Ico.Map s={14} c={T.lo}/>
        <select value={filSede} onChange={e=>setFilSede(e.target.value)} style={selStyle}>
          <option value="">Todas las sedes</option>
          {sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <div style={{marginLeft:'auto'}}>
          <Btn variant="secondary" size="sm" icon={<Ico.Download s={13}/>}
            onClick={()=>exportChecklist(items, sedes, mes, anio)}
            disabled={items.length===0}>
            Exportar CSV
          </Btn>
        </div>
      </div>

      {/* Stats */}
      {!loading && items.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          <StatMini label="Pagados"         value={`${nPagados} de ${items.length}`}  color={T.ok}   bg={T.okBg}/>
          <StatMini label="Pendientes"      value={nPendientes}                         color={T.warn} bg={T.warnBg}/>
          <StatMini label="Total pagado"    value={fmtQ(totalPagado)}                  color={T.ok}   bg={T.okBg}/>
          <StatMini label="Total pendiente" value={fmtQ(totalPendiente)}                color={T.warn} bg={T.warnBg}/>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{textAlign:'center',padding:'48px 0',color:T.lo}}>Cargando {MESES[mes-1]} {anio}…</div>
      ) : items.length === 0 ? (
        <div style={{textAlign:'center',padding:'56px 20px',background:T.surface,
          borderRadius:12,border:`1px solid ${T.border}`}}>
          <div style={{fontSize:13.5,fontWeight:600,color:T.mid}}>Sin gastos fijos configurados</div>
          <div style={{fontSize:12.5,color:T.lo,marginTop:6}}>
            Ve a la pestaña <strong>Configurar gastos</strong> para agregar costos fijos.
          </div>
        </div>
      ) : items.map(({gasto, pago}) => {
        const pagado = !!pago?.pagado;
        return (
          <div key={gasto.id}
            style={{background:T.surface, border:`1px solid ${T.border}`,
              borderLeft:`4px solid ${pagado ? T.ok : T.warn}`,
              borderRadius:12, padding:'14px 18px',
              display:'flex', alignItems:'flex-start', gap:16}}>

            {/* Ícono check/pending */}
            <div style={{width:34,height:34,borderRadius:'50%',flexShrink:0,
              background:pagado ? T.okBg : T.warnBg,
              display:'flex',alignItems:'center',justifyContent:'center',marginTop:2}}>
              {pagado
                ? <Ico.Check s={16} c={T.ok}/>
                : <Ico.DollarSign s={15} c={T.warn}/>}
            </div>

            {/* Información principal */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                <span style={{fontSize:14,fontWeight:600,color:T.hi}}>{gasto.nombre}</span>
                <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                  background:T.canvas,color:T.lo}}>{gasto.categoria}</span>
                <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                  background:T.tealXL,color:T.tealDk,fontWeight:500}}>{sedeName(gasto.sede_id)}</span>
                {gasto.dia_vencimiento && (
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                    background:'#FFF0D0',color:T.warn,fontWeight:600}}>
                    Vence el día {gasto.dia_vencimiento}
                  </span>
                )}
              </div>

              {/* Datos del proveedor/beneficiario */}
              <div style={{display:'flex',gap:14,marginTop:5,flexWrap:'wrap',alignItems:'center'}}>
                {gasto.beneficiario && (
                  <span style={{fontSize:12.5,color:T.mid,display:'flex',alignItems:'center',gap:4}}>
                    <span style={{fontSize:10,color:T.lo}}>A:</span> {gasto.beneficiario}
                  </span>
                )}
                {gasto.tipo_pago === 'transferencia' && (
                  <>
                    {gasto.banco && (
                      <span style={{fontSize:12,color:T.mid,display:'flex',alignItems:'center',gap:4}}>
                        <span style={{fontSize:10,color:T.lo}}>Banco:</span> {gasto.banco}
                      </span>
                    )}
                    {gasto.numero_cuenta && (
                      <span style={{fontSize:12,color:T.mid,display:'flex',alignItems:'center',gap:4}}>
                        <span style={{fontSize:10,color:T.lo}}>Cta:</span>
                        <span style={{fontFamily:'monospace',letterSpacing:'0.03em'}}>{gasto.numero_cuenta}</span>
                      </span>
                    )}
                  </>
                )}
                <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                  background:gasto.tipo_pago==='transferencia'?'#EEF2FF':'#F0FDF4',
                  color:gasto.tipo_pago==='transferencia'?'#3730A3':T.ok,
                  fontWeight:500,textTransform:'capitalize'}}>
                  {gasto.tipo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                </span>
              </div>

              {/* Detalle del pago registrado */}
              {pagado && (
                <div style={{marginTop:10,background:T.okBg,borderRadius:8,
                  padding:'8px 12px',display:'flex',gap:14,flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:12,fontWeight:700,color:T.ok}}>
                    ✓ Pagado el {fmtFecha(pago.fecha_pago)}
                  </span>
                  <span style={{fontSize:12,color:T.ok,fontWeight:600}}>
                    {fmtQ(pago.monto_pagado || gasto.monto_mensual)}
                  </span>
                  {pago.metodo_pago && (
                    <span style={{fontSize:11,color:T.ok,textTransform:'capitalize'}}>
                      · {pago.metodo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                    </span>
                  )}
                  {pago.comprobante && (
                    <span style={{fontSize:11,color:T.ok}}>
                      · Ref: <strong>{pago.comprobante}</strong>
                    </span>
                  )}
                  {pago.notas && (
                    <span style={{fontSize:11,color:T.ok,fontStyle:'italic'}}>· {pago.notas}</span>
                  )}
                </div>
              )}

              {gasto.notas && !pagado && (
                <div style={{marginTop:6,fontSize:11.5,color:T.lo,fontStyle:'italic'}}>
                  {gasto.notas}
                </div>
              )}
            </div>

            {/* Monto + acción */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',
              gap:10,flexShrink:0,minWidth:100}}>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:18,fontWeight:800,color:pagado?T.ok:T.hi,lineHeight:1}}>
                  {fmtQ(gasto.monto_mensual)}
                </div>
                <div style={{fontSize:10.5,color:T.lo,marginTop:2}}>mensual</div>
              </div>
              {!readOnly && (pagado ? (
                <button onClick={()=>desmarcar(pago)}
                  style={{fontSize:11,color:T.lo,background:'none',border:'none',
                    cursor:'pointer',textDecoration:'underline',padding:0,fontFamily:'inherit'}}>
                  Desmarcar
                </button>
              ) : (
                <Btn size="sm" onClick={()=>openPago({gasto,pago})}
                  icon={<Ico.Check s={12}/>}>
                  Marcar pagado
                </Btn>
              ))}
            </div>
          </div>
        );
      })}

      {/* Modal: Registrar pago */}
      <Modal open={!!pagoModal} onClose={()=>setPagoModal(null)}
        title={pagoModal ? `Registrar pago — ${pagoModal.gasto.nombre}` : ''} maxWidth={440}>
        {pagoModal && (
          <>
            {/* Resumen del gasto */}
            <div style={{background:T.canvas,borderRadius:10,padding:'12px 16px',marginBottom:18}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:11,color:T.lo,marginBottom:3}}>Monto mensual configurado</div>
                  <div style={{fontSize:20,fontWeight:800,color:T.hi}}>
                    {fmtQ(pagoModal.gasto.monto_mensual)}
                  </div>
                </div>
                {pagoModal.gasto.beneficiario && (
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:11,color:T.lo,marginBottom:2}}>Beneficiario</div>
                    <div style={{fontSize:13,fontWeight:600,color:T.hi}}>{pagoModal.gasto.beneficiario}</div>
                    {pagoModal.gasto.banco && (
                      <div style={{fontSize:11.5,color:T.mid}}>{pagoModal.gasto.banco}</div>
                    )}
                    {pagoModal.gasto.numero_cuenta && (
                      <div style={{fontSize:11,color:T.lo,fontFamily:'monospace'}}>
                        {pagoModal.gasto.numero_cuenta}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Field label="Fecha de pago">
                <TInput type="date" value={pagoForm.fecha_pago}
                  onChange={e=>setPagoForm(f=>({...f,fecha_pago:e.target.value}))}/>
              </Field>
              <Field label="Monto pagado (Q)" hint="Si difiere del configurado">
                <TInput type="number" min="0" step="0.01"
                  value={pagoForm.monto_pagado}
                  onChange={e=>setPagoForm(f=>({...f,monto_pagado:e.target.value}))}/>
              </Field>
            </div>

            <Sel label="Método de pago"
              value={pagoForm.metodo_pago}
              onChange={e=>setPagoForm(f=>({...f,metodo_pago:e.target.value}))}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia bancaria</option>
              <option value="cheque">Cheque</option>
            </Sel>

            <Field label="Comprobante / No. de referencia"
              hint="Boleta, no. de transacción, cheque…">
              <TInput value={pagoForm.comprobante}
                onChange={e=>setPagoForm(f=>({...f,comprobante:e.target.value}))}
                placeholder="Ej: TRF-2026-001234"/>
            </Field>

            <Field label="Notas (opcional)">
              <TInput value={pagoForm.notas}
                onChange={e=>setPagoForm(f=>({...f,notas:e.target.value}))}
                placeholder="Observación adicional…"/>
            </Field>

            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
              <Btn variant="secondary" onClick={()=>setPagoModal(null)}>Cancelar</Btn>
              <Btn onClick={confirmarPago} disabled={saving} icon={<Ico.Check s={14}/>}>
                {saving ? 'Guardando…' : 'Confirmar pago'}
              </Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB 2 — CONFIGURAR GASTOS FIJOS (plantillas)
══════════════════════════════════════════════════════════════ */
const emptyForm = {
  nombre:'', categoria:CATS[0], sede_id:'',
  monto_mensual:'', tipo_pago:'efectivo',
  beneficiario:'', banco:'', numero_cuenta:'',
  dia_vencimiento:'', notas:'',
};

function ConfigTab({ profile, sedes }) {
  const [items,  setItems]  = useState([]);
  const [loading,setLoad]   = useState(true);
  const [modal,  setModal]  = useState(null); // null | 'add' | item_object
  const [form,   setForm]   = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const load = async () => {
    setLoad(true);
    const { data } = await supabase.from('gastos_fijos').select('*')
      .order('sede_id',{nullsFirst:true}).order('categoria').order('nombre');
    setItems(data || []);
    setLoad(false);
  };

  useEffect(() => { load(); }, []);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const openAdd = () => { setForm(emptyForm); setErr(''); setModal('add'); };
  const openEdit = item => {
    setForm({
      nombre:         item.nombre,
      categoria:      item.categoria,
      sede_id:        item.sede_id || '',
      monto_mensual:  String(item.monto_mensual),
      tipo_pago:      item.tipo_pago || 'efectivo',
      beneficiario:   item.beneficiario || '',
      banco:          item.banco || '',
      numero_cuenta:  item.numero_cuenta || '',
      dia_vencimiento:item.dia_vencimiento ? String(item.dia_vencimiento) : '',
      notas:          item.notas || '',
    });
    setErr(''); setModal(item);
  };

  const save = async () => {
    setErr('');
    if (!form.nombre.trim()) { setErr('El nombre es obligatorio.'); return; }
    const monto = parseFloat(form.monto_mensual);
    if (isNaN(monto) || monto < 0) { setErr('Monto inválido.'); return; }

    setSaving(true);
    const row = {
      nombre:          form.nombre.trim(),
      categoria:       form.categoria,
      sede_id:         form.sede_id || null,
      monto_mensual:   monto,
      tipo_pago:       form.tipo_pago,
      beneficiario:    form.beneficiario.trim() || null,
      banco:           form.tipo_pago==='transferencia' ? (form.banco.trim() || null) : null,
      numero_cuenta:   form.tipo_pago==='transferencia' ? (form.numero_cuenta.trim() || null) : null,
      dia_vencimiento: form.dia_vencimiento ? parseInt(form.dia_vencimiento) : null,
      notas:           form.notas.trim() || null,
      organizacion_id: profile.organizacion_id,
    };

    const isNew = modal === 'add';
    const { error } = isNew
      ? await supabase.from('gastos_fijos').insert(row)
      : await supabase.from('gastos_fijos').update(row).eq('id', modal.id);

    setSaving(false);
    if (error) { setErr(error.message); return; }
    setModal(null); load();
  };

  const toggleActivo = async item => {
    await supabase.from('gastos_fijos').update({activo:!item.activo}).eq('id',item.id);
    load();
  };

  const del = async item => {
    if (!window.confirm(`¿Eliminar "${item.nombre}"?\nSe borrarán también los registros de pago.`)) return;
    await supabase.from('gastos_fijos').delete().eq('id', item.id);
    load();
  };

  const sedeName = id => id ? (sedes.find(s=>s.id===id)?.nombre||'—') : 'Todas las sedes';
  const totalActivo = items.filter(i=>i.activo).reduce((s,i)=>s+Number(i.monto_mensual),0);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <p style={{fontSize:12.5,color:T.lo,margin:0}}>
          Total activo: <strong style={{color:T.hi}}>{fmtQ(totalActivo)}/mes</strong>
        </p>
        <Btn icon={<Ico.Plus s={14}/>} onClick={openAdd}>Agregar gasto fijo</Btn>
      </div>

      <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,
        padding:'9px 14px',fontSize:12.5,color:'#1D4ED8',display:'flex',gap:8}}>
        <span>ℹ</span>
        <span>
          Configura cada gasto <strong>una sola vez</strong>. El sistema generará
          automáticamente el checklist cada mes al abrir la pestaña anterior.
        </span>
      </div>

      <div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1.2fr 0.9fr 1.2fr 90px 64px',
          padding:'8px 18px',borderBottom:`1px solid ${T.border}`,background:'var(--table-head-bg)'}}>
          {['Nombre','Categoría','Sede','Monto/mes','Pago / Beneficiario','Estado',''].map((h,i)=>(
            <span key={i} style={{fontSize:10.5,fontWeight:700,color:T.lo,
              textTransform:'uppercase',letterSpacing:'0.07em'}}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{padding:'40px 0',textAlign:'center',color:T.lo}}>Cargando…</div>
        ) : items.length === 0 ? (
          <div style={{padding:'56px 20px',textAlign:'center'}}>
            <div style={{fontSize:13.5,fontWeight:600,color:T.mid}}>Sin gastos fijos</div>
            <div style={{fontSize:12.5,color:T.lo,marginTop:5}}>
              Agrega los costos fijos mensuales: alquiler, salarios, servicios…
            </div>
          </div>
        ) : items.map((item,i)=>(
          <div key={item.id}
            style={{display:'grid',gridTemplateColumns:'2fr 1fr 1.2fr 0.9fr 1.2fr 90px 64px',
              padding:'11px 18px',alignItems:'center',
              borderBottom:i<items.length-1?`1px solid ${T.border}`:'none',
              opacity:item.activo?1:0.5}}>
            <div>
              <div style={{fontSize:13,fontWeight:500,color:T.hi}}>{item.nombre}</div>
              {item.dia_vencimiento && (
                <div style={{fontSize:11,color:T.lo,marginTop:1}}>Vence el día {item.dia_vencimiento}</div>
              )}
            </div>
            <span style={{fontSize:12,color:T.mid}}>{item.categoria}</span>
            <span style={{fontSize:12,color:T.mid}}>{sedeName(item.sede_id)}</span>
            <span style={{fontSize:13.5,fontWeight:700,color:T.hi}}>{fmtQ(item.monto_mensual)}</span>
            <div>
              <div style={{fontSize:11.5,color:T.mid,textTransform:'capitalize',marginBottom:1}}>
                {item.tipo_pago==='transferencia'?'Transferencia':'Efectivo'}
              </div>
              {item.beneficiario && (
                <div style={{fontSize:11,color:T.lo}}>{item.beneficiario}</div>
              )}
              {item.banco && (
                <div style={{fontSize:11,color:T.lo}}>{item.banco}</div>
              )}
            </div>
            <button onClick={()=>toggleActivo(item)}
              style={{padding:'3px 10px',borderRadius:20,border:'none',cursor:'pointer',
                fontFamily:'inherit',fontSize:11.5,fontWeight:600,
                background:item.activo?T.okBg:T.canvas,color:item.activo?T.ok:T.lo}}>
              {item.activo?'Activo':'Inactivo'}
            </button>
            <div style={{display:'flex',gap:2,justifyContent:'flex-end'}}>
              <IconBtn icon={<Ico.Edit s={13}/>} onClick={()=>openEdit(item)}/>
              <IconBtn icon={<Ico.Trash s={13}/>} danger onClick={()=>del(item)}/>
            </div>
          </div>
        ))}
      </div>

      {/* Modal agregar/editar */}
      <Modal open={!!modal} onClose={()=>setModal(null)}
        title={modal==='add'?'Agregar gasto fijo':'Editar gasto fijo'} maxWidth={480}>

        <Field label="Nombre del gasto">
          <TInput value={form.nombre} onChange={e=>set('nombre',e.target.value)}
            placeholder="Ej: Alquiler del local, Internet, Planilla guardia…" focusOnMount/>
        </Field>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Sel label="Categoría" value={form.categoria} onChange={e=>set('categoria',e.target.value)}>
            {CATS.map(c=><option key={c} value={c}>{c}</option>)}
          </Sel>
          <Sel label="Sede" value={form.sede_id} onChange={e=>set('sede_id',e.target.value)}
            hint="Vacío = costo general">
            <option value="">Todas las sedes</option>
            {sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Sel>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Field label="Monto mensual (Q)">
            <TInput type="number" min="0" step="0.01" value={form.monto_mensual}
              onChange={e=>set('monto_mensual',e.target.value)} placeholder="Ej: 2500.00"/>
          </Field>
          <Sel label="Día de vencimiento" value={form.dia_vencimiento}
            onChange={e=>set('dia_vencimiento',e.target.value)} hint="Opcional">
            <option value="">Sin fecha fija</option>
            {DIAS.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}
          </Sel>
        </div>

        {/* Separador */}
        <div style={{borderTop:`1px solid ${T.border}`,margin:'4px 0 14px',paddingTop:14}}>
          <div style={{fontSize:10.5,fontWeight:700,color:T.lo,textTransform:'uppercase',
            letterSpacing:'0.07em',marginBottom:12}}>Información de pago</div>

          <Sel label="Método de pago" value={form.tipo_pago} onChange={e=>set('tipo_pago',e.target.value)}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia bancaria</option>
            <option value="cheque">Cheque</option>
          </Sel>

          <Field label="Beneficiario / A nombre de">
            <TInput value={form.beneficiario} onChange={e=>set('beneficiario',e.target.value)}
              placeholder="Ej: Inmobiliaria López, Claro Guatemala…"/>
          </Field>

          {form.tipo_pago === 'transferencia' && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Sel label="Banco" value={form.banco} onChange={e=>set('banco',e.target.value)}>
                <option value="">Seleccionar banco…</option>
                {BANCOS.map(b=><option key={b} value={b}>{b}</option>)}
              </Sel>
              <Field label="No. de cuenta">
                <TInput value={form.numero_cuenta} onChange={e=>set('numero_cuenta',e.target.value)}
                  placeholder="Ej: 3-123-456789-0"/>
              </Field>
            </div>
          )}
        </div>

        <Field label="Notas (opcional)">
          <TInput value={form.notas} onChange={e=>set('notas',e.target.value)}
            placeholder="Observaciones, instrucciones especiales…"/>
        </Field>

        {err && (
          <div style={{background:T.critBg,borderRadius:8,padding:'9px 12px',
            fontSize:12.5,color:T.crit,marginBottom:12}}>{err}</div>
        )}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <Btn variant="secondary" onClick={()=>setModal(null)}>Cancelar</Btn>
          <Btn onClick={save} disabled={saving} icon={<Ico.Check s={14}/>}>
            {saving?'Guardando…':'Guardar'}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PANTALLA PRINCIPAL
══════════════════════════════════════════════════════════════ */
export function GastosFijosScreen({ profile, sedes, readOnly = false }) {
  const [tab, setTab] = useState('checklist');

  const tabs = [
    { id:'checklist', label:'Checklist del mes' },
    ...(!readOnly ? [{ id:'config', label:'Configurar gastos' }] : []),
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>

      {/* Encabezado */}
      <div>
        <h1 style={{fontSize:21,fontWeight:700,color:T.hi,letterSpacing:'-0.025em',margin:0}}>
          Gastos Fijos
        </h1>
        <p style={{fontSize:12.5,color:T.lo,marginTop:4}}>
          Seguimiento mensual de costos fijos por sede
          {readOnly && <span style={{marginLeft:8,padding:'2px 8px',borderRadius:20,
            background:'#EEF2FF',color:'#3730A3',fontSize:11,fontWeight:600}}>Solo lectura</span>}
        </p>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:0,borderBottom:`1px solid ${T.border}`}}>
        {tabs.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'9px 20px',background:'none',border:'none',cursor:'pointer',
              fontFamily:'inherit',fontSize:13.5,fontWeight:tab===t.id?600:400,
              color:tab===t.id?T.tealDk:T.mid,
              borderBottom:`2px solid ${tab===t.id?T.teal:'transparent'}`,
              marginBottom:-1}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'checklist' && <ChecklistTab profile={profile} sedes={sedes} readOnly={readOnly}/>}
      {tab === 'config'    && <ConfigTab    profile={profile} sedes={sedes}/>}
    </div>
  );
}
