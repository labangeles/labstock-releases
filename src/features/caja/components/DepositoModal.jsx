import { useState } from 'react';
import { T, Btn, Field, TInput } from '../../../shared/ui';

const BANCOS = ['Banrural','Banco Industrial','G&T Continental','Bantrab','BAC Credomatic','Otro'];

export function DepositoModal({ onSave, onClose, saving }) {
  const [f, setF] = useState({ banco:'Banrural', no_boleta:'', monto:'' });
  const [err, setErr] = useState({});

  const set = (k, v) => { setF(p=>({...p,[k]:v})); setErr(e=>({...e,[k]:null})); };

  const validate = () => {
    const e = {};
    if (!f.banco.trim()) e.banco = 'Requerido';
    if (!f.no_boleta.trim()) e.no_boleta = 'Requerido';
    const m = parseFloat(f.monto.replace(',','.'));
    if (isNaN(m) || m <= 0) e.monto = 'Debe ser mayor a 0';
    setErr(e);
    return !Object.keys(e).length;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      banco:     f.banco.trim(),
      no_boleta: f.no_boleta.trim(),
      monto:     parseFloat(f.monto.replace(',','.')),
    });
  };

  return (
    <div>
      <Field label="Banco" error={err.banco}>
        <select value={f.banco} onChange={e=>set('banco',e.target.value)}
          style={{ width:'100%', padding:'8px 11px', border:`1px solid ${err.banco?T.crit:T.border}`,
            borderRadius:8, fontFamily:'inherit', fontSize:13, color:T.hi,
            background:'var(--input-bg)', outline:'none', boxSizing:'border-box', cursor:'pointer' }}>
          {BANCOS.map(b=><option key={b} value={b}>{b}</option>)}
        </select>
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Field label="No. de boleta" error={err.no_boleta}>
          <TInput value={f.no_boleta} onChange={e=>set('no_boleta',e.target.value)}
            placeholder="Ej: 0001234567" focusOnMount />
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
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving}>Guardar depósito</Btn>
      </div>
    </div>
  );
}
