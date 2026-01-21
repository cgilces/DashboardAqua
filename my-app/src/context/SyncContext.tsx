import { createContext, useContext, useEffect, useState } from "react";

const SyncContext = createContext<any>(null);

export const SyncProvider = ({ children }: { children: React.ReactNode }) => {
  const [syncState, setSyncState] = useState({
    running: false,
    finishedAt: null,
    percent: 0,
  });

  const [syncVersion, setSyncVersion] = useState(0); //  CLAVE

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/sync/status`);
        const data = await res.json();

        setSyncState(data);

        // 👇 CUANDO TERMINA → disparar actualización global
        if (!data.running && data.finishedAt) {
          setSyncVersion(v => v + 1);
        }

      } catch (e) {
        console.error("Error sync status", e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <SyncContext.Provider value={{ syncState, syncVersion }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => useContext(SyncContext);
