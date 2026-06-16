// src/features/rrhh/lib/edad.js
// Derivados — nunca se persisten en BD.

export function calcularEdad(fechaNac) {
  if (!fechaNac) return null;
  const n = new Date(fechaNac + 'T00:00:00');
  const hoy = new Date();
  let edad = hoy.getFullYear() - n.getFullYear();
  const m = hoy.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) edad--;
  return edad >= 0 ? edad : null;
}

export function calcularAntiguedad(fechaIngreso) {
  if (!fechaIngreso) return null;
  const i = new Date(fechaIngreso + 'T00:00:00');
  const hoy = new Date();
  let meses = (hoy.getFullYear() - i.getFullYear()) * 12 + (hoy.getMonth() - i.getMonth());
  if (hoy.getDate() < i.getDate()) meses--;
  if (meses < 0) meses = 0;
  const anios = Math.floor(meses / 12);
  const m = meses % 12;
  return { anios, meses: m, texto: `${anios} año(s) ${m} mes(es)` };
}
