-- FIX: Actualizar handle_new_user para incluir organizacion_id
-- La migración del módulo Caja agregó organizacion_id NOT NULL a profiles
-- pero el trigger original no la incluía, causando
-- "Database error creating new user" para CUALQUIER nuevo usuario.
--
-- Fix adicional: ampliar el CHECK de rol para incluir 'auditor'.

-- 1. Actualizar el trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, codigo, nombre, rol, sede_id, organizacion_id)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'tecnico'),
    NULLIF(NEW.raw_user_meta_data->>'sede_id', '')::uuid,
    COALESCE(
      (SELECT organizacion_id FROM public.sedes
       WHERE id = NULLIF(NEW.raw_user_meta_data->>'sede_id', '')::uuid),
      (SELECT id FROM public.organizaciones LIMIT 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Ampliar el CHECK de rol para incluir 'auditor'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_rol_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('admin', 'tecnico', 'auditor'));
