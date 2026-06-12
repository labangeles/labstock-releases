import * as XLSX from 'xlsx';
import { supabase } from '../../../lib/supabase';

function toExcelDate(isoStr) {
  if (!isoStr) return '';
  // SheetJS acepta Date objects; Excel los convierte a número de serie
  return new Date(isoStr);
}

function toExcelDateOnly(dateStr) {
  if (!dateStr) return '';
  // dateStr es 'YYYY-MM-DD' — agregar mediodía para evitar desplazamiento de timezone
  return new Date(dateStr + 'T12:00:00');
}

export async function exportarExcel({ fechaDesde, fechaHasta, sedeId, sedes }) {
  // ── 1. Cargar datos ──────────────────────────────────────
  let cuadresQ = supabase
    .from('v_cuadres_resumen')
    .select('*')
    .gte('fecha', fechaDesde)
    .lte('fecha', fechaHasta)
    .order('fecha', { ascending: false });

  if (sedeId) cuadresQ = cuadresQ.eq('sede_id', sedeId);

  const { data: cuadres, error: ce } = await cuadresQ;
  if (ce) throw new Error('Error al cargar cuadres: ' + ce.message);

  const cuadreIds = (cuadres || []).map(c => c.id);

  let gastos = [], depositos = [];

  if (cuadreIds.length > 0) {
    const [g, d] = await Promise.all([
      supabase.from('gastos_caja')
        .select('*, cuadre:cuadres_caja(fecha,sede_id,sedes(nombre)), registrado:registrado_por(nombre)')
        .in('cuadre_id', cuadreIds)
        .order('created_at'),
      supabase.from('depositos_caja')
        .select('*, cuadre:cuadres_caja(fecha,sede_id,sedes(nombre)), registrado:registrado_por(nombre)')
        .in('cuadre_id', cuadreIds)
        .order('created_at'),
    ]);
    gastos    = g.data || [];
    depositos = d.data || [];
  }

  // ── 2. Hoja Resumen ──────────────────────────────────────
  const resumenRows = (cuadres || []).map(c => ({
    'Fecha':              toExcelDateOnly(c.fecha),
    'Sede':               c.sede_nombre || '',
    'Ingreso 4DLab (Q)':  Number(c.ingreso_dia),
    'Total Gastos (Q)':   Number(c.total_gastos),
    'Total Depósitos (Q)':Number(c.total_depositos),
    'Depósito Esperado (Q)': Number(c.deposito_esperado),
    'Caja Final (Q)':     Number(c.caja_final),
    'Diferencia (Q)':     Number(c.diferencia),
    'Estado':             c.estado === 'cerrado' ? 'Cerrado' : 'Abierto',
    'Cerrado el':         c.cerrado_at ? toExcelDate(c.cerrado_at) : '',
    'Notas':              c.notas || '',
  }));

  // ── 3. Hoja Gastos ───────────────────────────────────────
  const gastosRows = gastos.map(g => ({
    'Fecha':           toExcelDateOnly(g.cuadre?.fecha),
    'Sede':            g.cuadre?.sedes?.nombre || '',
    'Descripción':     g.descripcion || '',
    'Categoría':       g.categoria || '',
    'Monto (Q)':       Number(g.monto),
    'Comprobante':     g.comprobante || '',
    'Registrado por':  g.registrado?.nombre || '',
    'Hora registro':   toExcelDate(g.created_at),
  }));

  // ── 4. Hoja Depósitos ────────────────────────────────────
  const depositosRows = depositos.map(d => ({
    'Fecha':           toExcelDateOnly(d.cuadre?.fecha),
    'Sede':            d.cuadre?.sedes?.nombre || '',
    'Banco':           d.banco || '',
    'No. Boleta':      d.no_boleta || '',
    'Monto (Q)':       Number(d.monto),
    'Registrado por':  d.registrado?.nombre || '',
    'Hora registro':   toExcelDate(d.created_at),
  }));

  // ── 5. Crear workbook ────────────────────────────────────
  const wb = XLSX.utils.book_new();

  const wsResumen    = XLSX.utils.json_to_sheet(resumenRows.length ? resumenRows : [{}]);
  const wsGastos     = XLSX.utils.json_to_sheet(gastosRows.length  ? gastosRows  : [{}]);
  const wsDepositos  = XLSX.utils.json_to_sheet(depositosRows.length ? depositosRows : [{}]);

  // Formato de fecha para columnas de fecha en cada hoja
  const dateFmt = 'dd/mm/yyyy';
  const datetimeFmt = 'dd/mm/yyyy hh:mm';

  [wsResumen, wsGastos, wsDepositos].forEach(ws => {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) continue;
        if (cell.v instanceof Date) {
          cell.t = 'd';
          cell.z = datetimeFmt;
        }
      }
    }
  });

  XLSX.utils.book_append_sheet(wb, wsResumen,   'Resumen');
  XLSX.utils.book_append_sheet(wb, wsGastos,    'Gastos');
  XLSX.utils.book_append_sheet(wb, wsDepositos, 'Depósitos');

  // ── 6. Guardar ───────────────────────────────────────────
  const filename = `cuadres_${fechaDesde}_a_${fechaHasta}.xlsx`;

  if (window.electronAPI?.saveXlsx) {
    // Enviar como base64 al proceso principal para guardar con diálogo nativo
    const buffer = XLSX.write(wb, { bookType:'xlsx', type:'base64' });
    await window.electronAPI.saveXlsx({ defaultPath: filename, data: buffer });
  } else {
    // Fallback: descarga de blob en navegador
    XLSX.writeFile(wb, filename);
  }
}
