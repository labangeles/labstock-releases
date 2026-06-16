-- ════════════════════════════════════════════════════════════
-- MÓDULO DE VENTAS — IGSS y Empresas
-- ════════════════════════════════════════════════════════════

-- Clientes/receptores de facturas (clave: NIT + categoría)
CREATE TABLE IF NOT EXISTS ventas_clientes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizaciones(id),
  nit             text NOT NULL,
  nombre          text NOT NULL,
  categoria       text NOT NULL CHECK (categoria IN ('igss','empresa')),
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(nit, organizacion_id, categoria)
);

-- Facturas electrónicas DTE
CREATE TABLE IF NOT EXISTS ventas_facturas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizaciones(id),
  cliente_id      uuid REFERENCES ventas_clientes(id) ON DELETE SET NULL,
  categoria       text NOT NULL CHECK (categoria IN ('igss','empresa')),

  -- Datos del DTE
  uuid_sat        text,
  serie           text,
  numero_factura  text,
  nit_receptor    text,
  nombre_receptor text,
  fecha_emision   date,

  -- Montos (GTQ)
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  iva_monto       numeric(12,2) NOT NULL DEFAULT 0,
  monto_total     numeric(12,2) NOT NULL DEFAULT 0,
  retencion_iva   numeric(12,2) NOT NULL DEFAULT 0,
  pago_esperado   numeric(12,2) NOT NULL DEFAULT 0,

  -- Estado
  estado          text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','pagada','en_correccion','anulada')),
  fecha_pago      date,

  -- XML original + notas
  xml_raw         text,
  notas           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Un mismo UUID SAT no puede cargarse dos veces (solo si uuid_sat no es NULL)
CREATE UNIQUE INDEX IF NOT EXISTS ventas_facturas_uuid_sat_unique
  ON ventas_facturas(uuid_sat)
  WHERE uuid_sat IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────

ALTER TABLE ventas_clientes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_facturas  ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total a su org
CREATE POLICY "admin_ventas_clientes" ON ventas_clientes FOR ALL
  USING ((SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organizacion_id = (SELECT organizacion_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_ventas_facturas" ON ventas_facturas FOR ALL
  USING ((SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organizacion_id = (SELECT organizacion_id FROM profiles WHERE id = auth.uid()));

-- Usuarios con perm ventas_igss
CREATE POLICY "perm_igss_clientes" ON ventas_clientes FOR ALL
  USING (categoria = 'igss'
    AND (SELECT permisos->>'ventas_igss' FROM profiles WHERE id = auth.uid()) = 'true'
    AND organizacion_id = (SELECT organizacion_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "perm_igss_facturas" ON ventas_facturas FOR ALL
  USING (categoria = 'igss'
    AND (SELECT permisos->>'ventas_igss' FROM profiles WHERE id = auth.uid()) = 'true'
    AND organizacion_id = (SELECT organizacion_id FROM profiles WHERE id = auth.uid()));

-- Usuarios con perm ventas_empresas
CREATE POLICY "perm_emp_clientes" ON ventas_clientes FOR ALL
  USING (categoria = 'empresa'
    AND (SELECT permisos->>'ventas_empresas' FROM profiles WHERE id = auth.uid()) = 'true'
    AND organizacion_id = (SELECT organizacion_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "perm_emp_facturas" ON ventas_facturas FOR ALL
  USING (categoria = 'empresa'
    AND (SELECT permisos->>'ventas_empresas' FROM profiles WHERE id = auth.uid()) = 'true'
    AND organizacion_id = (SELECT organizacion_id FROM profiles WHERE id = auth.uid()));

-- Auditor: solo lectura de todo
CREATE POLICY "auditor_ventas_clientes" ON ventas_clientes FOR SELECT
  USING ((SELECT rol FROM profiles WHERE id = auth.uid()) = 'auditor'
    AND organizacion_id = (SELECT organizacion_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "auditor_ventas_facturas" ON ventas_facturas FOR SELECT
  USING ((SELECT rol FROM profiles WHERE id = auth.uid()) = 'auditor'
    AND organizacion_id = (SELECT organizacion_id FROM profiles WHERE id = auth.uid()));
