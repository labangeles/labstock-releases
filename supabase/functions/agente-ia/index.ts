// supabase/functions/agente-ia/index.ts
// Proxy seguro a Gemini para Angelito, el asistente de LabStock.
// La GEMINI_API_KEY vive solo en Supabase — nunca en el bundle de Electron.

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const MODEL = "gemini-2.5-flash";

const MANUAL = `
Eres Angelito, el asistente amigable de LabStock, el sistema de gestión del Laboratorio Clínico Los Ángeles (Costa Sur, Guatemala). 5 sedes: Santa Lucía (central), La Democracia, La Gomera, Sipacate, Siquinalá.

PERSONALIDAD: Amable, profesional y conciso. Respondes en español. Si no sabes algo, lo dices. NUNCA inventas datos — para datos reales siempre usas una herramienta.

ROLES: admin (acceso total), tecnico (bodega de su sede, pedidos), auditor (solo lectura: caja/compras/gastos), secretaria (inventario lectura, compras, caja/ventas si tiene permiso).

MÓDULOS:
- Inicio: marcaje de asistencia (Entrada→Desayuno 20min→Regreso→Almuerzo 60min→Regreso→Salida), reconocimientos del mes, alertas.
- Inventario/Bodega: insumos por sede, estados OK/Precaución/Crítico/Agotado, importar/exportar CSV.
- Caja: cuadre por sede por día, apertura automática, cierre con firma admin, ingresos/gastos/depósitos.
- Historial de Caja: filtros por sede/fecha; admin puede reabrir cuadres.
- Compras: registro de facturas por proveedor.
- Pedidos: carrito entre sedes, referencia PED-0001.
- Ventas: IGSS Gomera (facturas DTE/FEL) y Empresas privadas.
- Gastos Fijos: plantillas mensuales, checklist mensual.
- Análisis Financiero: ingresos vs egresos (solo admin).
- RRHH: Mi perfil, documentos, vacaciones, reconocimientos (todos); gestión de empleados, asistencia, nómina (admin/auditor).
- Chat interno: botón en esquina inferior derecha para mensajes entre empleados.
- Usuarios: crear/editar/resetear contraseña (solo admin).
`.trim();

const tools = [{
  functionDeclarations: [
    {
      name: "inventario_estado",
      description: "Lista insumos del inventario por estado (critico/agotado/precaucion/ok/todos). Úsalo para '¿qué reactivos están críticos?'.",
      parameters: {
        type: "object",
        properties: {
          estado: { type: "string", enum: ["critico", "agotado", "precaucion", "ok", "todos"] },
          sede:   { type: "string", description: "Nombre de sede opcional." },
        },
        required: ["estado"],
      },
    },
    {
      name: "cuadres_sin_cerrar",
      description: "Cuadres de caja que no se han cerrado. Para '¿qué cajas quedaron abiertas?'.",
      parameters: {
        type: "object",
        properties: { dias: { type: "integer", description: "Días hacia atrás (default 7)." } },
      },
    },
    {
      name: "ventas_resumen_mes",
      description: "Total de ventas (IGSS + empresas) de un mes. Para '¿cuánto facturamos este mes?'.",
      parameters: {
        type: "object",
        properties: {
          mes:  { type: "integer", description: "Mes 1-12. Default: mes actual." },
          anio: { type: "integer", description: "Año. Default: año actual." },
        },
      },
    },
    {
      name: "gastos_fijos_pendientes",
      description: "Gastos fijos del mes que aún no se han pagado.",
      parameters: {
        type: "object",
        properties: {
          mes:  { type: "integer" },
          anio: { type: "integer" },
        },
      },
    },
    {
      name: "pedidos_activos",
      description: "Pedidos internos entre sedes que siguen en proceso.",
      parameters: { type: "object", properties: {} },
    },
  ],
}];

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { contents } = await req.json();

    const body = {
      systemInstruction: { parts: [{ text: MANUAL }] },
      contents,
      tools,
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    };

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );

    const data = await r.json();
    if (!r.ok) {
      return new Response(
        JSON.stringify({ error: data?.error?.message ?? "Error de Gemini" }),
        { status: r.status, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const parts = data?.candidates?.[0]?.content?.parts
      ?? [{ text: "No obtuve respuesta. Intenta de nuevo." }];

    return new Response(JSON.stringify({ parts }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
