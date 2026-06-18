import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { T } from '../../shared/ui';

const MAX_LOOPS = 4;

/* ── SVG icons ─────────────────────────────────────────────── */
const IcoBot = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="8" width="16" height="11" rx="3"/>
    <path d="M12 8V4"/>
    <circle cx="12" cy="3" r="1.4" fill={color} stroke="none"/>
    <circle cx="9" cy="13" r="1.1" fill={color} stroke="none"/>
    <circle cx="15" cy="13" r="1.1" fill={color} stroke="none"/>
  </svg>
);

const IcoSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12h15M13 6l6 6-6 6"/>
  </svg>
);

const IcoClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18"/>
  </svg>
);

/* ── Markdown inline renderer ───────────────────────────────── */
function parseInline(text) {
  const result = [];
  const re = /\*\*(.*?)\*\*|`([^`]+)`/g;
  let last = 0, key = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) result.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    if (m[1] !== undefined)
      result.push(<strong key={key++} style={{ fontWeight: 700 }}>{m[1]}</strong>);
    else
      result.push(
        <code key={key++} style={{
          background: 'var(--teal-xlight)', color: 'var(--teal-dark)',
          fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12,
          padding: '1px 5px', borderRadius: 5,
        }}>{m[2]}</code>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) result.push(<span key={key}>{text.slice(last)}</span>);
  return result.length ? result : [text];
}

function RenderMd({ text }) {
  if (!text) return null;
  return (
    <>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        const bullet = /^[\-•*]\s+/.test(line.trimStart());
        const content = bullet ? line.replace(/^[\s\-•*]+/, '') : line;
        return (
          <div key={i} style={{ display: 'flex', gap: bullet ? 6 : 0, marginBottom: bullet ? 2 : 0 }}>
            {bullet && <span style={{ flexShrink: 0 }}>•</span>}
            <span>{parseInline(content)}</span>
          </div>
        );
      })}
    </>
  );
}

/* ── Tools (run con RLS del empleado) ───────────────────────── */
async function resolveSedeId(nombre) {
  if (!nombre) return null;
  const { data } = await supabase.from('sedes').select('id').ilike('nombre', `%${nombre}%`).limit(1);
  return data?.[0]?.id ?? null;
}

function calcEstado(cantidad_actual, cantidad_minima) {
  if (!cantidad_actual || cantidad_actual === 0) return 'agotado';
  const r = cantidad_actual / (cantidad_minima || 1);
  if (r <= 1.0) return 'critico';
  if (r <= 1.5) return 'precaucion';
  return 'ok';
}

const TOOLS = {
  async inventario_estado({ estado, sede }) {
    let q = supabase.from('items')
      .select('codigo, nombre, categoria, cantidad_actual, cantidad_minima, unidad, sede_id')
      .eq('activo', true).limit(60);
    const sedeId = await resolveSedeId(sede);
    if (sedeId) q = q.eq('sede_id', sedeId);
    const { data, error } = await q;
    if (error) return { error: error.message };
    const items = (data || []).map(i => ({ ...i, estado: calcEstado(i.cantidad_actual, i.cantidad_minima) }));
    const filtrados = (estado && estado !== 'todos') ? items.filter(i => i.estado === estado) : items;
    return { total: filtrados.length, items: filtrados.slice(0, 40) };
  },

  async ventas_resumen_mes({ mes, anio }, rol) {
    if (rol !== 'admin' && rol !== 'auditor')
      return { error: 'Sin permiso para ver datos de ventas.' };
    const hoy = new Date();
    const m = mes ?? hoy.getMonth() + 1;
    const a = anio ?? hoy.getFullYear();
    const ini = `${a}-${String(m).padStart(2, '0')}-01`;
    const fin = new Date(a, m, 0).toISOString().slice(0, 10);
    const sumar = async tabla => {
      const { data, error } = await supabase.from(tabla).select('monto').gte('fecha', ini).lte('fecha', fin);
      if (error) return 0;
      return data.reduce((s, r) => s + Number(r.monto || 0), 0);
    };
    const igss = await sumar('ventas_igss');
    const empresas = rol === 'admin' ? await sumar('ventas_empresas') : 0;
    return { mes: m, anio: a, igss, empresas, total: igss + empresas };
  },

  async gastos_fijos_pendientes({ mes, anio }, rol) {
    if (rol !== 'admin' && rol !== 'auditor')
      return { error: 'Sin permiso para ver gastos fijos.' };
    const hoy = new Date();
    const m = mes ?? hoy.getMonth() + 1;
    const a = anio ?? hoy.getFullYear();
    const [{ data: plantillas, error }, { data: pagos }] = await Promise.all([
      supabase.from('gastos_fijos').select('id, nombre, monto, dia_vencimiento'),
      supabase.from('gastos_fijos_pagos').select('gasto_fijo_id').eq('mes', m).eq('anio', a),
    ]);
    if (error) return { error: error.message };
    const pagados = new Set((pagos ?? []).map(p => p.gasto_fijo_id));
    return { mes: m, anio: a, pendientes: (plantillas ?? []).filter(g => !pagados.has(g.id)) };
  },

  async cuadres_sin_cerrar({ dias = 7 }, rol) {
    if (rol !== 'admin' && rol !== 'auditor')
      return { error: 'Sin permiso para ver cuadres de caja.' };
    const desde = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
    const { data, error } = await supabase.from('cuadres_caja')
      .select('fecha, sede_id, estado, ingreso_dia')
      .neq('estado', 'cerrado').gte('fecha', desde)
      .order('fecha', { ascending: false }).limit(40);
    if (error) return { error: error.message };
    return { total: data.length, cuadres: data };
  },

  async pedidos_activos() {
    const { data, error } = await supabase.from('pedidos')
      .select('referencia, estado, created_at')
      .not('estado', 'in', '(entregado,cancelado)')
      .order('created_at', { ascending: false }).limit(40);
    if (error) return { error: error.message };
    return { total: data.length, pedidos: data };
  },
};

async function callGemini(contents, rol) {
  const { data, error } = await supabase.functions.invoke('agente-ia', { body: { contents, rol } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.parts;
}

async function runAgent(contents, rol) {
  for (let i = 0; i < MAX_LOOPS; i++) {
    const parts = await callGemini(contents, rol);
    const call  = parts.find(p => p.functionCall);
    if (!call) {
      return parts.filter(p => p.text).map(p => p.text).join('\n').trim()
        || 'No pude generar una respuesta.';
    }
    const { name, args } = call.functionCall;
    const fn     = TOOLS[name];
    const result = fn ? await fn(args || {}, rol) : { error: `Herramienta '${name}' no existe.` };
    contents.push({ role: 'model', parts: [{ functionCall: call.functionCall }] });
    contents.push({ role: 'user',  parts: [{ functionResponse: { name, response: result } }] });
  }
  return 'La consulta tomó demasiados pasos. Reformula la pregunta, por favor.';
}

const SUGERENCIAS_POR_ROL = {
  admin:      ['¿Qué reactivos están críticos?', '¿Cuánto facturamos este mes?', '¿Qué cuadres no se han cerrado?', 'Pedidos activos entre sedes'],
  auditor:    ['¿Qué reactivos están críticos?', '¿Cuánto facturamos este mes?', '¿Qué cuadres no se han cerrado?', 'Gastos fijos pendientes'],
  tecnico:    ['¿Qué reactivos están críticos?', 'Pedidos activos de mi sede', '¿Cómo registro un pedido?', '¿Cómo marco mi asistencia?'],
  secretaria: ['¿Qué reactivos están críticos?', 'Pedidos activos', '¿Cómo registro una compra?', '¿Cómo marco mi asistencia?'],
};

const hora = (d) =>
  new Date(d).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

/* ── Componente ─────────────────────────────────────────────── */
export default function AgenteIA({ profile }) {
  const [open,  setOpen]  = useState(false);
  const [msgs,  setMsgs]  = useState([{
    role: 'assistant', text: '¡Hola! Soy **Angelito** 🤖 Puedo ayudarte con inventario, caja y asistencia. ¿Qué necesitas?',
    at: new Date().toISOString(),
  }]);
  const [input, setInput] = useState('');
  const [busy,  setBusy]  = useState(false);
  const [hoverX, setHoverX] = useState(false);
  const [hoverSend, setHoverSend] = useState(false);
  const contentsRef = useRef([]);
  const endRef      = useRef(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, busy]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setMsgs(m => [...m, { role: 'user', text: q, at: new Date().toISOString() }]);
    setBusy(true);
    contentsRef.current.push({ role: 'user', parts: [{ text: q }] });
    try {
      const answer = await runAgent(contentsRef.current, profile?.rol);
      contentsRef.current.push({ role: 'model', parts: [{ text: answer }] });
      setMsgs(m => [...m, { role: 'assistant', text: answer, at: new Date().toISOString() }]);
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', text: `⚠️ ${e.message}`, at: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  }

  const rol = profile?.rol ?? 'tecnico';
  const sugerencias = SUGERENCIAS_POR_ROL[rol] ?? SUGERENCIAS_POR_ROL['tecnico'];
  const hasUserMsg = msgs.some(m => m.role === 'user');

  /* ── FAB cerrado ── */
  if (!open) return (
    <button onClick={() => setOpen(true)} title="Angelito — Asistente IA"
      style={{
        position: 'fixed', right: 22, bottom: 86, zIndex: 1000,
        width: 56, height: 56, borderRadius: '50%', border: 'none',
        background: 'linear-gradient(135deg, var(--teal), var(--teal-dark))',
        color: '#fff', cursor: 'pointer',
        boxShadow: '0 8px 22px rgba(43,191,190,.40)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform .12s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
    >
      <IcoBot size={26} color="#fff" />
    </button>
  );

  /* ── Ventana ── */
  return (
    <div style={{
      position: 'fixed', right: 22, bottom: 22, zIndex: 1001,
      width: 392, maxWidth: 'calc(100vw - 32px)',
      height: 580, maxHeight: 'calc(100vh - 44px)',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 18,
      boxShadow: '0 24px 70px rgba(20,32,40,.22)',
      overflow: 'hidden',
    }}>

      {/* Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: '15px 16px',
        background: 'linear-gradient(120deg, var(--teal), var(--teal-dark))',
        color: '#fff', flexShrink: 0,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(255,255,255,.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <IcoBot size={22} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 7 }}>
            Angelito
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#7CF0C0',
              boxShadow: '0 0 0 0 rgba(124,240,192,.7)',
              animation: 'livePulse 2s infinite',
              flexShrink: 0,
            }} />
          </div>
          <div style={{ fontSize: 11.5, opacity: .85, marginTop: 1 }}>Asistente LabStock</div>
        </div>
        <button onClick={() => setOpen(false)}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.28)'; setHoverX(true); }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.14)'; setHoverX(false); }}
          style={{
            width: 30, height: 30, borderRadius: 8,
            border: 'none', background: 'rgba(255,255,255,.14)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'background .12s', flexShrink: 0,
          }}>
          <IcoClose />
        </button>
      </div>

      {/* Feed ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '18px 16px 8px',
        background: 'var(--bg-canvas)',
        display: 'flex', flexDirection: 'column', gap: 11, minHeight: 0,
      }}>
        {msgs.map((m, i) => {
          const isBot = m.role === 'assistant';
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-end', gap: 8,
              maxWidth: '86%',
              alignSelf: isBot ? 'flex-start' : 'flex-end',
              flexDirection: isBot ? 'row' : 'row-reverse',
            }}>
              {isBot && (
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: 'var(--teal-xlight)', color: 'var(--teal-dark)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IcoBot size={14} color="var(--teal-dark)" />
                </div>
              )}
              <div>
                <div style={{
                  padding: '10px 13px', borderRadius: 15, fontSize: 13.5, lineHeight: 1.5,
                  wordBreak: 'break-word',
                  background: isBot ? 'var(--bg-surface)' : 'var(--teal)',
                  color:      isBot ? 'var(--text-hi)'    : '#fff',
                  border:     isBot ? '1px solid var(--border)' : 'none',
                  borderBottomLeftRadius:  isBot ? 5 : 15,
                  borderBottomRightRadius: isBot ? 15 : 5,
                }}>
                  {isBot ? <RenderMd text={m.text} /> : m.text}
                </div>
                <div style={{
                  fontSize: 10, marginTop: 4,
                  color: isBot ? 'var(--text-lo)' : 'rgba(255,255,255,.7)',
                  textAlign: isBot ? 'left' : 'right',
                }}>
                  {hora(m.at)}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator ── */}
        {busy && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, alignSelf: 'flex-start', maxWidth: '86%' }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
              background: 'var(--teal-xlight)', color: 'var(--teal-dark)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IcoBot size={14} color="var(--teal-dark)" />
            </div>
            <div style={{
              padding: '13px 14px',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 15, borderBottomLeftRadius: 5,
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(n => (
                  <span key={n} style={{
                    display: 'block', width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--teal-light)',
                    animation: `botBob 1.3s ${n * 0.18}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Chips ── */}
      {!hasUserMsg && !busy && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 7,
          padding: '0 16px 12px', background: 'var(--bg-canvas)', flexShrink: 0,
        }}>
          {sugerencias.map(s => (
            <button key={s} onClick={() => send(s)}
              style={{
                padding: '7px 13px',
                border: '1px solid var(--teal-light)',
                borderRadius: 20, background: 'var(--bg-surface)',
                color: 'var(--teal-dark)', fontFamily: 'inherit',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--teal-xlight)'; e.currentTarget.style.borderColor = 'var(--teal)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--teal-light)'; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '12px 14px',
        background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Pregúntale a Angelito…"
          disabled={busy}
          style={{
            flex: 1, padding: '11px 15px', borderRadius: 24,
            border: '1px solid var(--border)', background: 'var(--bg-canvas)',
            color: 'var(--text-hi)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
            transition: 'border-color .12s, background .12s',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--teal)'; e.target.style.background = 'var(--bg-surface)'; }}
          onBlur={e =>  { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--bg-canvas)'; }}
        />
        <button
          onClick={() => send()}
          disabled={busy || !input.trim()}
          onMouseEnter={() => setHoverSend(true)}
          onMouseLeave={() => setHoverSend(false)}
          style={{
            width: 42, height: 42, flexShrink: 0,
            border: 'none', borderRadius: '50%',
            background: input.trim() && !busy
              ? (hoverSend ? 'var(--teal-dark)' : 'var(--teal)')
              : 'var(--border)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() && !busy ? 'pointer' : 'default',
            boxShadow: input.trim() && !busy ? '0 2px 8px rgba(43,191,190,.30)' : 'none',
            transform: hoverSend && input.trim() && !busy ? 'translateY(-1px)' : '',
            transition: 'background .12s, transform .1s, box-shadow .12s',
          }}>
          <IcoSend />
        </button>
      </div>

      <style>{`
        @keyframes livePulse {
          0%   { box-shadow: 0 0 0 0 rgba(124,240,192,.6); }
          70%  { box-shadow: 0 0 0 6px rgba(124,240,192,0); }
          100% { box-shadow: 0 0 0 0 rgba(124,240,192,0); }
        }
        @keyframes botBob {
          0%,60%,100% { transform: translateY(0); opacity: .5; }
          30%          { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
