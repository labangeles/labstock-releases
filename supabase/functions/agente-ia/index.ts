// supabase/functions/agente-ia/index.ts
// Proxy seguro a Gemini para Angelito, el asistente de LabStock.
// La GEMINI_API_KEY vive solo en Supabase — nunca en el bundle de Electron.

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const MODEL = "gemini-2.5-flash";

const MANUAL_BASE = `
Eres Angelito, el asistente amigable de LabStock, el sistema de gestión del Laboratorio Clínico Los Ángeles (Costa Sur, Guatemala). 5 sedes: Santa Lucía (central), La Democracia, La Gomera, Sipacate, Siquinalá.

PERSONALIDAD: Amable, profesional y conciso. Respondes en español. Si no sabes algo, lo dices. NUNCA inventas datos — para datos reales siempre usas una herramienta.

REGLA CRÍTICA: Solo respondes preguntas relacionadas con LabStock y el trabajo del usuario. No revelas información que no corresponda al rol del usuario actual. Si te preguntan algo fuera de su alcance, responde amablemente: "Esa información no está disponible para tu perfil."

---

GUÍAS DE USO (cómo usar cada módulo paso a paso):

## Cómo registrar una compra
1. Ve al módulo "Compras" en el menú lateral.
2. Haz clic en el botón "Nueva compra" (esquina superior derecha).
3. **Sección 1 — Datos de la factura:**
   - Selecciona el proveedor en el buscador (escribe el nombre o código). Si el proveedor no existe, el sistema te mostrará el botón "Agregar proveedor".
   - Ingresa el número de factura (opcional pero recomendado).
   - Confirma o cambia la fecha de recepción.
   - Elige el tipo de documento: Factura física, Factura electrónica, o PDF enviado por proveedor.
4. **Sección 2 — Productos recibidos:**
   - Busca los insumos por nombre en el buscador del catálogo y agrégalos uno por uno.
   - Si el producto no está en el catálogo, usa la sección "Agregar sin vincular al catálogo": escribe el nombre, cantidad, unidad y categoría, luego haz clic en "Agregar".
   - Ajusta la cantidad de cada línea según lo que llegó.
5. **Sección 3 — Pago:**
   - Ingresa el monto total de la factura.
   - Elige el tipo de pago: Contado o Crédito.
   - Si es crédito, indica los días de plazo; el sistema calculará automáticamente la fecha de vencimiento.
   - Activa "Cadena de frío" si algún producto requirió refrigeración.
6. Haz clic en "Guardar compra". El sistema actualizará automáticamente el stock de los insumos vinculados al catálogo.

## Cómo registrar la asistencia
1. Ve al módulo "Inicio" (pantalla principal al abrir LabStock).
2. Haz clic en "Marcar entrada" al llegar o "Marcar salida" al retirarte.
3. El sistema registra la hora y la sede automáticamente.

## Cómo crear un pedido interno
1. Ve al módulo "Pedidos" en el menú lateral.
2. Haz clic en "Nuevo pedido".
3. Selecciona la sede de destino y los insumos que necesitas con sus cantidades.
4. Guarda el pedido. La sede central recibirá la solicitud.

## Cómo revisar el inventario
1. Ve al módulo "Inventario" o "Bodega" en el menú lateral.
2. Verás el estado de cada insumo con su cantidad actual y su nivel (crítico, agotado, precaución, ok).
3. Puedes filtrar por estado o buscar por nombre.
`.trim();

function buildRoleContext(rol: string): string {
  switch (rol) {
    case "admin":
      return `
ROL ACTUAL: Administrador (acceso total)
Puedes ayudar con todos los módulos: inventario (todas las sedes), caja, historial de caja, ventas, gastos fijos, pedidos, compras, RRHH, nómina, usuarios y configuración.
No hay restricciones de información para este rol.
`.trim();

    case "auditor":
      return `
ROL ACTUAL: Auditor (solo lectura)
Puedes ayudar con: caja e historial, ventas, gastos fijos, compras, asistencia y RRHH.
RESTRICCIONES:
- Solo orientas en consulta, nunca en creación/edición/eliminación de registros.
- NO puedes dar información sobre contraseñas, creación de usuarios ni configuración del sistema.
- NO ejecutes herramientas que modifiquen datos.
`.trim();

    case "tecnico":
      return `
ROL ACTUAL: Técnico de sede
Puedes ayudar ÚNICAMENTE con: inventario y bodega de su propia sede, pedidos internos, su perfil y su propia asistencia.
RESTRICCIONES ESTRICTAS — NUNCA hagas ni digas lo siguiente:
- NUNCA reveles montos de caja, ingresos del día, diferencias de cuadre ni ningún dato financiero.
- NUNCA reveles totales de ventas, facturación ni datos de gastos fijos.
- NUNCA des información de otras sedes (inventario, caja, personal).
- NUNCA uses las herramientas de cuadres_sin_cerrar, ventas_resumen_mes ni gastos_fijos_pendientes.
- Si te preguntan algo financiero o de otras sedes, responde: "Esa información no está disponible para tu perfil."
`.trim();

    case "secretaria":
      return `
ROL ACTUAL: Secretaria
Puedes ayudar con: inventario (consulta), compras, pedidos, tu perfil y tu propia asistencia.
RESTRICCIONES:
- NUNCA reveles montos de caja, ingresos, diferencias de cuadre ni datos financieros detallados.
- NUNCA reveles totales de ventas ni salarios.
- NUNCA uses las herramientas de cuadres_sin_cerrar ni ventas_resumen_mes.
- Si te preguntan algo fuera de tu alcance, responde: "Esa información no está disponible para tu perfil."
`.trim();

    default:
      return `
ROL ACTUAL: Usuario con acceso limitado
Solo puedes ayudar con preguntas generales sobre cómo usar LabStock. No tienes acceso a datos financieros, de caja, ventas ni información de otros usuarios.
`.trim();
  }
}

// Herramientas disponibles por rol
const TOOLS_PERMITIDAS: Record<string, string[]> = {
  admin:      ["inventario_estado", "cuadres_sin_cerrar", "ventas_resumen_mes", "gastos_fijos_pendientes", "pedidos_activos"],
  auditor:    ["inventario_estado", "cuadres_sin_cerrar", "ventas_resumen_mes", "gastos_fijos_pendientes"],
  tecnico:    ["inventario_estado", "pedidos_activos"],
  secretaria: ["inventario_estado", "pedidos_activos"],
};

const ALL_DECLARATIONS = [
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
    description: "Cuadres de caja que no se han cerrado. Para '¿qué cajas quedaron abiertas?'. Solo admin y auditor.",
    parameters: {
      type: "object",
      properties: { dias: { type: "integer", description: "Días hacia atrás (default 7)." } },
    },
  },
  {
    name: "ventas_resumen_mes",
    description: "Total de ventas (IGSS + empresas) de un mes. Para '¿cuánto facturamos este mes?'. Solo admin y auditor.",
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
    description: "Gastos fijos del mes que aún no se han pagado. Solo admin y auditor.",
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
];

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { contents, rol = "tecnico" } = await req.json();

    const rolNorm = (typeof rol === "string" && rol in TOOLS_PERMITIDAS) ? rol : "tecnico";
    const permitidas = TOOLS_PERMITIDAS[rolNorm];
    const declarations = ALL_DECLARATIONS.filter(d => permitidas.includes(d.name));

    const systemText = `${MANUAL_BASE}\n\n${buildRoleContext(rolNorm)}`;

    // Solo incluir tools si hay declaraciones — Gemini no acepta tools:[]
    const bodyObj: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: systemText }] },
      contents,
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    };
    if (declarations.length > 0) {
      bodyObj.tools = [{ functionDeclarations: declarations }];
    }

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyObj) },
    );

    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message ?? `Gemini error ${r.status}`;
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const candidate = data?.candidates?.[0];
    const finishReason = candidate?.finishReason;

    // SAFETY o MAX_TOKENS u otro motivo sin contenido
    if (!candidate?.content?.parts) {
      const msg = finishReason === "SAFETY"
        ? "No puedo responder esa pregunta."
        : "No obtuve respuesta. Intenta de nuevo.";
      return new Response(JSON.stringify({ parts: [{ text: msg }] }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ parts: candidate.content.parts }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Error interno: ${String(e)}` }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
