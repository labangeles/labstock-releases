// src/features/rrhh/components/CalendarioVacaciones.jsx
// Calendario mensual con selección de rango. Solo días (sin montos).
import React from 'react';
import { T, IconBtn, Ico } from '../../../shared/ui';
import { ymd, parseYmd, esHabil, MESES } from '../lib/vacaciones';

export default function CalendarioVacaciones({ mes, onMes, rango, onSelect, feriados }) {
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const diasEnMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const offset = primero.getDay(); // 0 dom .. 6 sáb
  const hoyStr = ymd(new Date());

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) {
    celdas.push(ymd(new Date(mes.getFullYear(), mes.getMonth(), d)));
  }

  const enRango = (s) => {
    if (!s || !rango.inicio) return false;
    if (!rango.fin) return s === rango.inicio;
    return s >= rango.inicio && s <= rango.fin;
  };

  const cambiarMes = (delta) =>
    onMes(new Date(mes.getFullYear(), mes.getMonth() + delta, 1));

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button onClick={() => cambiarMes(-1)} title="Mes anterior"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.mid, fontSize: 18, padding: '0 6px' }}>
          ‹
        </button>
        <strong style={{ color: T.hi }}>{MESES[mes.getMonth()]} {mes.getFullYear()}</strong>
        <button onClick={() => cambiarMes(1)} title="Mes siguiente"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.mid, fontSize: 18, padding: '0 6px' }}>
          ›
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['D','L','M','M','J','V','S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 12, color: T.lo, padding: 4 }}>{d}</div>
        ))}
        {celdas.map((s, i) => {
          if (!s) return <div key={i} />;
          const habil = esHabil(s, feriados);
          const sel = enRango(s);
          const esHoy = s === hoyStr;
          return (
            <button
              key={i}
              onClick={() => onSelect(s)}
              disabled={!habil}
              style={{
                padding: '8px 0',
                borderRadius: 8,
                border: esHoy ? `1px solid ${T.teal}` : '1px solid transparent',
                background: sel ? T.teal : (habil ? 'transparent' : T.outBg),
                color: sel ? '#fff' : (habil ? T.hi : T.lo),
                cursor: habil ? 'pointer' : 'not-allowed',
                fontWeight: sel ? 700 : 400,
              }}
              title={habil ? '' : 'No hábil (fin de semana o feriado)'}
            >
              {parseYmd(s).getDate()}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: T.lo, marginTop: 8 }}>
        Los días no hábiles (fines de semana y feriados) no se pueden seleccionar.
      </div>
    </div>
  );
}
