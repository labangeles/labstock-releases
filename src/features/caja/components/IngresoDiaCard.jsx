import { useState, useEffect } from 'react';
import { T, Ico, Btn, fmtQ } from '../../../shared/ui';

export function IngresoDiaCard({ ingreso, isOpen, saving, onSave }) {
  const [raw, setRaw]       = useState(String(ingreso ?? 0));
  const [editing, setEditing] = useState(false);

  // Sincronizar cuando llega un valor externo (realtime)
  useEffect(() => {
    if (!editing) setRaw(String(ingreso ?? 0));
  }, [ingreso, editing]);

  const handleSave = () => {
    const val = parseFloat(raw.replace(',', '.'));
    if (isNaN(val) || val < 0) { setRaw(String(ingreso ?? 0)); setEditing(false); return; }
    const rounded = Math.round(val * 100) / 100;
    onSave(rounded);
    setEditing(false);
  };

  return (
    <div style={{ background:T.surface, borderRadius:12, border:`1px solid ${T.border}`,
      padding:'16px 20px' }}>
      <div style={{ fontSize:11, fontWeight:700, color:T.lo, textTransform:'uppercase',
        letterSpacing:'0.08em', marginBottom:10 }}>Ingreso del día (4DLab)</div>

      {isOpen ? (
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ position:'relative', flex:1 }}>
            <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)',
              fontSize:14, fontWeight:700, color:T.tealDk, pointerEvents:'none' }}>Q</span>
            <input
              type="text" inputMode="numeric"
              value={raw}
              onChange={e => { setRaw(e.target.value); setEditing(true); }}
              onBlur={handleSave}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              style={{ width:'100%', padding:'10px 11px 10px 26px',
                border:`1px solid ${editing ? T.teal : T.border}`,
                borderRadius:8, fontFamily:'inherit', fontSize:16, fontWeight:700,
                color:T.hi, background:'#F8FAFB', outline:'none',
                transition:'border-color 0.12s', boxSizing:'border-box' }}
            />
          </div>
          <Btn onClick={handleSave} disabled={saving} icon={<Ico.Check s={14}/>}>
            Guardar
          </Btn>
        </div>
      ) : (
        <div style={{ fontSize:24, fontWeight:700, color:T.tealDk }}>
          {fmtQ(ingreso)}
        </div>
      )}

      <p style={{ fontSize:11, color:T.lo, marginTop:6 }}>
        Monto total cobrado según la plataforma 4DLab. Ingresar una sola vez al final del día.
      </p>
    </div>
  );
}
