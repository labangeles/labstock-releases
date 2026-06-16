// src/features/rrhh/lib/storage.js
// Buckets privados. Imágenes/documentos se sirven con URL firmada.
import { supabase } from '../../../lib/supabase';

export async function urlFirmada(bucket, path, segundos = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, segundos);
  if (error) { console.error('urlFirmada', error); return null; }
  return data.signedUrl;
}

const extDe = (file) => {
  const p = file.name.split('.');
  return p.length > 1 ? p.pop().toLowerCase() : 'bin';
};

const sanitizar = (nombre) => nombre.replace(/[^\w.\-]+/g, '_');

async function subirArchivo(bucket, path, file, { upsert = false } = {}) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert, contentType: file.type });
  if (error) throw error;
  return path;
}

// Foto de perfil — rrhh-fotos/empleados/{id}/foto.{ext}
export async function subirFoto(empleadoId, file) {
  if (file.size > 2 * 1024 * 1024) throw new Error('La foto no debe superar 2 MB.');
  const path = `empleados/${empleadoId}/foto.${extDe(file)}`;
  await subirArchivo('rrhh-fotos', path, file, { upsert: true });
  return path;
}

// Documento — rrhh-documentos/empleados/{id}/{tipo}/{timestamp}_{nombre}
export async function subirDocumento(empleadoId, tipo, file) {
  if (file.size > 10 * 1024 * 1024) throw new Error('El documento no debe superar 10 MB.');
  const path = `empleados/${empleadoId}/${tipo}/${Date.now()}_${sanitizar(file.name)}`;
  await subirArchivo('rrhh-documentos', path, file, { upsert: false });
  return path;
}

export async function borrarArchivo(bucket, path) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
