-- ============================================================
-- LABSTOCK — Binding de máquina por usuario
-- Cada usuario no-admin queda atado a su PC registrada
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS machine_id text;

COMMENT ON COLUMN profiles.machine_id IS
  'ID único del hardware donde el usuario se registró por primera vez. NULL = aún no asignado. Admin lo puede resetear.';
