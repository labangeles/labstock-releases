// src/features/rrhh/lib/useMiEmpleado.js
// Carga la fila de empleados del usuario actual.
// La RLS garantiza que solo devuelva la fila propia.
// empleados NO contiene salario (privacidad).
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

export function useMiEmpleado() {
  const { profile } = useAuth();
  const [empleado, setEmpleado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!profile?.id) { setLoading(false); return; }
    setLoading(true); setError(null);
    const { data, error } = await supabase
      .from('empleados')
      .select('*, cargos(nombre), sedes(nombre)')
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (error) setError(error);
    setEmpleado(data || null);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { cargar(); }, [cargar]);

  return { empleado, loading, error, reload: cargar };
}
