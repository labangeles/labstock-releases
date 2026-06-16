// Galería horizontal de fotos del personal activo
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { T } from '../../../shared/ui';
import { urlFirmada } from '../../rrhh/lib/storage';

function FotoCard({ emp }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (emp.foto_path) urlFirmada('rrhh-fotos', emp.foto_path).then(setUrl);
  }, [emp.foto_path]);

  const iniciales = `${emp.nombre?.[0] || ''}${emp.apellido?.[0] || ''}`.toUpperCase();

  return (
    <div style={{ textAlign: 'center', flexShrink: 0, width: 88 }}>
      <div style={{
        width: 68, height: 68, borderRadius: '50%', overflow: 'hidden',
        margin: '0 auto 8px',
        background: url ? 'transparent' : T.tealXL,
        border: `2px solid ${T.teal}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {url
          ? <img src={url} alt={emp.nombre}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ color: T.teal, fontWeight: 700, fontSize: 22 }}>{iniciales}</span>
        }
      </div>
      <div style={{ color: T.hi, fontSize: 11.5, fontWeight: 600, lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {emp.nombre}
      </div>
      <div style={{ color: T.lo, fontSize: 10.5, marginTop: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {emp.cargos?.nombre || 'Sin cargo'}
      </div>
    </div>
  );
}

export function EquipoCarousel({ organizacionId }) {
  const [empleados, setEmpleados] = useState([]);

  useEffect(() => {
    if (!organizacionId) return;
    supabase.from('empleados')
      .select('id, nombre, apellido, foto_path, cargos(nombre)')
      .eq('organizacion_id', organizacionId)
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setEmpleados(data || []));
  }, [organizacionId]);

  if (empleados.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.lo, textTransform: 'uppercase',
                    letterSpacing: '0.09em', marginBottom: 12 }}>
        Fotografía del personal
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 14, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4,
                      scrollbarWidth: 'thin' }}>
          {empleados.map((emp) => <FotoCard key={emp.id} emp={emp} />)}
        </div>
      </div>
    </div>
  );
}
