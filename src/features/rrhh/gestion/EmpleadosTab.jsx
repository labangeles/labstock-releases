// src/features/rrhh/gestion/EmpleadosTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { T, Btn, TInput, TSelect, Field, IconBtn, Ico } from '../../../shared/ui';
import { useAuth } from '../../../contexts/AuthContext';
import Emblem from '../../../components/Emblem';
import { RECONOCIMIENTOS } from '../../../components/Reconocimientos';

const SEL = { value: '', label: 'Sin cargo' };

const HOR_DEF = {
  hora_entrada: '07:00', hora_salida: '17:00',
  tiene_desayuno: false,
  duracion_desayuno_min: 20, duracion_comida_min: 60,
  tolerancia_min: 2, dias_laborales: [1, 2, 3, 4, 5],
};

const DIAS_SEM = [
  { num: 1, label: 'L' }, { num: 2, label: 'M' }, { num: 3, label: 'X' },
  { num: 4, label: 'J' }, { num: 5, label: 'V' }, { num: 6, label: 'S' },
  { num: 7, label: 'D' },
];
const DIAS_NOMBRE = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo' };

const HOY = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
const MES_DESDE = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
})();
const MES_HASTA = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

export default function EmpleadosTab() {
  const { profile } = useAuth();
  const [empleados,      setEmpleados]      = useState([]);
  const [cargos,         setCargos]         = useState([]);
  const [profiles,       setProfiles]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [busqueda,       setBusqueda]       = useState('');
  const [editando,       setEditando]       = useState(null);
  const [edits,          setEdits]          = useState({});
  const [guardando,      setGuardando]      = useState(false);
  const [msg,            setMsg]            = useState(null);
  const [empRecons,      setEmpRecons]      = useState(new Set());
  const [togglingRecon,  setTogglingRecon]  = useState(null);
  const [horarioEd,      setHorarioEd]      = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [e, c, p] = await Promise.all([
      supabase.from('empleados')
        .select('*, cargos(id, nombre), sedes(nombre), organizacion_id')
        .eq('organizacion_id', profile.organizacion_id)
        .order('apellido'),
      supabase.from('cargos')
        .select('id, nombre')
        .eq('organizacion_id', profile.organizacion_id)
        .eq('activo', true)
        .order('nombre'),
      supabase.from('profiles')
        .select('id, nombre, codigo, rol')
        .eq('organizacion_id', profile.organizacion_id)
        .eq('activo', true)
        .order('nombre'),
    ]);
    setEmpleados(e.data || []);
    setCargos(c.data || []);
    setProfiles(p.data || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { cargar(); }, [cargar]);

  const CARGO_OPC = [SEL, ...(cargos.map((c) => ({ value: c.id, label: c.nombre })))];

  const cargarEmpRecons = useCallback(async (empId) => {
    const [{ data: monthly }, { data: permanent }] = await Promise.all([
      supabase.from('acciones_disciplinarias')
        .select('asunto')
        .eq('empleado_id', empId)
        .eq('tipo', 'reconocimiento')
        .neq('asunto', 'Años de servicio')
        .gte('fecha', MES_DESDE)
        .lte('fecha', MES_HASTA),
      supabase.from('acciones_disciplinarias')
        .select('asunto')
        .eq('empleado_id', empId)
        .eq('tipo', 'reconocimiento')
        .eq('asunto', 'Años de servicio'),
    ]);
    const titles = new Set([...(monthly || []), ...(permanent || [])].map(r => r.asunto));
    setEmpRecons(titles);
  }, []);

  const iniciarEdit = async (emp) => {
    setEditando(emp.id);
    setEdits({ cargo_id: emp.cargo_id || '', fecha_ingreso: emp.fecha_ingreso || '', profile_id: emp.profile_id || '' });
    setMsg(null);
    setEmpRecons(new Set());
    const [, { data: hor }] = await Promise.all([
      cargarEmpRecons(emp.id),
      supabase.from('horarios_empleados').select('*').eq('empleado_id', emp.id).maybeSingle(),
    ]);
    setHorarioEd(hor ? { ...hor } : { ...HOR_DEF });
  };

  const cancelar = () => { setEditando(null); setEdits({}); setEmpRecons(new Set()); setHorarioEd(null); };

  const setHor = (key, val) => setHorarioEd(h => ({ ...h, [key]: val }));
  const toggleDia = (num) => setHorarioEd(h => {
    const dias = h.dias_laborales || [];
    const nuevos = dias.includes(num) ? dias.filter(d => d !== num) : [...dias, num].sort((a, b) => a - b);
    // Limpiar overrides de días que ya no son laborales
    const esp = { ...(h.horarios_especiales || {}) };
    if (!nuevos.includes(num)) delete esp[String(num)];
    return { ...h, dias_laborales: nuevos, horarios_especiales: esp };
  });
  const setEspecial = (diaNum, field, val) => setHorarioEd(h => {
    const esp = { ...(h.horarios_especiales || {}) };
    esp[String(diaNum)] = { ...(esp[String(diaNum)] || {}), [field]: val };
    if (!esp[String(diaNum)].hora_entrada && !esp[String(diaNum)].hora_salida)
      delete esp[String(diaNum)];
    return { ...h, horarios_especiales: esp };
  });
  const clearEspecial = (diaNum) => setHorarioEd(h => {
    const esp = { ...(h.horarios_especiales || {}) };
    delete esp[String(diaNum)];
    return { ...h, horarios_especiales: esp };
  });

  const guardar = async (emp) => {
    setGuardando(true); setMsg(null);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('empleados').update({
        cargo_id:      edits.cargo_id     || null,
        fecha_ingreso: edits.fecha_ingreso || null,
        profile_id:    edits.profile_id   || null,
      }).eq('id', emp.id),
      supabase.from('horarios_empleados').upsert(
        { empleado_id: emp.id, organizacion_id: emp.organizacion_id, ...horarioEd },
        { onConflict: 'empleado_id' },
      ),
    ]);
    const error = e1 || e2;
    if (error) setMsg({ id: emp.id, txt: error.message });
    else { setEditando(null); setEdits({}); setHorarioEd(null); setEmpRecons(new Set()); cargar(); }
    setGuardando(false);
  };

  const toggleActivo = async (emp) => {
    await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id);
    cargar();
  };

  const toggleRecon = async (cat) => {
    if (togglingRecon || !editando) return;
    setTogglingRecon(cat.id);
    const isPermanent = cat.title === 'Años de servicio';
    const isEarned = empRecons.has(cat.title);

    if (isEarned) {
      let q = supabase.from('acciones_disciplinarias')
        .delete()
        .eq('empleado_id', editando)
        .eq('tipo', 'reconocimiento')
        .eq('asunto', cat.title);
      if (!isPermanent) q = q.gte('fecha', MES_DESDE).lte('fecha', MES_HASTA);
      await q;
    } else {
      await supabase.from('acciones_disciplinarias').insert({
        empleado_id:     editando,
        organizacion_id: profile.organizacion_id,
        tipo:            'reconocimiento',
        gravedad:        'leve',
        fecha:           HOY,
        asunto:          cat.title,
        descripcion:     cat.desc,
        emitido_por:     profile.id,
      });
    }
    await cargarEmpRecons(editando);
    setTogglingRecon(null);
  };

  const filtrados = empleados.filter((e) => {
    const txt = busqueda.toLowerCase();
    return !txt || `${e.nombre} ${e.apellido}`.toLowerCase().includes(txt);
  });

  if (loading) return <div style={{ color: T.lo, padding: 24 }}>Cargando…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, maxWidth: 300 }}>
          <TInput
            value={busqueda}
            onChange={(e) => setBusqueda(e?.target ? e.target.value : e)}
            placeholder="Buscar por nombre o apellido…"
          />
        </div>
        <div style={{ color: T.lo, fontSize: 13 }}>{filtrados.length} empleado(s)</div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {filtrados.length === 0 && (
          <div style={{ color: T.lo, padding: 16 }}>No hay empleados registrados.</div>
        )}
        {filtrados.map((emp) => {
          const enEdit = editando === emp.id;
          return (
            <div key={emp.id} style={{
              background: T.surface, border: `1px solid ${enEdit ? T.teal : T.border}`,
              borderRadius: 10, padding: '12px 16px',
              opacity: emp.activo ? 1 : 0.55,
              transition: 'border-color 0.15s',
            }}>
              {/* Cabecera */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, color: T.hi }}>
                    {emp.nombre} {emp.apellido}
                  </span>
                  <span style={{ color: T.lo, fontSize: 13 }}>
                    {' '}· {emp.sedes?.nombre || 'Sin sede'}
                  </span>
                  {!enEdit && (
                    <div style={{ color: T.mid, fontSize: 13, marginTop: 2 }}>
                      {emp.cargos?.nombre || <span style={{ color: T.lo, fontStyle: 'italic' }}>Sin cargo asignado</span>}
                      {emp.fecha_ingreso && (
                        <span style={{ color: T.lo }}> · Ingreso: {emp.fecha_ingreso}</span>
                      )}
                      {emp.profile_id ? (
                        <span style={{ color: T.tealDk, marginLeft: 8, fontSize: 12 }}>
                          ● {profiles.find(p => p.id === emp.profile_id)?.nombre || 'Usuario vinculado'}
                        </span>
                      ) : (
                        <span style={{ color: T.warn, marginLeft: 8, fontSize: 12 }}>⚠ Sin usuario vinculado</span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 12, padding: '2px 10px', borderRadius: 999,
                    color: emp.activo ? T.ok : T.lo,
                    background: emp.activo ? T.okBg : T.canvas,
                  }}>
                    {emp.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  {!enEdit && (
                    <IconBtn icon={<Ico.Edit s={14}/>} onClick={() => iniciarEdit(emp)} title="Editar" />
                  )}
                  <Btn variant={emp.activo ? 'danger' : 'secondary'} size="sm"
                    onClick={() => toggleActivo(emp)}>
                    {emp.activo ? 'Desactivar' : 'Activar'}
                  </Btn>
                </div>
              </div>

              {/* Panel de edición inline */}
              {enEdit && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
                  {/* Datos laborales */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <Field label="Cargo">
                      <TSelect
                        value={edits.cargo_id}
                        onChange={(e) => setEdits((d) => ({ ...d, cargo_id: e?.target ? e.target.value : e }))}
                        options={CARGO_OPC}
                      />
                    </Field>
                    <Field label="Fecha de ingreso">
                      <TInput
                        type="date"
                        value={edits.fecha_ingreso}
                        onChange={(e) => setEdits((d) => ({ ...d, fecha_ingreso: e?.target ? e.target.value : e }))}
                      />
                    </Field>
                    <Field label="Usuario vinculado" hint="Para activar marcaje de asistencia">
                      <TSelect
                        value={edits.profile_id}
                        onChange={(e) => setEdits((d) => ({ ...d, profile_id: e?.target ? e.target.value : e }))}
                        options={[
                          { value: '', label: '— Sin vincular —' },
                          ...profiles.map(p => ({
                            value: p.id,
                            label: `${p.nombre} (${p.codigo} · ${p.rol})`,
                          })),
                        ]}
                      />
                    </Field>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 1 }}>
                      <Btn onClick={() => guardar(emp)} disabled={guardando}>
                        {guardando ? 'Guardando…' : 'Guardar'}
                      </Btn>
                      <Btn variant="secondary" onClick={cancelar} disabled={guardando}>Cancelar</Btn>
                    </div>
                    {msg?.id === emp.id && (
                      <div style={{ color: T.crit, fontSize: 13, gridColumn: '1 / -1' }}>{msg.txt}</div>
                    )}
                  </div>

                  {/* Horario de trabajo */}
                  {horarioEd && (
                    <div style={{ marginTop: 18, borderTop: `1px dashed ${T.border}`, paddingTop: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.lo,
                        letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 12 }}>
                        Horario de trabajo
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                        <Field label="Hora entrada">
                          <TInput type="time" value={horarioEd.hora_entrada}
                            onChange={e => setHor('hora_entrada', e?.target ? e.target.value : e)} />
                        </Field>
                        <Field label="Hora salida">
                          <TInput type="time" value={horarioEd.hora_salida}
                            onChange={e => setHor('hora_salida', e?.target ? e.target.value : e)} />
                        </Field>
                        <Field label="Tolerancia tardanza (min)">
                          <TInput type="number" min="0" max="30" value={horarioEd.tolerancia_min}
                            onChange={e => setHor('tolerancia_min', Number(e?.target ? e.target.value : e))} />
                        </Field>
                        <Field label="Duración almuerzo (min)">
                          <TInput type="number" min="15" max="120" value={horarioEd.duracion_comida_min}
                            onChange={e => setHor('duracion_comida_min', Number(e?.target ? e.target.value : e))} />
                        </Field>
                      </div>
                      {/* Desayuno */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: T.mid }}>
                          <input type="checkbox" checked={!!horarioEd.tiene_desayuno}
                            onChange={e => setHor('tiene_desayuno', e.target.checked)}
                            style={{ width: 15, height: 15, accentColor: 'var(--teal)', cursor: 'pointer' }} />
                          Tiene desayuno
                        </label>
                        {horarioEd.tiene_desayuno && (
                          <div style={{ width: 180 }}>
                            <Field label="Duración desayuno (min)">
                              <TInput type="number" min="10" max="60" value={horarioEd.duracion_desayuno_min}
                                onChange={e => setHor('duracion_desayuno_min', Number(e?.target ? e.target.value : e))} />
                            </Field>
                          </div>
                        )}
                      </div>
                      {/* Días laborales */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, color: T.lo, marginBottom: 6 }}>Días laborales</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {DIAS_SEM.map(({ num, label }) => {
                            const activo = (horarioEd.dias_laborales || []).includes(num);
                            return (
                              <button key={num} onClick={() => toggleDia(num)} type="button"
                                style={{
                                  width: 34, height: 34, borderRadius: '50%', border: 'none',
                                  background: activo ? 'var(--teal)' : T.canvas,
                                  color: activo ? '#fff' : T.lo,
                                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                                  outline: activo ? `2px solid var(--teal-light)` : `1px solid ${T.border}`,
                                  transition: 'all 0.12s',
                                }}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Horarios especiales por día */}
                      {(horarioEd.dias_laborales || []).length > 0 && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 12, color: T.lo, marginBottom: 6 }}>
                            Horario especial por día <span style={{ fontWeight: 400 }}>(dejar vacío para usar el horario general)</span>
                          </div>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {(horarioEd.dias_laborales || []).map(diaNum => {
                              const ov  = (horarioEd.horarios_especiales || {})[String(diaNum)];
                              const tienOv = !!(ov?.hora_entrada || ov?.hora_salida);
                              return (
                                <div key={diaNum} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: tienOv ? 'var(--teal-dark)' : T.mid, width: 82, flexShrink: 0 }}>
                                    {DIAS_NOMBRE[diaNum]}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <TInput type="time" value={ov?.hora_entrada ?? ''}
                                      placeholder={horarioEd.hora_entrada}
                                      onChange={e => setEspecial(diaNum, 'hora_entrada', e?.target ? e.target.value : e)} />
                                    <span style={{ fontSize: 12, color: T.lo }}>–</span>
                                    <TInput type="time" value={ov?.hora_salida ?? ''}
                                      placeholder={horarioEd.hora_salida}
                                      onChange={e => setEspecial(diaNum, 'hora_salida', e?.target ? e.target.value : e)} />
                                    {tienOv && (
                                      <button onClick={() => clearEspecial(diaNum)} type="button"
                                        title="Quitar horario especial"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.lo, fontSize: 16, lineHeight: 1, padding: '0 2px' }}>
                                        ×
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reconocimientos del mes */}
                  <div style={{ marginTop: 18, borderTop: `1px dashed ${T.border}`, paddingTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.lo,
                      letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 12 }}>
                      Reconocimientos del mes — clic para asignar / quitar
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))', gap: 8 }}>
                      {RECONOCIMIENTOS.map(cat => {
                        const earned = empRecons.has(cat.title);
                        const toggling = togglingRecon === cat.id;
                        return (
                          <button key={cat.id} onClick={() => toggleRecon(cat)}
                            disabled={toggling}
                            title={cat.desc}
                            style={{
                              border: `1.5px solid ${earned ? T.teal : T.border}`,
                              background: earned ? T.tealXL : T.canvas,
                              borderRadius: 10, padding: '10px 6px 8px',
                              cursor: toggling ? 'wait' : 'pointer',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                              transition: 'all 0.13s',
                              opacity: toggling ? 0.55 : 1,
                              outline: 'none',
                            }}>
                            <Emblem
                              shape={cat.shape}
                              glyph={cat.glyph}
                              palette={earned ? cat.palette : 'lock'}
                              ribbon={cat.ribbon}
                              size={48}
                            />
                            <div style={{
                              fontSize: 10.5, fontWeight: 600, lineHeight: 1.3, textAlign: 'center',
                              color: earned ? T.tealDk : T.lo,
                            }}>
                              {cat.title}
                            </div>
                            {cat.id === 'antiguedad' && (
                              <div style={{ fontSize: 9, fontWeight: 700, color: T.teal,
                                letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                Permanente
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
