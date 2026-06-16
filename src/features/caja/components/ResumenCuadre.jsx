import { T, Ico, fmtQ } from '../../../shared/ui';

const semaforo = dif => {
  if (dif === 0) return { label:'Cuadrado', c:T.ok,   bg:T.okBg,   icon:'✓' };
  if (dif > 0)  return { label:'Sobrante', c:T.warn,  bg:T.warnBg, icon:'⚠' };
  return             { label:'Faltante', c:T.crit,  bg:T.critBg, icon:'●' };
};

function Line({ label, value, bold, accent, large }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'7px 0', borderBottom:`1px solid ${T.border}` }}>
      <span style={{ fontSize: large ? 14 : 13, color: T.mid, fontWeight: bold ? 600 : 400 }}>
        {label}
      </span>
      <span style={{ fontSize: large ? 15 : 13.5, fontWeight: bold ? 700 : 500,
        color: accent || T.hi, fontVariantNumeric:'tabular-nums' }}>
        {fmtQ(value)}
      </span>
    </div>
  );
}

export function ResumenCuadre({ cajaBase, sobrante, ingresoNum, totalGastos, totalDepositos,
  depositoEsperado, cajaFinal, diferencia }) {
  const sem = semaforo(diferencia);

  return (
    <div style={{ background:T.surface, borderRadius:12, border:`1px solid ${T.border}`,
      padding:'18px 20px', display:'flex', flexDirection:'column', gap:0 }}>

      <div style={{ fontSize:11, fontWeight:700, color:T.lo, textTransform:'uppercase',
        letterSpacing:'0.08em', marginBottom:12 }}>Resumen del cuadre</div>

      <Line label="Caja base"              value={cajaBase} />
      {sobrante > 0 && (
        <Line label="+ Sobrante anterior"  value={sobrante} accent={T.warn} />
      )}
      <Line label="+ Ingreso 4DLab"        value={ingresoNum} accent={T.ok} />
      <Line label="− Total gastos"          value={totalGastos} accent={totalGastos>0?T.crit:T.lo} />
      <Line label="− Total depósitos"       value={totalDepositos} accent={totalDepositos>0?'#7C3AED':T.lo} />

      <div style={{ margin:'12px 0 8px', borderTop:`2px solid ${T.border}` }} />

      <Line label="Caja final"           value={cajaFinal} bold large />

      {/* Diferencia — semáforo */}
      <div style={{ marginTop:10, padding:'10px 14px', borderRadius:10,
        background:sem.bg, display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:18, color:sem.c }}>{sem.icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:700, color:sem.c, textTransform:'uppercase',
            letterSpacing:'0.06em' }}>{sem.label}</div>
          <div style={{ fontSize:13, fontWeight:600, color:sem.c, marginTop:2 }}>
            {fmtQ(Math.abs(diferencia))}
            {diferencia !== 0 && (
              <span style={{ fontSize:11, fontWeight:400, marginLeft:6 }}>
                {diferencia > 0 ? 'de más en caja' : 'faltante en caja'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Depósito esperado (guía) */}
      <div style={{ marginTop:10, padding:'8px 12px', background:T.canvas,
        borderRadius:8, fontSize:12.5, color:T.mid }}>
        <span style={{ fontWeight:600 }}>Depósito esperado: </span>
        <span style={{ color:T.tealDk, fontWeight:700 }}>{fmtQ(depositoEsperado)}</span>
        <span style={{ fontSize:11, marginLeft:4 }}>(ingreso − gastos)</span>
      </div>
    </div>
  );
}
