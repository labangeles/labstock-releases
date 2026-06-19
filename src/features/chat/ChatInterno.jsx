import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { urlFirmada } from '../rrhh/lib/storage';
import { T } from '../../shared/ui';

/* ── Helpers ─────────────────────────────────────────────────── */
function notify(titulo, cuerpo) {
  try { window.electronAPI?.showNotification(titulo, cuerpo); } catch { /* no-op */ }
}

const horaCorta = (iso) =>
  new Date(iso).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

const horaLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return horaCorta(iso);
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
};

const esHoy = (iso) => iso && new Date(iso).toDateString() === new Date().toDateString();

const AV_COLORS = ['#6C7CD8','#E0894D','#3FAE8C','#C56B8E','#5B8DB8','#D4567A','#7B6DD8','#4A8DA8'];
function avatarColor(str) {
  if (!str) return '#6C7CD8';
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}
function initials(nombre) {
  if (!nombre) return '?';
  const p = nombre.trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[1][0] : nombre.slice(0, 2)).toUpperCase();
}

/* ── Avatar ─────────────────────────────────────────────────── */
function Avatar({ nombre, fotoUrl, size = 40, online, panelBg = 'var(--bg-surface)' }) {
  const color = avatarColor(nombre);
  const dot   = size <= 28 ? 9 : 11;
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      {/* círculo con overflow:hidden para recortar imagen/iniciales */}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size <= 28 ? 11 : size <= 34 ? 12 : 14,
        fontWeight: 600, overflow: 'hidden',
      }}>
        {fotoUrl
          ? <img src={fotoUrl} alt="" loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <span>{initials(nombre)}</span>
        }
      </div>
      {/* punto de estado fuera del overflow */}
      {online !== undefined && (
        <span style={{
          position: 'absolute', right: -1, bottom: -1,
          width: dot, height: dot, borderRadius: '50%',
          background: online ? 'var(--ok)' : 'var(--text-lo)',
          border: `2px solid ${panelBg}`,
        }} />
      )}
    </div>
  );
}

/* ── SVG icons ─────────────────────────────────────────────── */
const IcoPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);
const IcoSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
  </svg>
);
const IcoClose = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18"/>
  </svg>
);
const IcoSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12h15M13 6l6 6-6 6"/>
  </svg>
);
const IcoDblCheck = () => (
  <svg width="15" height="11" viewBox="0 0 18 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 6.5 4.5 10 11 2.5"/><path d="M7 9.5 8 10.5 14.5 2.5"/>
  </svg>
);
const IcoChat = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/>
  </svg>
);

/* ── ChatInterno ─────────────────────────────────────────────── */
export default function ChatInterno({ profile }) {
  const [open,      setOpen]      = useState(false);
  const [myId,      setMyId]      = useState(null);
  const [myFotoUrl, setMyFotoUrl] = useState(null);
  const [people,    setPeople]    = useState({});
  const [convs,     setConvs]     = useState([]);
  const [active,    setActive]    = useState(null);
  const [msgs,      setMsgs]      = useState([]);
  const [text,      setText]      = useState('');
  const [picker,    setPicker]    = useState(false);
  const [online,    setOnline]    = useState(new Set());
  const [typing,    setTyping]    = useState(false);
  const [search,    setSearch]    = useState('');

  const myIdRef        = useRef(null);
  const activeRef      = useRef(null);
  const peopleRef      = useRef({});
  const endRef         = useRef(null);
  const typingChRef    = useRef(null);
  const typingTimerRef = useRef(null);
  const lastTypedRef   = useRef(0);

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { peopleRef.current = people; }, [people]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [msgs]);

  const loadConvs = useCallback(async (uid) => {
    const me = uid ?? myIdRef.current;
    if (!me) return;

    const { data: mems } = await supabase
      .from('conversacion_miembros')
      .select('conversacion_id, ultimo_leido_at')
      .eq('profile_id', me);

    const ids = (mems ?? []).map(m => m.conversacion_id);
    if (!ids.length) return setConvs([]);

    const leidoMap = Object.fromEntries((mems ?? []).map(m => [m.conversacion_id, m.ultimo_leido_at]));

    const [{ data: allMems }, { data: recientes }] = await Promise.all([
      supabase.from('conversacion_miembros').select('conversacion_id, profile_id').in('conversacion_id', ids),
      supabase.from('mensajes')
        .select('conversacion_id, contenido, created_at, autor_id')
        .in('conversacion_id', ids)
        .order('created_at', { ascending: false }).limit(300),
    ]);

    const lista = ids.map(cid => {
      const otro   = (allMems ?? []).find(m => m.conversacion_id === cid && m.profile_id !== me);
      const delConv = (recientes ?? []).filter(m => m.conversacion_id === cid);
      const last   = delConv[0];
      const leido  = leidoMap[cid];
      const unread = delConv.filter(m => m.autor_id !== me && m.created_at > leido).length;
      return {
        id:       cid,
        otroId:   otro?.profile_id,
        otroNombre: peopleRef.current[otro?.profile_id]?.nombre ?? '—',
        last:     last?.contenido ?? '',
        lastAt:   last?.created_at ?? null,
        unread,
      };
    }).sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));

    setConvs(lista);
  }, []);

  useEffect(() => {
    let canal, presencia;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);
      myIdRef.current = user.id;

      const { data: profs } = await supabase
        .from('profiles')
        .select('id, nombre, rol')
        .eq('activo', true)
        .eq('organizacion_id', profile.organizacion_id);

      // Fotos de todos los compañeros vía RPC SECURITY DEFINER
      const { data: fotosData } = await supabase.rpc('chat_fotos_perfil');
      const fotoUrlMap = {};
      await Promise.all(
        (fotosData ?? []).map(async ({ profile_id: pid, foto_path: path }) => {
          const url = await urlFirmada('rrhh-fotos', path);
          if (url) fotoUrlMap[pid] = url;
        }),
      );

      // Foto propia para los mensajes enviados (persiste aunque no esté en empleados)
      if (fotoUrlMap[user.id]) setMyFotoUrl(fotoUrlMap[user.id]);

      const map = Object.fromEntries(
        (profs ?? []).map(p => [p.id, { nombre: p.nombre, rol: p.rol, foto_url: fotoUrlMap[p.id] ?? null }]),
      );
      setPeople(map);
      peopleRef.current = map;

      await loadConvs(user.id);

      canal = supabase.channel('chat-global')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, p => {
          const m = p.new;
          if (m.autor_id === myIdRef.current) return;
          if (activeRef.current === m.conversacion_id) {
            setMsgs(prev => [...prev, m]);
            setTyping(false);
            marcarLeido(m.conversacion_id);
          } else {
            notify(peopleRef.current[m.autor_id]?.nombre ?? 'Mensaje nuevo', m.contenido);
          }
          loadConvs();
        })
        .subscribe();

      presencia = supabase.channel(`presencia-${profile.organizacion_id}`, { config: { presence: { key: user.id } } });
      presencia
        .on('presence', { event: 'sync' }, () => {
          setOnline(new Set(Object.keys(presencia.presenceState())));
        })
        .subscribe(async status => {
          if (status === 'SUBSCRIBED') await presencia.track({ en_linea_desde: new Date().toISOString() });
        });
    })();
    return () => {
      if (canal)    supabase.removeChannel(canal);
      if (presencia) supabase.removeChannel(presencia);
      if (typingChRef.current) supabase.removeChannel(typingChRef.current);
      clearTimeout(typingTimerRef.current);
    };
  }, [loadConvs]);

  async function marcarLeido(cid) {
    await supabase.from('conversacion_miembros')
      .update({ ultimo_leido_at: new Date().toISOString() })
      .eq('conversacion_id', cid).eq('profile_id', myIdRef.current);
    setConvs(cs => cs.map(c => c.id === cid ? { ...c, unread: 0 } : c));
  }

  async function abrir(cid) {
    setActive(cid); setPicker(false); setTyping(false); setSearch('');
    const { data } = await supabase.from('mensajes')
      .select('id, autor_id, contenido, created_at')
      .eq('conversacion_id', cid)
      .order('created_at', { ascending: true }).limit(200);
    setMsgs(data ?? []);
    marcarLeido(cid);

    if (typingChRef.current) supabase.removeChannel(typingChRef.current);
    const ch = supabase.channel(`escribiendo:${cid}`);
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload?.from === myIdRef.current) return;
      setTyping(true);
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setTyping(false), 2500);
    }).subscribe();
    typingChRef.current = ch;
  }

  function notificarEscribiendo() {
    const ahora = Date.now();
    if (!typingChRef.current || ahora - lastTypedRef.current < 1500) return;
    lastTypedRef.current = ahora;
    typingChRef.current.send({ type: 'broadcast', event: 'typing', payload: { from: myIdRef.current } });
  }

  async function iniciarCon(otroId) {
    const { data, error } = await supabase.rpc('iniciar_conversacion_directa', { otro: otroId });
    if (error) return;
    await loadConvs();
    abrir(data);
  }

  async function enviar() {
    const t = text.trim();
    if (!t || !active) return;
    setText('');
    const opt = { id: 'tmp' + Date.now(), conversacion_id: active, autor_id: myId, contenido: t, created_at: new Date().toISOString() };
    setMsgs(p => [...p, opt]);
    await supabase.from('mensajes').insert({ conversacion_id: active, autor_id: myId, contenido: t });
    loadConvs();
  }

  const totalUnread = convs.reduce((s, c) => s + c.unread, 0);
  const activo      = convs.find(c => c.id === active);
  const listaGente  = Object.entries(people).filter(([id]) => id !== myId);
  const q = search.toLowerCase();
  const convsVis = convs.filter(c => !q || c.otroNombre.toLowerCase().includes(q));
  const genteVis = picker
    ? listaGente.filter(([, p]) => !q || p.nombre.toLowerCase().includes(q))
    : [];

  /* ── FAB cerrado ── */
  if (!open) return (
    <button onClick={() => setOpen(true)} title="Chat interno"
      style={{
        position: 'fixed', right: 22, bottom: 22, zIndex: 999,
        width: 56, height: 56, borderRadius: '50%',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        color: 'var(--teal-dark)', cursor: 'pointer',
        boxShadow: '0 6px 18px rgba(20,32,40,.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform .12s, background .12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--teal-xlight)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.transform = ''; }}
    >
      <IcoChat />
      {totalUnread > 0 && (
        <span style={{
          position: 'absolute', top: -2, right: -2,
          background: 'var(--crit)', color: '#fff', borderRadius: 10,
          fontSize: 11, fontWeight: 700, minWidth: 20, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
          border: '2px solid var(--bg-canvas)',
        }}>
          {totalUnread > 99 ? '99+' : totalUnread}
        </span>
      )}
    </button>
  );

  /* ── Ventana de chat ── */
  return (
    <div style={{
      position: 'fixed', right: 22, bottom: 22, zIndex: 999,
      width: 760, maxWidth: 'calc(100vw - 32px)',
      height: 560, maxHeight: 'calc(100vh - 44px)',
      display: 'grid', gridTemplateColumns: '248px 1fr',
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 16, boxShadow: '0 24px 70px rgba(20,32,40,.20)',
      overflow: 'hidden',
    }}>

      {/* ── Panel izquierdo ── */}
      <aside style={{
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-surface)', minHeight: 0,
      }}>
        {/* Header panel */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 14px 13px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '-.01em' }}>Chats</span>
          <button onClick={() => { setPicker(v => !v); setSearch(''); }}
            style={{
              width: 30, height: 30, border: 'none', borderRadius: 8,
              background: 'var(--teal)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'background .12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-dark)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--teal)'}
            title="Nuevo chat">
            <IcoPlus />
          </button>
        </div>

        {/* Búsqueda */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', position: 'relative', flexShrink: 0 }}>
          <span style={{ position: 'absolute', left: 23, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-lo)', pointerEvents: 'none' }}>
            <IcoSearch />
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={picker ? 'Buscar persona…' : 'Buscar…'}
            style={{
              width: '100%', padding: '7px 11px 7px 30px',
              fontFamily: 'inherit', fontSize: 12.5, color: 'var(--text-hi)',
              background: 'var(--bg-canvas)', border: '1px solid transparent', borderRadius: 8,
              outline: 'none', transition: 'border-color .12s, background .12s',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--teal)'; e.target.style.background = 'var(--bg-surface)'; }}
            onBlur={e =>  { e.target.style.borderColor = 'transparent'; e.target.style.background = 'var(--bg-canvas)'; }}
          />
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 6, minHeight: 0 }}>
          {picker && (
            <>
              <div style={{ padding: '8px 10px 4px', fontSize: 11, color: 'var(--text-lo)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Iniciar chat con…
              </div>
              {genteVis.map(([id, p]) => (
                <button key={id} onClick={() => iniciarCon(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, width: '100%',
                    padding: '9px 10px', border: 'none', borderRadius: 10,
                    background: 'transparent', cursor: 'pointer', transition: 'background .1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-canvas)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Avatar nombre={p.nombre} fotoUrl={p.foto_url} size={34} online={online.has(id)} panelBg="var(--bg-surface)" />
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-hi)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-lo)' }}>{p.rol}</div>
                  </div>
                </button>
              ))}
              {!genteVis.length && (
                <div style={{ padding: '12px 10px', color: 'var(--text-lo)', fontSize: 12 }}>Sin resultados</div>
              )}
            </>
          )}

          {!picker && convsVis.map(c => {
            const isActive = active === c.id;
            const persona  = people[c.otroId] ?? {};
            return (
              <button key={c.id} onClick={() => abrir(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, width: '100%',
                  padding: 10, border: 'none', borderRadius: 10, cursor: 'pointer',
                  position: 'relative',
                  background: isActive ? 'var(--teal-xlight)' : 'transparent',
                  transition: 'background .1s', marginBottom: 1,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-canvas)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {isActive && (
                  <span style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 3, height: 26, borderRadius: '0 2px 2px 0', background: 'var(--teal)',
                  }} />
                )}
                <Avatar nombre={c.otroNombre} fotoUrl={persona.foto_url} size={40} online={online.has(c.otroId)} panelBg="var(--bg-surface)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: c.unread ? 700 : 600, color: 'var(--text-hi)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.otroNombre}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-lo)', flexShrink: 0 }}>{horaLabel(c.lastAt)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
                    <span style={{
                      fontSize: 12, color: c.unread ? 'var(--text-hi)' : 'var(--text-mid)',
                      fontWeight: c.unread ? 600 : 400,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {c.last || 'Sin mensajes'}
                    </span>
                    {c.unread > 0 && (
                      <span style={{
                        minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
                        background: 'var(--teal)', color: '#fff',
                        fontSize: 10.5, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {!picker && !convsVis.length && (
            <div style={{ padding: 16, color: 'var(--text-lo)', fontSize: 12.5, textAlign: 'center', marginTop: 12 }}>
              {search ? 'Sin resultados.' : 'Aún no hay chats. Toca "+" para empezar.'}
            </div>
          )}
        </div>
      </aside>

      {/* ── Hilo de conversación ── */}
      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: 'var(--bg-canvas)' }}>
        {/* Header hilo */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px',
          background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          {activo ? (
            <>
              <Avatar
                nombre={activo.otroNombre}
                fotoUrl={people[activo.otroId]?.foto_url}
                size={34}
                online={online.has(activo.otroId)}
                panelBg="var(--bg-surface)"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-hi)' }}>{activo.otroNombre}</div>
                {online.has(activo.otroId) ? (
                  <div style={{ fontSize: 11.5, color: 'var(--ok)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
                    En línea
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: 'var(--text-lo)' }}>Desconectado</div>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text-hi)' }}>Chat interno</div>
          )}
          <button onClick={() => setOpen(false)}
            style={{
              width: 30, height: 30, border: 'none', borderRadius: 8,
              background: 'transparent', color: 'var(--text-lo)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'background .12s, color .12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-canvas)'; e.currentTarget.style.color = 'var(--text-mid)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-lo)'; }}
          >
            <IcoClose />
          </button>
        </header>

        {/* Mensajes */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '18px 18px 8px',
          display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0,
        }}>
          {!active && (
            <div style={{ margin: 'auto', color: 'var(--text-lo)', fontSize: 13, textAlign: 'center' }}>
              Selecciona o inicia una conversación
            </div>
          )}

          {/* Separador de día */}
          {msgs.length > 0 && esHoy(msgs[msgs.length - 1]?.created_at) && (
            <div style={{ alignSelf: 'center', margin: '6px 0 12px' }}>
              <span style={{
                padding: '3px 12px', borderRadius: 20, background: 'var(--border)',
                color: 'var(--text-mid)', fontSize: 10.5, fontWeight: 600,
              }}>Hoy</span>
            </div>
          )}

          {msgs.map((m, i) => {
            const mio   = m.autor_id === myId;
            const prev  = msgs[i - 1];
            const tight = prev && prev.autor_id === m.autor_id;
            const persona = mio
              ? { nombre: profile?.nombre, foto_url: myFotoUrl }
              : (people[m.autor_id] ?? {});

            return (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'flex-end', gap: 8,
                maxWidth: '78%',
                alignSelf:     mio ? 'flex-end' : 'flex-start',
                flexDirection: mio ? 'row-reverse' : 'row',
                marginTop:     tight ? 2 : 9,
              }}>
                <div style={{ visibility: tight ? 'hidden' : 'visible', flexShrink: 0 }}>
                  <Avatar
                    nombre={persona.nombre}
                    fotoUrl={persona.foto_url}
                    size={28}
                    panelBg="var(--bg-canvas)"
                  />
                </div>
                <div>
                  <div style={{
                    padding: '8px 12px', borderRadius: 14, fontSize: 13, lineHeight: 1.4,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: mio ? 'var(--teal)'    : 'var(--bg-surface)',
                    color:      mio ? '#fff'            : 'var(--text-hi)',
                    border:     mio ? 'none'            : '1px solid var(--border)',
                    borderBottomRightRadius: mio ? 5 : 14,
                    borderBottomLeftRadius:  mio ? 14 : 5,
                  }}>
                    {m.contenido}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 10,
                    color: mio ? 'var(--text-lo)' : 'var(--text-lo)',
                    justifyContent: mio ? 'flex-end' : 'flex-start',
                  }}>
                    {horaCorta(m.created_at)}
                    {mio && (
                      <span style={{ color: 'var(--text-lo)', display: 'inline-flex' }}>
                        <IcoDblCheck />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {typing && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, alignSelf: 'flex-start', marginTop: 9 }}>
              <div style={{ width: 28, height: 28, flexShrink: 0, visibility: 'visible' }}>
                <Avatar nombre={activo?.otroNombre} fotoUrl={people[activo?.otroId]?.foto_url} size={28} panelBg="var(--bg-canvas)" />
              </div>
              <div style={{
                padding: '10px 13px',
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 14, borderBottomLeftRadius: 5,
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

        {/* Composer */}
        {active && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '12px 14px', background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border)', flexShrink: 0,
          }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', background: 'var(--bg-canvas)',
              border: '1px solid var(--border)', borderRadius: 22,
              transition: 'border-color .12s, background .12s',
            }}
              onFocusCapture={e => { const p = e.currentTarget; p.style.borderColor = 'var(--teal)'; p.style.background = 'var(--bg-surface)'; }}
              onBlurCapture={e =>  { const p = e.currentTarget; p.style.borderColor = 'var(--border)'; p.style.background = 'var(--bg-canvas)'; }}
            >
              <input
                value={text}
                onChange={e => { setText(e.target.value); notificarEscribiendo(); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder="Escribe un mensaje…"
                style={{
                  flex: 1, border: 'none', background: 'transparent', outline: 'none',
                  fontFamily: 'inherit', fontSize: 13, color: 'var(--text-hi)',
                }}
              />
            </div>
            <button onClick={enviar} disabled={!text.trim()}
              style={{
                width: 40, height: 40, flexShrink: 0, border: 'none', borderRadius: '50%',
                background: text.trim() ? 'var(--teal)' : 'var(--border)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: text.trim() ? 'pointer' : 'default',
                boxShadow: text.trim() ? '0 2px 8px rgba(43,191,190,.30)' : 'none',
                transition: 'background .12s, transform .1s',
              }}
              onMouseEnter={e => { if (text.trim()) { e.currentTarget.style.background = 'var(--teal-dark)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = text.trim() ? 'var(--teal)' : 'var(--border)'; e.currentTarget.style.transform = ''; }}
            >
              <IcoSend />
            </button>
          </div>
        )}
      </section>

      <style>{`
        @keyframes botBob {
          0%,60%,100% { transform: translateY(0); opacity: .5; }
          30%          { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
