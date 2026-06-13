import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { checkConnection, syncQueue, cajaQueue } from '../lib/cajaOffline';

const OnlineCtx = createContext({ isOnline: true, syncing: false, pendingOps: 0 });

export function OnlineProvider({ children }) {
  const [isOnline, setIsOnline]   = useState(navigator.onLine);
  const [syncing,  setSyncing]    = useState(false);
  const [pendingOps, setPending]  = useState(cajaQueue.count());
  const syncingRef = useRef(false);

  const refreshPending = () => setPending(cajaQueue.count());

  const doSync = useCallback(async () => {
    if (syncingRef.current) return;
    const count = cajaQueue.count();
    if (!count) return;
    syncingRef.current = true;
    setSyncing(true);
    await syncQueue();
    refreshPending();
    setSyncing(false);
    syncingRef.current = false;
  }, []);

  // Verificación real de conexión (ping) cuando el navegador dice "online"
  const handleOnline = useCallback(async () => {
    const real = await checkConnection();
    setIsOnline(real);
    if (real) doSync();
  }, [doSync]);

  const handleOffline = useCallback(() => setIsOnline(false), []);

  useEffect(() => {
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Ping cada 8 s cuando offline para detectar reconexión rápido;
  // cada 60 s cuando online para confirmar que sigue activo.
  useEffect(() => {
    const interval = isOnline ? 60_000 : 8_000;
    const t = setInterval(async () => {
      const real = await checkConnection();
      if (real !== isOnline) {
        setIsOnline(real);
        if (real) doSync();
      }
      refreshPending();
    }, interval);
    return () => clearInterval(t);
  }, [isOnline, doSync]);

  return (
    <OnlineCtx.Provider value={{ isOnline, syncing, pendingOps, doSync, refreshPending }}>
      {children}
    </OnlineCtx.Provider>
  );
}

export const useOnline = () => useContext(OnlineCtx);
