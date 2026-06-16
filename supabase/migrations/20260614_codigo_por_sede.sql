-- ============================================================
-- LABSTOCK — Constraint codigo único por sede (no global)
-- Permite que el mismo código exista en distintas sedes
-- ============================================================

-- Eliminar constraint global anterior
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_codigo_unique;

-- Nuevo índice único compuesto: (codigo, sede_id), solo cuando codigo no es null
-- Esto permite múltiples items sin código en la misma sede
CREATE UNIQUE INDEX IF NOT EXISTS items_codigo_sede_unique
  ON items (codigo, sede_id)
  WHERE codigo IS NOT NULL;
