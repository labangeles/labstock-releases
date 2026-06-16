-- =====================================================================
--  LabStock · Migración Módulo RRHH (autoservicio + privacidad)
--  Archivo: supabase/migrations/20260615_rrhh_autoservicio.sql
--  Requisitos previos: auth_org_id() y tabla profiles existen.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. CATÁLOGOS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cargos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id  uuid NOT NULL REFERENCES organizaciones(id),
  nombre           text NOT NULL,
  departamento     text,
  activo           boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

-- Feriados para contar días hábiles de vacaciones
CREATE TABLE IF NOT EXISTS feriados (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id  uuid NOT NULL REFERENCES organizaciones(id),
  fecha            date NOT NULL,
  descripcion      text,
  UNIQUE (organizacion_id, fecha)
);

-- ---------------------------------------------------------------------
-- 2. EMPLEADOS (SIN datos monetarios — privacidad)
--    Esta tabla SÍ la puede leer el propio empleado (su fila).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id  uuid NOT NULL REFERENCES organizaciones(id),
  sede_id          uuid NOT NULL REFERENCES sedes(id),
  cargo_id         uuid REFERENCES cargos(id),

  -- Vínculo con la cuenta de la app
  profile_id       uuid UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,

  -- Datos personales
  nombre           text NOT NULL,
  apellido         text NOT NULL,
  dpi              text,
  nit              text,
  numero_igss      text,
  fecha_nacimiento date,
  sexo             text CHECK (sexo IN ('M','F','otro')),
  estado_civil     text,
  telefono         text,
  correo           text,
  direccion        text,
  municipio        text,
  departamento_residencia text,
  foto_path        text,

  -- Contacto de emergencia
  emergencia_nombre     text,
  emergencia_telefono   text,
  emergencia_parentesco text,

  -- Datos laborales (solo lectura para el empleado)
  fecha_ingreso    date NOT NULL DEFAULT current_date,
  tipo_contrato    text NOT NULL DEFAULT 'tiempo_completo',
  dias_vacaciones_anuales integer NOT NULL DEFAULT 15,
  activo           boolean NOT NULL DEFAULT true,
  fecha_baja       date,
  motivo_baja      text,

  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empleados_org     ON empleados(organizacion_id, activo);
CREATE INDEX IF NOT EXISTS idx_empleados_sede    ON empleados(sede_id, activo);
CREATE INDEX IF NOT EXISTS idx_empleados_profile ON empleados(profile_id);

-- ---------------------------------------------------------------------
-- 3. COMPENSACIÓN (tabla aislada — el empleado NO tiene acceso)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados_compensacion (
  empleado_id       uuid PRIMARY KEY REFERENCES empleados(id) ON DELETE CASCADE,
  salario_base      numeric(10,2),
  bonificacion_fija numeric(10,2) DEFAULT 250,
  vigente_desde     date DEFAULT current_date,
  updated_at        timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. DATOS BANCARIOS (dueño + admin; auditor NO)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleado_datos_bancarios (
  empleado_id   uuid PRIMARY KEY REFERENCES empleados(id) ON DELETE CASCADE,
  banco         text,
  numero_cuenta text,
  tipo_cuenta   text,
  nombre_titular text,
  updated_at    timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 5. DOCUMENTOS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleado_documentos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id    uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  tipo           text NOT NULL,
  nombre_archivo text NOT NULL,
  storage_path   text NOT NULL,
  mime           text,
  tamano_bytes   integer,
  subido_por     uuid REFERENCES profiles(id),
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_empleado ON empleado_documentos(empleado_id, tipo);

-- ---------------------------------------------------------------------
-- 6. ACCIONES DISCIPLINARIAS (incluye reconocimientos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acciones_disciplinarias (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id         uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  organizacion_id     uuid NOT NULL REFERENCES organizaciones(id),
  tipo                text NOT NULL,
  gravedad            text DEFAULT 'leve',
  fecha               date NOT NULL DEFAULT current_date,
  asunto              text NOT NULL,
  descripcion         text,
  documento_path      text,
  emitido_por         uuid REFERENCES profiles(id),
  acuse_recibo        boolean NOT NULL DEFAULT false,
  fecha_acuse         timestamptz,
  comentario_empleado text,
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disc_empleado ON acciones_disciplinarias(empleado_id, fecha DESC);

-- ---------------------------------------------------------------------
-- 7. ASISTENCIA (solo admin/auditor)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asistencia (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id    uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  fecha          date NOT NULL,
  hora_entrada   time,
  hora_salida    time,
  tipo           text NOT NULL DEFAULT 'normal',
  horas_extra    numeric(4,2) DEFAULT 0,
  nota           text,
  registrado_por uuid REFERENCES profiles(id),
  created_at     timestamptz DEFAULT now(),
  UNIQUE (empleado_id, fecha)
);

-- ---------------------------------------------------------------------
-- 8. VACACIONES / PERMISOS (el empleado solicita; admin aprueba)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vacaciones_permisos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id      uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  tipo             text NOT NULL DEFAULT 'vacaciones',
  fecha_inicio     date NOT NULL,
  fecha_fin        date NOT NULL,
  dias_habiles     integer NOT NULL,
  motivo           text,
  estado           text NOT NULL DEFAULT 'solicitado',
  solicitado_por   uuid REFERENCES profiles(id),
  aprobado_por     uuid REFERENCES profiles(id),
  fecha_aprobacion timestamptz,
  nota_aprobacion  text,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vac_empleado ON vacaciones_permisos(empleado_id, fecha_inicio DESC);

-- ---------------------------------------------------------------------
-- 9. NÓMINA Y PRESTACIONES (solo admin/auditor)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nomina (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id  uuid NOT NULL REFERENCES organizaciones(id),
  sede_id          uuid REFERENCES sedes(id),
  tipo_periodo     text NOT NULL DEFAULT 'mensual',
  fecha_inicio     date NOT NULL,
  fecha_fin        date NOT NULL,
  periodo_label    text NOT NULL,
  estado           text NOT NULL DEFAULT 'borrador',
  aprobado_por     uuid REFERENCES profiles(id),
  fecha_aprobacion timestamptz,
  fecha_pago       date,
  notas            text,
  created_by       uuid REFERENCES profiles(id),
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nomina_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomina_id               uuid NOT NULL REFERENCES nomina(id) ON DELETE CASCADE,
  empleado_id             uuid NOT NULL REFERENCES empleados(id),
  salario_base            numeric(10,2) NOT NULL,
  dias_trabajados         numeric(4,1)  NOT NULL DEFAULT 30,
  salario_proporcional    numeric(10,2) NOT NULL,
  horas_extra             numeric(4,2)  DEFAULT 0,
  valor_horas_extra       numeric(10,2) DEFAULT 0,
  bonificacion_incentivo  numeric(10,2) DEFAULT 250,
  otros_ingresos          numeric(10,2) DEFAULT 0,
  total_devengado         numeric(10,2) NOT NULL,
  deduccion_igss          numeric(10,2) NOT NULL,
  deduccion_isr           numeric(10,2) DEFAULT 0,
  otras_deducciones       numeric(10,2) DEFAULT 0,
  total_descuentos        numeric(10,2) NOT NULL,
  total_neto              numeric(10,2) NOT NULL,
  estado                  text NOT NULL DEFAULT 'pendiente',
  metodo_pago             text,
  numero_cuenta           text,
  fecha_pago_efectivo     date,
  UNIQUE (nomina_id, empleado_id)
);

CREATE TABLE IF NOT EXISTS prestaciones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id      uuid NOT NULL REFERENCES empleados(id),
  organizacion_id  uuid NOT NULL REFERENCES organizaciones(id),
  anio             integer NOT NULL,
  tipo             text NOT NULL,
  base_calculo     numeric(10,2),
  monto_calculado  numeric(10,2),
  monto_pagado     numeric(10,2),
  estado           text NOT NULL DEFAULT 'pendiente',
  fecha_pago       date,
  comprobante      text,
  notas            text,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (empleado_id, anio, tipo)
);

-- =====================================================================
-- 10. FUNCIONES (RPC)
-- =====================================================================

-- 10.1 Días hábiles entre dos fechas
CREATE OR REPLACE FUNCTION dias_habiles_entre(p_inicio date, p_fin date, p_org uuid)
RETURNS integer
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT count(*)::int
  FROM generate_series(p_inicio, p_fin, interval '1 day') AS d
  WHERE extract(isodow FROM d) < 6
    AND d::date NOT IN (SELECT fecha FROM feriados f WHERE f.organizacion_id = p_org);
$$;

-- 10.2 Actualizar mi perfil (lista blanca — jamás salario/cargo/sede)
CREATE OR REPLACE FUNCTION rpc_actualizar_mi_perfil(
  p_foto_path text, p_sexo text, p_estado_civil text, p_numero_igss text,
  p_telefono text, p_correo text, p_direccion text, p_municipio text,
  p_departamento_residencia text, p_fecha_nacimiento date, p_dpi text, p_nit text,
  p_emergencia_nombre text, p_emergencia_telefono text, p_emergencia_parentesco text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE empleados SET
    foto_path = COALESCE(p_foto_path, foto_path),
    sexo = p_sexo, estado_civil = p_estado_civil, numero_igss = p_numero_igss,
    telefono = p_telefono, correo = p_correo, direccion = p_direccion,
    municipio = p_municipio, departamento_residencia = p_departamento_residencia,
    fecha_nacimiento = p_fecha_nacimiento, dpi = p_dpi, nit = p_nit,
    emergencia_nombre = p_emergencia_nombre, emergencia_telefono = p_emergencia_telefono,
    emergencia_parentesco = p_emergencia_parentesco,
    updated_at = now()
  WHERE profile_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'No tienes expediente asignado. Contacta a administración.'; END IF;
END $$;

-- 10.3 Actualizar datos bancarios (upsert)
CREATE OR REPLACE FUNCTION rpc_actualizar_mis_datos_bancarios(
  p_banco text, p_numero_cuenta text, p_tipo_cuenta text, p_nombre_titular text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid;
BEGIN
  SELECT id INTO v_emp FROM empleados WHERE profile_id = auth.uid();
  IF v_emp IS NULL THEN RAISE EXCEPTION 'No tienes expediente asignado.'; END IF;
  INSERT INTO empleado_datos_bancarios (empleado_id, banco, numero_cuenta, tipo_cuenta, nombre_titular, updated_at)
  VALUES (v_emp, p_banco, p_numero_cuenta, p_tipo_cuenta, p_nombre_titular, now())
  ON CONFLICT (empleado_id) DO UPDATE SET
    banco = excluded.banco, numero_cuenta = excluded.numero_cuenta,
    tipo_cuenta = excluded.tipo_cuenta, nombre_titular = excluded.nombre_titular,
    updated_at = now();
END $$;

-- 10.4 Solicitar vacaciones — valida saldo en días (sin montos)
CREATE OR REPLACE FUNCTION rpc_solicitar_vacaciones(
  p_fecha_inicio date, p_fecha_fin date, p_motivo text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp empleados%ROWTYPE;
  v_dias int;
  v_disp int;
  v_id uuid;
BEGIN
  SELECT * INTO v_emp FROM empleados WHERE profile_id = auth.uid();
  IF v_emp.id IS NULL THEN RAISE EXCEPTION 'No tienes expediente asignado.'; END IF;
  IF p_fecha_fin < p_fecha_inicio THEN RAISE EXCEPTION 'El rango de fechas es inválido.'; END IF;

  v_dias := dias_habiles_entre(p_fecha_inicio, p_fecha_fin, v_emp.organizacion_id);
  IF v_dias <= 0 THEN RAISE EXCEPTION 'El rango seleccionado no contiene días hábiles.'; END IF;

  SELECT v_emp.dias_vacaciones_anuales - COALESCE(SUM(vp.dias_habiles), 0)
    INTO v_disp
  FROM vacaciones_permisos vp
  WHERE vp.empleado_id = v_emp.id
    AND vp.tipo = 'vacaciones'
    AND vp.estado IN ('aprobado','solicitado')
    AND extract(year FROM vp.fecha_inicio) = extract(year FROM p_fecha_inicio);

  IF v_dias > v_disp THEN
    RAISE EXCEPTION 'Solo tienes % día(s) disponibles este año.', GREATEST(v_disp, 0);
  END IF;

  INSERT INTO vacaciones_permisos
    (empleado_id, tipo, fecha_inicio, fecha_fin, dias_habiles, motivo, estado, solicitado_por)
  VALUES
    (v_emp.id, 'vacaciones', p_fecha_inicio, p_fecha_fin, v_dias, p_motivo, 'solicitado', auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 10.5 Responder solicitud (solo admin)
CREATE OR REPLACE FUNCTION rpc_responder_vacaciones(
  p_id uuid, p_aprobar boolean, p_nota text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT rol FROM profiles WHERE id = auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede responder solicitudes.';
  END IF;
  UPDATE vacaciones_permisos SET
    estado = CASE WHEN p_aprobar THEN 'aprobado' ELSE 'rechazado' END,
    aprobado_por = auth.uid(), fecha_aprobacion = now(), nota_aprobacion = p_nota
  WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada.'; END IF;
END $$;

-- 10.6 Acuse de recibo de acción disciplinaria
CREATE OR REPLACE FUNCTION rpc_acusar_disciplinaria(
  p_id uuid, p_comentario text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE acciones_disciplinarias a SET
    acuse_recibo = true, fecha_acuse = now(), comentario_empleado = p_comentario
  WHERE a.id = p_id
    AND a.empleado_id IN (SELECT id FROM empleados WHERE profile_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'Acción no encontrada o no te pertenece.'; END IF;
END $$;

GRANT EXECUTE ON FUNCTION
  rpc_actualizar_mi_perfil(text,text,text,text,text,text,text,text,text,date,text,text,text,text,text),
  rpc_actualizar_mis_datos_bancarios(text,text,text,text),
  rpc_solicitar_vacaciones(date,date,text),
  rpc_responder_vacaciones(uuid,boolean,text),
  rpc_acusar_disciplinaria(uuid,text)
TO authenticated;

-- =====================================================================
-- 11. VISTA DE SALDO DE VACACIONES (solo días — nunca dinero)
-- =====================================================================
CREATE OR REPLACE VIEW v_saldo_vacaciones
WITH (security_invoker = true) AS
SELECT
  e.id   AS empleado_id,
  e.organizacion_id,
  e.sede_id,
  e.dias_vacaciones_anuales AS dias_anuales,
  COALESCE((
    SELECT SUM(vp.dias_habiles) FROM vacaciones_permisos vp
    WHERE vp.empleado_id = e.id AND vp.tipo = 'vacaciones'
      AND vp.estado = 'aprobado'
      AND extract(year FROM vp.fecha_inicio) = extract(year FROM current_date)
  ), 0)::int AS dias_tomados,
  GREATEST(
    e.dias_vacaciones_anuales - COALESCE((
      SELECT SUM(vp.dias_habiles) FROM vacaciones_permisos vp
      WHERE vp.empleado_id = e.id AND vp.tipo = 'vacaciones'
        AND vp.estado = 'aprobado'
        AND extract(year FROM vp.fecha_inicio) = extract(year FROM current_date)
    ), 0), 0
  )::int AS dias_disponibles
FROM empleados e
WHERE e.activo = true;

GRANT SELECT ON v_saldo_vacaciones TO authenticated;

-- =====================================================================
-- 12. ROW LEVEL SECURITY
-- =====================================================================
ALTER TABLE cargos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE feriados                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados                ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados_compensacion   ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleado_datos_bancarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleado_documentos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE acciones_disciplinarias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia               ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacaciones_permisos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomina                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomina_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestaciones             ENABLE ROW LEVEL SECURITY;

-- cargos / feriados: leen miembros de la org; escribe admin
DROP POLICY IF EXISTS cargos_select ON cargos;
CREATE POLICY cargos_select ON cargos FOR SELECT USING (organizacion_id = auth_org_id());
DROP POLICY IF EXISTS cargos_write ON cargos;
CREATE POLICY cargos_write ON cargos FOR ALL
  USING (organizacion_id = auth_org_id() AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK (organizacion_id = auth_org_id() AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS feriados_select ON feriados;
CREATE POLICY feriados_select ON feriados FOR SELECT USING (organizacion_id = auth_org_id());
DROP POLICY IF EXISTS feriados_write ON feriados;
CREATE POLICY feriados_write ON feriados FOR ALL
  USING (organizacion_id = auth_org_id() AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK (organizacion_id = auth_org_id() AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin');

-- empleados: lee su propia fila + admin/auditor; escribe SOLO admin
DROP POLICY IF EXISTS empleados_select ON empleados;
CREATE POLICY empleados_select ON empleados FOR SELECT USING (
  organizacion_id = auth_org_id() AND (
    profile_id = auth.uid()
    OR (SELECT rol FROM profiles WHERE id = auth.uid()) IN ('admin','auditor')
  )
);
DROP POLICY IF EXISTS empleados_write ON empleados;
CREATE POLICY empleados_write ON empleados FOR ALL
  USING (organizacion_id = auth_org_id() AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK (organizacion_id = auth_org_id() AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin');

-- compensación: admin y auditor; empleado SIN acceso
DROP POLICY IF EXISTS comp_select ON empleados_compensacion;
CREATE POLICY comp_select ON empleados_compensacion FOR SELECT USING (
  (SELECT rol FROM profiles WHERE id = auth.uid()) IN ('admin','auditor')
);
DROP POLICY IF EXISTS comp_write ON empleados_compensacion;
CREATE POLICY comp_write ON empleados_compensacion FOR ALL
  USING ((SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin');

-- bancarios: dueño + admin (auditor NO)
DROP POLICY IF EXISTS banc_select ON empleado_datos_bancarios;
CREATE POLICY banc_select ON empleado_datos_bancarios FOR SELECT USING (
  empleado_id IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
  OR (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
);
DROP POLICY IF EXISTS banc_write ON empleado_datos_bancarios;
CREATE POLICY banc_write ON empleado_datos_bancarios FOR ALL
  USING (
    empleado_id IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
    OR (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK (
    empleado_id IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
    OR (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin');

-- documentos: dueño + admin/auditor leen; dueño/admin insertan y borran
DROP POLICY IF EXISTS doc_select ON empleado_documentos;
CREATE POLICY doc_select ON empleado_documentos FOR SELECT USING (
  empleado_id IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
  OR (SELECT rol FROM profiles WHERE id = auth.uid()) IN ('admin','auditor')
);
DROP POLICY IF EXISTS doc_insert ON empleado_documentos;
CREATE POLICY doc_insert ON empleado_documentos FOR INSERT WITH CHECK (
  empleado_id IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
  OR (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
);
DROP POLICY IF EXISTS doc_delete ON empleado_documentos;
CREATE POLICY doc_delete ON empleado_documentos FOR DELETE USING (
  empleado_id IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
  OR (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- disciplina: dueño + admin leen; SOLO admin escribe (acuse va por RPC)
DROP POLICY IF EXISTS disc_select ON acciones_disciplinarias;
CREATE POLICY disc_select ON acciones_disciplinarias FOR SELECT USING (
  empleado_id IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
  OR (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
);
DROP POLICY IF EXISTS disc_write ON acciones_disciplinarias;
CREATE POLICY disc_write ON acciones_disciplinarias FOR ALL
  USING (organizacion_id = auth_org_id() AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK (organizacion_id = auth_org_id() AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin');

-- asistencia: admin/auditor leen; admin escribe
DROP POLICY IF EXISTS asist_select ON asistencia;
CREATE POLICY asist_select ON asistencia FOR SELECT USING (
  (SELECT rol FROM profiles WHERE id = auth.uid()) IN ('admin','auditor')
);
DROP POLICY IF EXISTS asist_write ON asistencia;
CREATE POLICY asist_write ON asistencia FOR ALL
  USING ((SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin');

-- vacaciones: dueño lee/crea; admin/auditor leen todas; admin aprueba (vía RPC)
DROP POLICY IF EXISTS vac_select ON vacaciones_permisos;
CREATE POLICY vac_select ON vacaciones_permisos FOR SELECT USING (
  empleado_id IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
  OR (SELECT rol FROM profiles WHERE id = auth.uid()) IN ('admin','auditor')
);
DROP POLICY IF EXISTS vac_insert ON vacaciones_permisos;
CREATE POLICY vac_insert ON vacaciones_permisos FOR INSERT WITH CHECK (
  empleado_id IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
);
DROP POLICY IF EXISTS vac_admin_update ON vacaciones_permisos;
CREATE POLICY vac_admin_update ON vacaciones_permisos FOR UPDATE
  USING ((SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin');

-- nómina / items / prestaciones: admin/auditor leen; admin escribe. Empleado SIN acceso
DROP POLICY IF EXISTS nom_select ON nomina;
CREATE POLICY nom_select ON nomina FOR SELECT USING (
  organizacion_id = auth_org_id()
  AND (SELECT rol FROM profiles WHERE id = auth.uid()) IN ('admin','auditor')
);
DROP POLICY IF EXISTS nom_write ON nomina;
CREATE POLICY nom_write ON nomina FOR ALL
  USING (organizacion_id = auth_org_id() AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK (organizacion_id = auth_org_id() AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS nomit_select ON nomina_items;
CREATE POLICY nomit_select ON nomina_items FOR SELECT USING (
  (SELECT rol FROM profiles WHERE id = auth.uid()) IN ('admin','auditor')
);
DROP POLICY IF EXISTS nomit_write ON nomina_items;
CREATE POLICY nomit_write ON nomina_items FOR ALL
  USING ((SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS prest_select ON prestaciones;
CREATE POLICY prest_select ON prestaciones FOR SELECT USING (
  organizacion_id = auth_org_id()
  AND (SELECT rol FROM profiles WHERE id = auth.uid()) IN ('admin','auditor')
);
DROP POLICY IF EXISTS prest_write ON prestaciones;
CREATE POLICY prest_write ON prestaciones FOR ALL
  USING (organizacion_id = auth_org_id() AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK (organizacion_id = auth_org_id() AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin');

-- =====================================================================
-- 13. STORAGE (buckets privados)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('rrhh-fotos','rrhh-fotos', false), ('rrhh-documentos','rrhh-documentos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS rrhh_storage_select ON storage.objects;
CREATE POLICY rrhh_storage_select ON storage.objects FOR SELECT USING (
  bucket_id IN ('rrhh-fotos','rrhh-documentos') AND (
    (storage.foldername(name))[2]::uuid IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
    OR (SELECT rol FROM profiles WHERE id = auth.uid()) IN ('admin','auditor')
  )
);
DROP POLICY IF EXISTS rrhh_storage_insert ON storage.objects;
CREATE POLICY rrhh_storage_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id IN ('rrhh-fotos','rrhh-documentos') AND (
    (storage.foldername(name))[2]::uuid IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
    OR (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
  )
);
DROP POLICY IF EXISTS rrhh_storage_delete ON storage.objects;
CREATE POLICY rrhh_storage_delete ON storage.objects FOR DELETE USING (
  bucket_id IN ('rrhh-fotos','rrhh-documentos') AND (
    (storage.foldername(name))[2]::uuid IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
    OR (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
  )
);

COMMIT;

-- =====================================================================
-- 14. BACKFILL — un expediente stub por cada usuario existente
--     Fuera del BEGIN/COMMIT para que un fallo no revierta las tablas.
-- =====================================================================
INSERT INTO empleados (organizacion_id, sede_id, profile_id, nombre, apellido, activo)
SELECT
  p.organizacion_id,
  p.sede_id,
  p.id,
  split_part(COALESCE(p.nombre, 'Sin nombre'), ' ', 1),
  NULLIF(trim(regexp_replace(COALESCE(p.nombre, ''), '^\S+\s*', '')), ''),
  true
FROM profiles p
WHERE p.sede_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM empleados e WHERE e.profile_id = p.id);

-- =====================================================================
-- 15. REALTIME (fuera de la transacción principal)
-- =====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE empleados;
ALTER PUBLICATION supabase_realtime ADD TABLE vacaciones_permisos;
ALTER PUBLICATION supabase_realtime ADD TABLE acciones_disciplinarias;
ALTER PUBLICATION supabase_realtime ADD TABLE nomina;
