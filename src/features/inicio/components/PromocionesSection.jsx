// Promociones del mes — admin programa, todos ven
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Btn, Field, TInput, IconBtn, Ico } from '../../../shared/ui';

const HOY = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

const FORM_INIT = { titulo: '', descripcion: '', precio: '', vigente_desde: HOY(), vigente_hasta: '' };

function PromoCard({ p, isAdmin, onEliminar, onEditar }) {
  const desde = new Date(p.vigente_desde + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'long' });
  const hasta  = new Date(p.vigente_hasta  + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{
      background: `linear-gradient(135deg, ${T.tealXL} 0%, ${T.surface} 100%)`,
      border: `1px solid ${T.teal}55`, borderLeft: `5px solid ${T.teal}`,
      borderRadius: 14, padding: '16px 18px', position: 'relative',
    }}>
      {isAdmin && (
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 2 }}>
          <IconBtn icon={<Ico.Edit s={13}/>} onClick={() => onEditar(p)} title="Editar" />
          <IconBtn icon={<Ico.Trash s={13}/>} onClick={() => onEliminar(p.id)} danger title="Eliminar" />
        </div>
      )}
      <div style={{ fontSize: 16, fontWeight: 700, color: T.tealDk, marginBottom: 6, paddingRight: 56 }}>
        {p.titulo}
      </div>
      {p.descripcion && (
        <div style={{ color: T.mid, fontSize: 13.5, lineHeight: 1.5, marginBottom: 8 }}>
          {p.descripcion}
        </div>
      )}
      {p.precio != null && (
        <div style={{ fontSize: 22, fontWeight: 800, color: '#E07000', marginBottom: 8,
                      letterSpacing: '-0.02em' }}>
          Q {Number(p.precio).toFixed(2)}
        </div>
      )}
      <div style={{ fontSize: 12, color: T.lo }}>
        Vigente del <strong>{desde}</strong> al <strong>{hasta}</strong>
      </div>
    </div>
  );
}

export function PromocionesSection({ profile, isAdmin }) {
  const [promos, setPromos] = useState([]);
  const [modo, setModo] = useState(null); // null | 'nuevo' | 'editar'
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(FORM_INIT);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState(null);

  const cargar = useCallback(async () => {
    const hoy = HOY();
    const { data, error } = await supabase.from('promociones')
      .select('*')
      .eq('organizacion_id', profile.organizacion_id)
      .eq('activo', true)
      .lte('vigente_desde', hoy)
      .gte('vigente_hasta', hoy)
      .order('vigente_hasta');
    if (!error) setPromos(data || []);
  }, [profile.organizacion_id]);

  useEffect(() => { cargar(); }, [cargar]);

  const set = (campo) => (e) =>
    setForm((f) => ({ ...f, [campo]: e?.target ? e.target.value : e }));

  const abrirNuevo = () => {
    setForm(FORM_INIT); setEditId(null); setErr(null); setModo('nuevo');
  };

  const abrirEditar = (p) => {
    setForm({
      titulo: p.titulo || '',
      descripcion: p.descripcion || '',
      precio: p.precio != null ? String(p.precio) : '',
      vigente_desde: p.vigente_desde || HOY(),
      vigente_hasta: p.vigente_hasta || '',
    });
    setEditId(p.id); setErr(null); setModo('editar');
  };

  const cancelar = () => { setModo(null); setEditId(null); setErr(null); };

  const guardar = async () => {
    if (!form.titulo || !form.vigente_hasta) { setErr('Título y fecha de fin son obligatorios.'); return; }
    setGuardando(true); setErr(null);

    const payload = {
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      precio: form.precio !== '' ? Number(form.precio) : null,
      vigente_desde: form.vigente_desde,
      vigente_hasta: form.vigente_hasta,
    };

    let error;
    if (modo === 'editar') {
      ({ error } = await supabase.from('promociones').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('promociones').insert({
        ...payload, organizacion_id: profile.organizacion_id, creado_por: profile.id,
      }));
    }

    if (error) setErr(error.message);
    else { cancelar(); cargar(); }
    setGuardando(false);
  };

  const eliminar = async (id) => {
    const { error } = await supabase.from('promociones').update({ activo: false }).eq('id', id);
    if (error) { window.alert('Error al eliminar la promoción. Intenta de nuevo.'); return; }
    cargar();
  };

  if (!isAdmin && promos.length === 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.lo, textTransform: 'uppercase',
                      letterSpacing: '0.09em' }}>
          Promociones del mes
        </div>
        {isAdmin && (
          <Btn size="sm" variant="ghost" onClick={modo ? cancelar : abrirNuevo}>
            {modo ? 'Cancelar' : '+ Nueva promoción'}
          </Btn>
        )}
      </div>

      {/* Formulario nuevo / editar */}
      {isAdmin && modo && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
                      padding: 16, marginBottom: 12,
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ color: T.lo, fontSize: 12, fontWeight: 600, gridColumn: '1 / -1' }}>
            {modo === 'editar' ? 'Editando promoción' : 'Nueva promoción'}
          </div>
          <Field label="Título" style={{ gridColumn: '1 / -1' }}>
            <TInput value={form.titulo} onChange={set('titulo')} placeholder="Ej. 10% en perfil lipídico" />
          </Field>
          <Field label="Descripción (opcional)" style={{ gridColumn: '1 / -1' }}>
            <TInput value={form.descripcion} onChange={set('descripcion')}
              placeholder="Detalle de la promoción…" />
          </Field>
          <Field label="Precio (opcional)">
            <TInput type="number" value={form.precio} onChange={set('precio')} placeholder="0.00" />
          </Field>
          <Field label="Vigente desde">
            <TInput type="date" value={form.vigente_desde} onChange={set('vigente_desde')} />
          </Field>
          <Field label="Vigente hasta">
            <TInput type="date" value={form.vigente_hasta} onChange={set('vigente_hasta')} />
          </Field>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <Btn onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : modo === 'editar' ? 'Actualizar' : 'Publicar'}
            </Btn>
            <Btn variant="secondary" onClick={cancelar} disabled={guardando}>Cancelar</Btn>
          </div>
          {err && <div style={{ color: T.crit, fontSize: 13, gridColumn: '1 / -1' }}>{err}</div>}
        </div>
      )}

      {/* Lista */}
      {promos.length === 0 ? (
        isAdmin && (
          <div style={{ background: T.canvas, border: `1px dashed ${T.border}`, borderRadius: 12,
                        padding: 20, textAlign: 'center', color: T.lo, fontSize: 13 }}>
            No hay promociones vigentes este mes. Usa "+ Nueva promoción" para agregar una.
          </div>
        )
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {promos.map((p) => (
            <PromoCard key={p.id} p={p} isAdmin={isAdmin} onEliminar={eliminar} onEditar={abrirEditar} />
          ))}
        </div>
      )}
    </div>
  );
}
