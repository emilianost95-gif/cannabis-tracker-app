/**
 * Capa de persistencia aislada. La interfaz no sabe nada de IndexedDB, de modo
 * que en el futuro se puede añadir sincronización o cifrado detrás de ella.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ZodType, ZodTypeDef } from 'zod';
import {
  consumptionEntry,
  defaultPreferences,
  expenseEntry,
  moodCheckIn,
  personalGoal,
  userPreferences,
  type AppData,
  type ConsumptionEntry,
  type ExpenseEntry,
  type MoodCheckIn,
  type PersonalGoal,
  type UserPreferences,
} from '@/domain/model';

export type CollectionName = 'consumption' | 'checkins' | 'expenses' | 'goals';
export interface CollectionTypes {
  consumption: ConsumptionEntry;
  checkins: MoodCheckIn;
  expenses: ExpenseEntry;
  goals: PersonalGoal;
}

export interface LoadResult {
  data: AppData;
  /** Registros guardados que no pasaron la validación y se omitieron (no se borran). */
  skipped: number;
}

export interface Repository {
  readonly kind: 'indexeddb' | 'memory';
  load(): Promise<LoadResult>;
  put<K extends CollectionName>(collection: K, item: CollectionTypes[K]): Promise<void>;
  remove(collection: CollectionName, id: string): Promise<void>;
  savePreferences(p: UserPreferences): Promise<void>;
  /** Reemplaza todo en una única transacción: si falla, no cambia nada. */
  replaceAll(data: AppData): Promise<void>;
  clearAll(): Promise<void>;
}

export const DB_NAME = 'ritmo';
/** Versión de la base IndexedDB. Subirla al cambiar stores o índices. */
export const DB_VERSION = 1;

interface RitmoDB extends DBSchema {
  consumption: { key: string; value: ConsumptionEntry; indexes: { occurredAt: string } };
  checkins: { key: string; value: MoodCheckIn; indexes: { occurredAt: string } };
  expenses: { key: string; value: ExpenseEntry; indexes: { date: string } };
  goals: { key: string; value: PersonalGoal };
  meta: { key: string; value: UserPreferences };
}

const COLLECTIONS: CollectionName[] = ['consumption', 'checkins', 'expenses', 'goals'];
const SCHEMAS: { [K in CollectionName]: ZodType<CollectionTypes[K], ZodTypeDef, unknown> } = {
  consumption: consumptionEntry,
  checkins: moodCheckIn,
  expenses: expenseEntry,
  goals: personalGoal,
};

function validateList<K extends CollectionName>(k: K, raw: unknown[]): { items: CollectionTypes[K][]; skipped: number } {
  const items: CollectionTypes[K][] = [];
  let skipped = 0;
  for (const r of raw) {
    const res = SCHEMAS[k].safeParse(r);
    if (res.success) items.push(res.data);
    else skipped++;
  }
  return { items, skipped };
}

export class IndexedDbRepository implements Repository {
  readonly kind = 'indexeddb' as const;
  private constructor(private db: IDBPDatabase<RitmoDB>) {}

  static async open(): Promise<IndexedDbRepository> {
    const db = await openDB<RitmoDB>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        // Migraciones incrementales: cada bloque lleva la base de la versión N a N+1.
        if (oldVersion < 1) {
          database.createObjectStore('consumption', { keyPath: 'id' }).createIndex('occurredAt', 'occurredAt');
          database.createObjectStore('checkins', { keyPath: 'id' }).createIndex('occurredAt', 'occurredAt');
          database.createObjectStore('expenses', { keyPath: 'id' }).createIndex('date', 'date');
          database.createObjectStore('goals', { keyPath: 'id' });
          database.createObjectStore('meta');
        }
      },
      blocked() {
        // Otra pestaña con una versión anterior mantiene la base abierta.
      },
    });
    return new IndexedDbRepository(db);
  }

  async load(): Promise<LoadResult> {
    const tx = this.db.transaction([...COLLECTIONS, 'meta'], 'readonly');
    const [c, ch, ex, g, prefs] = await Promise.all([
      tx.objectStore('consumption').getAll(),
      tx.objectStore('checkins').getAll(),
      tx.objectStore('expenses').getAll(),
      tx.objectStore('goals').getAll(),
      tx.objectStore('meta').get('preferences'),
      tx.done,
    ]);
    const vc = validateList('consumption', c);
    const vch = validateList('checkins', ch);
    const vex = validateList('expenses', ex);
    const vg = validateList('goals', g);
    const p = userPreferences.safeParse(prefs);
    return {
      data: {
        preferences: p.success ? p.data : defaultPreferences(),
        consumption: vc.items,
        checkins: vch.items,
        expenses: vex.items,
        goals: vg.items,
      },
      skipped: vc.skipped + vch.skipped + vex.skipped + vg.skipped,
    };
  }

  async put<K extends CollectionName>(collection: K, item: CollectionTypes[K]): Promise<void> {
    // idb tipa cada store por separado; el esquema garantiza la correspondencia.
    await (this.db as unknown as IDBPDatabase).put(collection, item);
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    await this.db.delete(collection, id);
  }

  async savePreferences(p: UserPreferences): Promise<void> {
    await this.db.put('meta', p, 'preferences');
  }

  async replaceAll(data: AppData): Promise<void> {
    const tx = this.db.transaction([...COLLECTIONS, 'meta'], 'readwrite');
    // Todas las operaciones se encolan en la misma transacción: si una falla,
    // IndexedDB revierte el conjunto y los datos previos quedan intactos.
    const pending: Promise<unknown>[] = [tx.done];
    const silence = () => pending.forEach((p) => p.catch(() => undefined));
    try {
      for (const k of COLLECTIONS) pending.push(tx.objectStore(k).clear());
      for (const e of data.consumption) pending.push(tx.objectStore('consumption').put(e));
      for (const e of data.checkins) pending.push(tx.objectStore('checkins').put(e));
      for (const e of data.expenses) pending.push(tx.objectStore('expenses').put(e));
      for (const e of data.goals) pending.push(tx.objectStore('goals').put(e));
      pending.push(tx.objectStore('meta').put(data.preferences, 'preferences'));
      await Promise.all(pending);
    } catch (err) {
      silence();
      try {
        tx.abort();
      } catch {
        // la transacción ya terminó o se abortó
      }
      throw err;
    }
  }

  async clearAll(): Promise<void> {
    const tx = this.db.transaction([...COLLECTIONS, 'meta'], 'readwrite');
    await Promise.all([...COLLECTIONS.map((k) => tx.objectStore(k).clear()), tx.objectStore('meta').clear(), tx.done]);
  }
}

/** Respaldo en memoria cuando IndexedDB no está disponible. Los datos se pierden al cerrar. */
export class MemoryRepository implements Repository {
  readonly kind = 'memory' as const;
  private data: AppData = { preferences: defaultPreferences(), consumption: [], checkins: [], expenses: [], goals: [] };

  async load(): Promise<LoadResult> {
    return { data: structuredClone(this.data), skipped: 0 };
  }
  async put<K extends CollectionName>(collection: K, item: CollectionTypes[K]): Promise<void> {
    const list = this.data[collection] as CollectionTypes[K][];
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = item;
    else list.push(item);
  }
  async remove(collection: CollectionName, id: string): Promise<void> {
    (this.data[collection] as { id: string }[]) = this.data[collection].filter((x) => x.id !== id);
  }
  async savePreferences(p: UserPreferences): Promise<void> {
    this.data.preferences = p;
  }
  async replaceAll(data: AppData): Promise<void> {
    this.data = structuredClone(data);
  }
  async clearAll(): Promise<void> {
    this.data = { preferences: defaultPreferences(), consumption: [], checkins: [], expenses: [], goals: [] };
  }
}

export async function openRepository(): Promise<{ repo: Repository; error: string | null }> {
  if (typeof indexedDB === 'undefined') {
    return { repo: new MemoryRepository(), error: 'Este navegador no ofrece almacenamiento local (IndexedDB).' };
  }
  try {
    return { repo: await IndexedDbRepository.open(), error: null };
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Error';
    return {
      repo: new MemoryRepository(),
      error: `No se pudo abrir el almacenamiento local (${name}). Puede ocurrir en modo privado o si el navegador bloquea el almacenamiento.`,
    };
  }
}
