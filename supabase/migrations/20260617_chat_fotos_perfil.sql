-- Función para que el chat obtenga foto_path de compañeros.
-- Solo requiere usuario autenticado; sin filtro de org para que funcione entre sedes.
CREATE OR REPLACE FUNCTION chat_fotos_perfil()
RETURNS TABLE(profile_id uuid, foto_path text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT e.profile_id, e.foto_path
  FROM   empleados e
  WHERE  e.profile_id IS NOT NULL
    AND  e.foto_path  IS NOT NULL
    AND  auth.uid() IS NOT NULL;
$$;
