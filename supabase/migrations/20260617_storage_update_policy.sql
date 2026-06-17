-- Agrega política UPDATE para storage de fotos/documentos RRHH
-- Sin esta política el upsert de fotos falla si el archivo ya existe.

DROP POLICY IF EXISTS rrhh_storage_update ON storage.objects;
CREATE POLICY rrhh_storage_update ON storage.objects FOR UPDATE USING (
  bucket_id IN ('rrhh-fotos','rrhh-documentos') AND (
    (storage.foldername(name))[2]::uuid IN (SELECT id FROM empleados WHERE profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin','auditor'))
  )
);
