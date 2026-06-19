-- Fix: RLS de vacaciones_permisos no filtraba por organización para admin/auditor.
-- La tabla no tiene organizacion_id, así que filtramos a través de empleados.

DROP POLICY IF EXISTS vac_select ON vacaciones_permisos;
CREATE POLICY vac_select ON vacaciones_permisos FOR SELECT USING (
  -- El propio empleado ve sus solicitudes
  empleado_id IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
  OR
  -- Admin/auditor ven solo su organización (a través del empleado)
  (
    (SELECT rol FROM profiles WHERE id = auth.uid()) IN ('admin', 'auditor')
    AND empleado_id IN (SELECT id FROM empleados WHERE organizacion_id = auth_org_id())
  )
);
