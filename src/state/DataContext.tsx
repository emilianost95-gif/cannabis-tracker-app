import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { defaultPreferences, type AppData, type UserPreferences } from '@/domain/model';
import { openRepository, type CollectionName, type CollectionTypes, type DataMode, type Repository } from '@/services/repository';
import { generateDemoData } from '@/demo/demoData';

const MODE_KEY = 'fumometro-mode';

/** Modo inicial: preferencia por pestaña/dispositivo. Nunca contiene datos del registro. */
function readMode(): DataMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'real';
  } catch {
    return 'real';
  }
}
function writeMode(m: DataMode) {
  try {
    if (m === 'demo') localStorage.setItem(MODE_KEY, 'demo');
    else localStorage.removeItem(MODE_KEY);
  } catch {
    // sin localStorage el modo dura lo que dure la pestaña
  }
}

type Status = 'loading' | 'ready' | 'error';

export interface DataContextValue {
  status: Status;
  data: AppData;
  /** 'demo' = datos de ejemplo en una base separada. */
  mode: DataMode;
  enterDemo(): Promise<void>;
  exitDemo(): Promise<void>;
  /** Vuelve a generar los datos de ejemplo (solo en modo demo). */
  resetDemo(): Promise<void>;
  storage: { kind: Repository['kind'] | null; error: string | null; skipped: number };
  save<K extends CollectionName>(collection: K, item: CollectionTypes[K]): Promise<void>;
  remove(collection: CollectionName, id: string): Promise<void>;
  savePreferences(p: UserPreferences): Promise<void>;
  replaceAll(data: AppData): Promise<void>;
  clearAll(): Promise<void>;
}

const emptyData = (): AppData => ({
  preferences: defaultPreferences(),
  consumption: [],
  checkins: [],
  expenses: [],
  goals: [],
});

const Ctx = createContext<DataContextValue | null>(null);

export function DataProvider({
  children,
  openRepo = openRepository,
}: {
  children: ReactNode;
  openRepo?: (mode: DataMode) => Promise<{ repo: Repository; error: string | null }>;
}) {
  const [mode, setMode] = useState<DataMode>(readMode);
  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<AppData>(emptyData);
  const [storage, setStorage] = useState<DataContextValue['storage']>({ kind: null, error: null, skipped: 0 });
  const repoRef = useRef<Repository | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      const { repo, error } = await openRepo(mode);
      try {
        let { data: loaded, skipped } = await repo.load();
        if (mode === 'demo' && loaded.consumption.length === 0 && loaded.checkins.length === 0) {
          loaded = generateDemoData();
          skipped = 0;
          await repo.replaceAll(loaded);
        }
        if (cancelled) return;
        repoRef.current = repo;
        setData(loaded);
        setStorage({ kind: repo.kind, error, skipped });
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        repoRef.current = repo;
        setStorage({
          kind: repo.kind,
          error: `No se pudieron leer los datos guardados (${err instanceof Error ? err.name : 'Error'}).`,
          skipped: 0,
        });
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openRepo, mode]);

  const repo = useCallback(() => {
    if (!repoRef.current) throw new Error('El almacenamiento todavía no está listo');
    return repoRef.current;
  }, []);

  const save = useCallback(
    async <K extends CollectionName>(collection: K, item: CollectionTypes[K]) => {
      await repo().put(collection, item);
      setData((d) => {
        const list = d[collection] as CollectionTypes[K][];
        const exists = list.some((x) => x.id === item.id);
        return { ...d, [collection]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] };
      });
    },
    [repo],
  );

  const remove = useCallback(
    async (collection: CollectionName, id: string) => {
      await repo().remove(collection, id);
      setData((d) => ({ ...d, [collection]: (d[collection] as { id: string }[]).filter((x) => x.id !== id) }));
    },
    [repo],
  );

  const savePreferences = useCallback(
    async (p: UserPreferences) => {
      await repo().savePreferences(p);
      setData((d) => ({ ...d, preferences: p }));
    },
    [repo],
  );

  const replaceAll = useCallback(
    async (next: AppData) => {
      await repo().replaceAll(next);
      setData(next);
    },
    [repo],
  );

  const clearAll = useCallback(async () => {
    await repo().clearAll();
    setData(emptyData());
  }, [repo]);

  const enterDemo = useCallback(async () => {
    writeMode('demo');
    setMode('demo');
  }, []);

  const exitDemo = useCallback(async () => {
    // Primero se registra la salida (sobrevive a una recarga inmediata) y
    // después se descartan los datos de ejemplo; los reales nunca se tocaron.
    writeMode('real');
    const demoRepo = mode === 'demo' ? repoRef.current : null;
    repoRef.current = null;
    setMode('real');
    if (demoRepo) await demoRepo.clearAll().catch(() => undefined);
  }, [mode]);

  const resetDemo = useCallback(async () => {
    if (mode !== 'demo') return;
    const fresh = generateDemoData();
    await repo().replaceAll(fresh);
    setData(fresh);
  }, [mode, repo]);

  const value = useMemo<DataContextValue>(
    () => ({ status, data, mode, enterDemo, exitDemo, resetDemo, storage, save, remove, savePreferences, replaceAll, clearAll }),
    [status, data, mode, enterDemo, exitDemo, resetDemo, storage, save, remove, savePreferences, replaceAll, clearAll],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData debe usarse dentro de DataProvider');
  return v;
}
