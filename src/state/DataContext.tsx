import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { defaultPreferences, type AppData, type UserPreferences } from '@/domain/model';
import { openRepository, type CollectionName, type CollectionTypes, type Repository } from '@/services/repository';

type Status = 'loading' | 'ready' | 'error';

export interface DataContextValue {
  status: Status;
  data: AppData;
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
  openRepo?: () => Promise<{ repo: Repository; error: string | null }>;
}) {
  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<AppData>(emptyData);
  const [storage, setStorage] = useState<DataContextValue['storage']>({ kind: null, error: null, skipped: 0 });
  const repoRef = useRef<Repository | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { repo, error } = await openRepo();
      try {
        const { data: loaded, skipped } = await repo.load();
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
  }, [openRepo]);

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

  const value = useMemo<DataContextValue>(
    () => ({ status, data, storage, save, remove, savePreferences, replaceAll, clearAll }),
    [status, data, storage, save, remove, savePreferences, replaceAll, clearAll],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData debe usarse dentro de DataProvider');
  return v;
}
