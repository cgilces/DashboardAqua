import { createContext, useEffect, useState } from "react";

export interface SyncState {
  running: boolean;
  finishedAt: string | null;
  percent: number;
}

export interface SyncContextType {
  syncState: SyncState;
  syncVersion: number;
}

export const SyncContext = createContext<SyncContextType | null>(null);

export const SyncProvider = ({ children }: { children: React.ReactNode }) => {
  const [syncState, setSyncState] = useState<SyncState>({
    running: false,
    finishedAt: null,
    percent: 0,
  });

  const [syncVersion, setSyncVersion] = useState(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/api/sync/status`,
          { credentials: "include" }
        );

        if (!res.ok) return;

        const contentType = res.headers.get("content-type");
        if (!contentType?.includes("application/json")) return;

        const data = await res.json();
        setSyncState(data);

        if (!data.running && data.finishedAt) {
          setSyncVersion(v => v + 1);
        }
      } catch (err) {
        console.error("Error sync status", err);
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
