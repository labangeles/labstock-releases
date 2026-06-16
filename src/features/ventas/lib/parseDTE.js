/**
 * Parser de DTE Guatemala (FEL - Factura Electrónica en Línea, SAT).
 * Soporta el namespace dte: y sin namespace.
 * Retorna los campos necesarios para ventas_facturas.
 */
export function parseDTE(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  // Verificar error de parseo
  if (doc.querySelector('parsererror')) {
    throw new Error('El archivo no es un XML válido.');
  }

  // Helper: primer elemento por nombre local (ignora namespace)
  const byTag = (name) => {
    const direct = doc.getElementsByTagName(name)[0];
    if (direct) return direct;
    const ns = doc.getElementsByTagName(`dte:${name}`)[0];
    return ns || null;
  };

  const attr  = (el, a) => el?.getAttribute(a) ?? '';
  const texto = (el)    => el?.textContent?.trim() ?? '';

  // ── UUID / Serie / Número de autorización ──
  const certEl       = byTag('NumeroAutorizacion');
  const uuid_sat     = texto(certEl) || null;
  const serie        = attr(certEl, 'Serie') || null;
  const numero_factura = attr(certEl, 'Numero') || null;

  // ── Fecha de emisión ──
  const datosGen    = byTag('DatosGenerales');
  const fechaRaw    = attr(datosGen, 'FechaHoraEmision');
  const fecha_emision = fechaRaw ? fechaRaw.split('T')[0] : null;

  // ── Receptor ──
  const receptorEl    = byTag('Receptor');
  const nit_receptor  = attr(receptorEl, 'IDReceptor');
  const nombre_receptor = attr(receptorEl, 'NombreReceptor');

  // ── Emisor ──
  const emisorEl    = byTag('Emisor');
  const nit_emisor  = attr(emisorEl, 'NITEmisor');
  const nombre_emisor = attr(emisorEl, 'NombreEmisor');

  // ── Gran Total ──
  const granTotalEl = byTag('GranTotal');
  const monto_total = parseFloat(texto(granTotalEl)) || 0;

  // ── IVA (busca TotalImpuesto con NombreCorto="IVA") ──
  const todosImpuestos = [
    ...doc.getElementsByTagName('TotalImpuesto'),
    ...doc.getElementsByTagName('dte:TotalImpuesto'),
  ];
  const ivaEl    = todosImpuestos.find(el => el.getAttribute('NombreCorto') === 'IVA');
  const iva_monto = parseFloat(ivaEl?.getAttribute('TotalMontoImpuesto') ?? '0') || 0;

  const subtotal     = round2(monto_total - iva_monto);
  const retencion_iva = round2(iva_monto);   // IGSS retiene el IVA completo
  const pago_esperado = subtotal;             // lo que se depositará

  if (monto_total === 0) {
    throw new Error('No se encontró el monto total en el XML. Verifica que sea un DTE de SAT Guatemala.');
  }

  return {
    uuid_sat,
    serie,
    numero_factura,
    nit_receptor,
    nombre_receptor,
    nit_emisor,
    nombre_emisor,
    fecha_emision,
    subtotal,
    iva_monto:    round2(iva_monto),
    monto_total:  round2(monto_total),
    retencion_iva,
    pago_esperado,
  };
}

function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}
