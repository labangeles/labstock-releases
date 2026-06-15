-- ============================================================
-- LABSTOCK — Campo "en uso" por insumo
-- Marca si la última unidad disponible ya está abierta/en uso
-- ============================================================

ALTER TABLE items ADD COLUMN IF NOT EXISTS en_uso boolean DEFAULT false;

COMMENT ON COLUMN items.en_uso IS
  'Indica si la unidad actual del insumo ya está abierta/en uso (no es reserva virgen).';
