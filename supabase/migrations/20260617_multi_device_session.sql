-- ──────────────────────────────────────────────────────────────
-- Multi-dispositivo + Sesión única de admin
-- ──────────────────────────────────────────────────────────────

-- 1. Token de sesión para admin (detectar login en otro dispositivo)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS session_token uuid DEFAULT NULL;

-- 2. Lista de machine IDs permitidos (reemplaza el campo único machine_id)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS machine_ids text[] NOT NULL DEFAULT '{}';

-- 3. Migrar registros existentes: mover machine_id al nuevo array
UPDATE profiles
   SET machine_ids = ARRAY[machine_id]
 WHERE machine_id IS NOT NULL AND machine_id <> '';

-- 4. Límite de dispositivos por sede (default 1)
ALTER TABLE sedes ADD COLUMN IF NOT EXISTS max_dispositivos integer NOT NULL DEFAULT 1;

-- 5. Sedes con múltiples equipos
UPDATE sedes SET max_dispositivos = 5 WHERE nombre ILIKE '%Santa Luc%';
UPDATE sedes SET max_dispositivos = 2 WHERE nombre ILIKE '%Gomera%';
