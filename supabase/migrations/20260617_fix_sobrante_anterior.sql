-- ============================================================
-- FIX: sobrante_anterior no se acumulaba entre días consecutivos
-- sin depósito. El sobrante de días anteriores se "perdía" porque
-- la vista v_cuadres_resumen calculaba diferencia sin sumarlo.
--
-- CAUSA RAÍZ: la vista computaba:
--   caja_final = caja_base + ingreso - gastos - depositos
-- ...ignorando el sobrante anterior. Al cerrar un cuadre "sobrante"
-- sin depósito, la diferencia guardada en la vista era solo la del
-- día, y el siguiente día solo recogía ESA diferencia, perdiendo
-- la acumulación de días previos sin depósito.
-- ============================================================

-- 1. Agregar columna que persiste el sobrante al momento de apertura
ALTER TABLE cuadres_caja
  ADD COLUMN IF NOT EXISTS sobrante_anterior numeric(10,2) NOT NULL DEFAULT 0;

-- 2. Recrear la vista incluyendo sobrante_anterior en todos los cálculos
CREATE OR REPLACE VIEW v_cuadres_resumen
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.sede_id,
  s.nombre                                                    AS sede_nombre,
  s.organizacion_id,
  c.fecha,
  c.caja_base,
  c.sobrante_anterior,
  c.ingreso_dia,
  COALESCE(g.total_gastos,    0)                              AS total_gastos,
  COALESCE(d.total_depositos, 0)                              AS total_depositos,
  c.sobrante_anterior + c.ingreso_dia
    - COALESCE(g.total_gastos, 0)                             AS deposito_esperado,
  c.caja_base + c.sobrante_anterior + c.ingreso_dia
    - COALESCE(g.total_gastos,    0)
    - COALESCE(d.total_depositos, 0)                          AS caja_final,
  (c.caja_base + c.sobrante_anterior + c.ingreso_dia
    - COALESCE(g.total_gastos,    0)
    - COALESCE(d.total_depositos, 0)) - c.caja_base           AS diferencia,
  c.estado,
  c.cerrado_at,
  c.notas,
  c.creado_por
FROM cuadres_caja c
JOIN sedes s ON s.id = c.sede_id
LEFT JOIN (
  SELECT cuadre_id, SUM(monto) AS total_gastos
  FROM gastos_caja GROUP BY cuadre_id
) g ON g.cuadre_id = c.id
LEFT JOIN (
  SELECT cuadre_id, SUM(monto) AS total_depositos
  FROM depositos_caja GROUP BY cuadre_id
) d ON d.cuadre_id = c.id;

-- 3. Recalcular sobrante_anterior para TODOS los registros históricos
--    procesándolos en orden cronológico por sede (cada registro depende
--    del anterior ya corregido).
DO $$
DECLARE
  rec            RECORD;
  prev_diferencia NUMERIC;
BEGIN
  FOR rec IN
    SELECT id, sede_id, fecha
    FROM   cuadres_caja
    ORDER  BY sede_id, fecha ASC
  LOOP
    SELECT
      GREATEST(
        (c2.caja_base + c2.sobrante_anterior + c2.ingreso_dia
          - COALESCE((SELECT SUM(m) FROM (SELECT monto m FROM gastos_caja WHERE cuadre_id = c2.id) x), 0)
          - COALESCE((SELECT SUM(m) FROM (SELECT monto m FROM depositos_caja WHERE cuadre_id = c2.id) x), 0)
        ) - c2.caja_base,
        0
      )
    INTO prev_diferencia
    FROM  cuadres_caja c2
    WHERE c2.sede_id = rec.sede_id
      AND c2.fecha   < rec.fecha
      AND c2.estado  = 'cerrado'
    ORDER BY c2.fecha DESC
    LIMIT 1;

    UPDATE cuadres_caja
    SET    sobrante_anterior = COALESCE(prev_diferencia, 0)
    WHERE  id = rec.id;
  END LOOP;
END $$;
