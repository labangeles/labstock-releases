import { useState, useEffect } from 'react';
import { T, Btn, Field, TInput, TSelect } from '../../../shared/ui';

const CATEGORIAS = [
  { value:'operativo',    label:'Operativo' },
  { value:'mantenimiento',label:'Mantenimiento' },
  { value:'transporte',   label:'Transporte' },
  { value:'papeleria',    label:'Papelería' },
  { value:'limpieza',     label:'Limpieza' },
  { value:'extra',        label:'Extra' },
  { value:'otro',         label:'Otro' },
];

export function GastoModal({ onSave, onClose, saving }) {
  const [f, setF] = useState({ descripcion:'', categoria:'operativo', monto:'', comprobante:'' });
  const [err, setErr] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!saving) setSubmitting(false); }, [saving]);

  const set = (k, v) => { setF(p=>({...p,[k]:v})); setErr(e=>({...e,[k]:null})); };

  const validate = () => {
    const e = {};
    if (!f.descripcion.trim()) e.descripcion = 'Requerido';
    const m = parseFloat(f.monto.replace(',','.'));
    if (isNaN(m) || m <= 0) e.monto = 'Debe ser mayor a 0';
    setErr(e);
    return !Object.keys(e).length;
  };

  const handleSave = () => {
    if (submitting || saving) return;
    if (!validate()) return;
    setSubmitting(true);
    onSave({
      descripcion: f.descripcion.trim(),
      categoria:   f.categoria,
      monto:       parseFloat(f.monto.replace(',','.')),
      comprobante: f.comprobante.trim() || null,
    });
  };

  return (
    <div>
      <Field label="Descripción del gasto" error={err.descripcion}>
        <TInput value={f.descripcion} onChange={e=>set('descripcion',e.target.value)}
          placeholder="Ej: Compra de papel bond" focusOnMount />
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="Categoría">
          <TSelect value={f.categoria} onChange={e=>set('categoria',e.target.value)}
            options={CATEGORIAS} />
        </Field>
        <Field label="Monto (Q)" error={err.monto}>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)',
              fontSize:13, fontWeight:700, color:T.tealDk, pointerEvents:'none' }}>Q</span>
            <input type="text" inputMode="numeric" value={f.monto}
              onChange={e=>set('monto',e.target.value)}
              placeholder="0.00"
              style={{ width:'100%', padding:'8px 11px 8px 26px',
                border:`1px solid ${err.monto?T.crit:T.border}`,
                borderRadius:8, fontFamily:'inherit', fontSize:13, color:T.hi,
                background:'var(--input-bg)', outline:'none', boxSizing:'border-box' }} />
          </div>
        </Field>
      </div>
      <Field label="No. comprobante (opcional)">
        <TInput value={f.comprobante} onChange={e=>set('comprobante',e.target.value)}
          placeholder="Ej: FAC-00123" />
      </Field>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving || submitting}>Guardar gasto</Btn>
      </div>
    </div>
  );
}
