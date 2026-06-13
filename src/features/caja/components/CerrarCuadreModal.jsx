import { useState } from 'react';
import { T, Ico, Btn, Field, fmtQ } from '../../../shared/ui';

function Row({ label, value, accent, border }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0',
      borderBottom: border ? `1px solid ${T.border}` : 'none' }}>
      <span style={{ fontSize:13, color:T.mid }}>{label}</span>
      <span style={{ fontSize:13.5, fontWeight:600, color: accent || T.hi }}>{fmtQ(value)}</span>
    </div>
  );
}

export function CerrarCuadreModal({ cuadre, cajaBase, ingresoNum, totalGastos,
  totalDepositos, cajaFinal, diferencia, onCerrar, onClose, saving }) {

  const [notas, setNotas] = useState('');
  const [err, setErr]     = useState('');

  const hayDiferencia = diferencia !== 0;

  const handleCerrar = () => {
    if (hayDiferencia && !notas.trim()) {
      setErr('Debes explicar el sobrante/faltante antes de cerrar.');
      return;
    }
    onCerrar(notas.trim() || null);
  };

  const semLabel = diferencia === 0 ? null
    : diferencia > 0 ? `Sobrante de ${fmtQ(diferencia)}`
    : `Faltante de ${fmtQ(Math.abs(diferencia))}`;

  const semColor = diferencia > 0 ? T.warn : T.crit;

  return (
    <div>
      <p style={{ fontSize:13, color:T.mid, marginBottom:16 }}>
        Revisa el resumen antes de cerrar. Una vez cerrado,{' '}
        <strong>no se podrán agregar ni editar</strong> gastos, depósitos ni el ingreso.
        Solo un administrador puede reabrir el cuadre.
      </p>

      <div style={{ background:T.canvas, borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
        <Row label="Caja base"        value={cajaBase}        border />
        <Row label="+ Ingreso 4DLab"  value={ingresoNum}  accent={T.ok} border />
        <Row label="− Gastos"         value={totalGastos} accent={T.crit} border />
        <Row label="− Depósitos"      value={totalDepositos} accent='#7C3AED' border />
        <div style={{ margin:'8px 0 4px', borderTop:`2px solid ${T.border}` }}/>
        <Row label="Caja final"       value={cajaFinal} />
      </div>

      {/* Semáforo */}
      {diferencia === 0 ? (
        <div style={{ background:T.okBg, borderRadius:8, padding:'10px 14px',
          display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <Ico.Check s={16} c={T.ok}/>
          <span style={{ fontSize:13, fontWeight:600, color:T.ok }}>
            Cuadre perfecto — la caja está exacta
          </span>
        </div>
      ) : (
        <div style={{ background: diferencia>0 ? T.warnBg : T.critBg, borderRadius:8,
          padding:'10px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <Ico.Warn s={16} c={semColor}/>
          <span style={{ fontSize:13, fontWeight:600, color:semColor }}>{semLabel}</span>
        </div>
      )}

      {/* Nota obligatoria si hay diferencia */}
      {hayDiferencia && (
        <Field label="Nota explicativa (obligatoria)" error={err}>
          <textarea value={notas} onChange={e=>{setNotas(e.target.value);setErr('');}}
            placeholder="Explica por qué hay diferencia en la caja..."
            rows={3}
            style={{ width:'100%', padding:'8px 11px', border:`1px solid ${err?T.crit:T.border}`,
              borderRadius:8, fontFamily:'inherit', fontSize:13, color:T.hi,
              background:'var(--input-bg)', outline:'none', resize:'vertical',
              boxSizing:'border-box', transition:'border-color 0.12s' }}/>
        </Field>
      )}

      {!hayDiferencia && (
        <Field label="Notas opcionales">
          <textarea value={notas} onChange={e=>setNotas(e.target.value)}
            placeholder="Observaciones adicionales (opcional)..."
            rows={2}
            style={{ width:'100%', padding:'8px 11px', border:`1px solid ${T.border}`,
              borderRadius:8, fontFamily:'inherit', fontSize:13, color:T.hi,
              background:'var(--input-bg)', outline:'none', resize:'vertical', boxSizing:'border-box' }}/>
        </Field>
      )}

      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleCerrar} disabled={saving} icon={<Ico.Lock s={14}/>}>
          Cerrar cuadre
        </Btn>
      </div>
    </div>
  );
}
