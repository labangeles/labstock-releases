// src/features/rrhh/lib/vacaciones.js
// Helpers de fechas en días (sin montos). Espejo cliente de dias_habiles_entre() en SQL.
// La validación REAL del saldo la hace el RPC en el servidor.

export const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const parseYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function esHabil(fechaStr, feriadosSet) {
  const d = parseYmd(fechaStr);
  const dow = d.getDay(); // 0 dom .. 6 sáb
  if (dow === 0) return false; // solo domingo no hábil; sábado sí trabajan
  if (feriadosSet && feriadosSet.has(fechaStr)) return false;
  return true;
}

export function contarDiasHabiles(inicioStr, finStr, feriadosSet) {
  if (!inicioStr || !finStr) return 0;
  let count = 0;
  const cur = parseYmd(inicioStr);
  const fin = parseYmd(finStr);
  while (cur <= fin) {
    if (esHabil(ymd(cur), feriadosSet)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
