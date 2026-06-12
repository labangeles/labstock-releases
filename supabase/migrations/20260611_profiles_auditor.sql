-- Agregar 'auditor' al CHECK constraint de profiles.rol
-- Sin este cambio el trigger falla al crear usuarios con rol='auditor'
-- causando "Database error creating new user" en Supabase.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_rol_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('admin', 'tecnico', 'auditor'));
