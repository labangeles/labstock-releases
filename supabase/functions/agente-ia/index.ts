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

function buildRoleContext(rol: string, permisos: Permisos): string {
  const tieneCaja    = rol === "admin" || rol === "auditor" || rol === "secretaria" || permisos.caja === true;
  const tieneIgss    = rol === "admin" || rol === "auditor" || permisos.ventas_igss === true;
  const tieneEmp     = rol === "admin" || permisos.ventas_empresas === true;
  const tieneGastos  = rol === "admin" || rol === "auditor";

  switch (rol) {
    case "admin":
      return `
ROL ACTUAL: Administrador (acceso total)
Puedes ayudar con todos los módulos: inventario (todas las sedes), caja, historial de caja, ventas IGSS y empresas, gastos fijos, pedidos, compras, RRHH, nómina, usuarios y configuración.
No hay restricciones de información para este rol.
`.trim();

    case "auditor":
      return `
ROL ACTUAL: Auditor (solo lectura)
Puedes ayudar con: caja e historial, ventas IGSS, gastos fijos, compras, asistencia y RRHH.
RESTRICCIONES:
- Solo orientas en consulta, nunca en creación/edición/eliminación de registros.
- NO puedes dar información sobre contraseñas, creación de usuarios ni configuración del sistema.
`.trim();

    case "tecnico": {
      const accesos = ["inventario y bodega de su sede", "pedidos internos", "perfil y asistencia"];
      if (tieneCaja)   accesos.push("caja (cuadres y estado)");
      if (tieneIgss)   accesos.push("ventas IGSS");
      if (tieneEmp)    accesos.push("ventas empresas");

      const restricciones: string[] = [];
      if (!tieneCaja)   restricciones.push("NUNCA reveles montos de caja, ingresos del día ni diferencias de cuadre.");
      if (!tieneIgss && !tieneEmp) restricciones.push("NUNCA reveles totales de ventas ni datos de facturación.");
      restricciones.push("NUNCA des información de otras sedes.");
      if (tieneGastos === false) restricciones.push("NUNCA reveles datos de gastos fijos.");

      return `
ROL ACTUAL: Técnico de sede
Este usuario tiene acceso a: ${accesos.join(", ")}.
${restricciones.length > 0 ? "RESTRICCIONES:\n- " + restricciones.join("\n- ") : ""}
- Si te preguntan algo fuera de su alcance, responde: "Esa información no está disponible para tu perfil."
`.trim();
    }

    case "secretaria": {
      const accesos = ["inventario (consulta)", "compras", "pedidos", "perfil y asistencia", "caja y cuadres"];
      if (tieneIgss) accesos.push("ventas IGSS");
      if (tieneEmp)  accesos.push("ventas empresas");

      return `
ROL ACTUAL: Secretaria
Este usuario tiene acceso a: ${accesos.join(", ")}.
RESTRICCIONES:
- NUNCA reveles salarios ni nómina detallada.
- NUNCA reveles datos de gastos fijos.
- Si te preguntan algo fuera de su alcance, responde: "Esa información no está disponible para tu perfil."
`.trim();
    }

    default:
      return `
ROL ACTUAL: Usuario con acceso limitado
Solo puedes ayudar con preguntas generales sobre cómo usar LabStock. No tienes acceso a datos financieros, de caja, ventas ni información de otros usuarios.
`.trim();
  }
}

// Calcula herramientas permitidas dinámicamente según rol + permisos del usuario
interface Permisos {
  caja?: boolean;
  ventas_igss?: boolean;
  ventas_empresas?: boolean;
  bodega?: boolean;
}

function getToolsPermitidas(rol: string, permisos: Permisos): string[] {
  const tools: string[] = ["inventario_estado"];

  const esAdmin   = rol === "admin";
  const esAuditor = rol === "auditor";

  // Caja: admin, auditor, secretaria siempre, técnico solo si tiene permiso
  if (esAdmin || esAuditor || rol === "secretaria" || permisos.caja === true) {
    tools.push("cuadres_sin_cerrar");
  }

  // Ventas: admin, auditor, o cualquier rol con permiso ventas_igss/ventas_empresas
  if (esAdmin || esAuditor || permisos.ventas_igss === true || permisos.ventas_empresas === true) {
    tools.push("ventas_resumen_mes");
  }

  // Gastos fijos: solo admin y auditor
  if (esAdmin || esAuditor) {
    tools.push("gastos_fijos_pendientes");
  }

  // Pedidos: todos excepto auditor
  if (!esAuditor) {
    tools.push("pedidos_activos");
  }

  return tools;
}

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
    const { contents, rol = "tecnico", permisos = {} } = await req.json();
    const rolNorm   = (typeof rol === "string" && ["admin","auditor","tecnico","secretaria"].includes(rol)) ? rol : "tecnico";
    const perm: Permisos = permisos ?? {};
    const permitidas   = getToolsPermitidas(rolNorm, perm);
    const declarations = ALL_DECLARATIONS.filter(d => permitidas.includes(d.name));

    const systemText = `${MANUAL_BASE}\n\n${buildRoleContext(rolNorm, perm)}`;

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
