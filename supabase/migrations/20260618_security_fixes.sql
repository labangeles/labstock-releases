-- ============================================================
--  LabStock — Security fixes v1.8.8
--  Aplicar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- C2: profiles_self_update — agregar WITH CHECK para impedir
--     que un usuario eleve su propio rol, org o permisos.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;

CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id               = auth.uid()
    -- El rol no puede cambiar (compara nuevo valor contra el actual en BD)
    AND rol              = (SELECT p.rol              FROM public.profiles p WHERE p.id = auth.uid())
    AND organizacion_id  = (SELECT p.organizacion_id  FROM public.profiles p WHERE p.id = auth.uid())
    AND permisos     IS NOT DISTINCT FROM
        (SELECT p.permisos     FROM public.profiles p WHERE p.id = auth.uid())
    AND sede_id      IS NOT DISTINCT FROM
        (SELECT p.sede_id      FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- ALTO: Auditor solo debe tener SELECT en marcajes y horarios
--       (antes tenía FOR ALL = INSERT/UPDATE/DELETE también)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_marcajes_all"  ON public.asistencia_marcajes;
DROP POLICY IF EXISTS "admin_horarios_all"  ON public.horarios_empleados;

CREATE POLICY "admin_marcajes_all" ON public.asistencia_marcajes FOR ALL
  USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND organizacion_id = (SELECT organizacion_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "auditor_marcajes_select" ON public.asistencia_marcajes FOR SELECT
  USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'auditor'
    AND organizacion_id = (SELECT organizacion_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "admin_horarios_all" ON public.horarios_empleados FOR ALL
  USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND organizacion_id = (SELECT organizacion_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "auditor_horarios_select" ON public.horarios_empleados FOR SELECT
  USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'auditor'
    AND organizacion_id = (SELECT organizacion_id FROM public.profiles WHERE id = auth.uid()));

-- ────────────────────────────────────────────────────────────
-- ALTO: chat_fotos_perfil — filtrar por organización del caller
--       Antes devolvía fotos de TODAS las organizaciones
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_fotos_perfil()
RETURNS TABLE(profile_id uuid, foto_path text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT e.profile_id, e.foto_path
  FROM   public.empleados e
  WHERE  e.profile_id IS NOT NULL
    AND  e.foto_path  IS NOT NULL
    AND  e.organizacion_id = (
      SELECT organizacion_id FROM public.profiles WHERE id = auth.uid()
    );
$$;

-- ────────────────────────────────────────────────────────────
-- C5: rpc_incrementar_stock — actualización atómica de stock.
--     Reemplaza el read-modify-write del cliente en ComprasScreen.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_incrementar_stock(
  p_item_id uuid,
  p_cantidad integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE items SET
    cantidad_actual = CASE
      WHEN cantidad_maxima IS NOT NULL
        THEN LEAST(cantidad_maxima, cantidad_actual + p_cantidad)
      ELSE cantidad_actual + p_cantidad
    END
  WHERE id = p_item_id;
END;
$$;

-- Revocar acceso directo; solo callable por usuarios autenticados vía RPC
REVOKE ALL ON FUNCTION public.rpc_incrementar_stock(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_incrementar_stock(uuid, integer) TO authenticated;
