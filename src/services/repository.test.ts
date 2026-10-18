import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { DB_NAME, IndexedDbRepository, MemoryRepository } from './repository';
import { testData, testEntry, testExpense } from '../../tests/fixtures';

beforeEach(() => {
  // Base nueva y aislada para cada prueba.
  globalThis.indexedDB = new IDBFactory();
});

describe('IndexedDbRepository', () => {
  it('persiste y vuelve a leer tras reabrir', async () => {
    const repo = await IndexedDbRepository.open();
    const e = testEntry('2026-10-12 21:00', { quantity: { value: 1, unit: 'g' } });
    await repo.put('consumption', e);
    await repo.put('expenses', testExpense('2026-10-12', 1000));
    const again = await IndexedDbRepository.open();
    const { data, skipped } = await again.load();
    expect(data.consumption).toEqual([e]);
    expect(data.expenses).toHaveLength(1);
    expect(skipped).toBe(0);
  });

  it('actualiza y elimina por id', async () => {
    const repo = await IndexedDbRepository.open();
    const e = testEntry('2026-10-12 21:00');
    await repo.put('consumption', e);
    await repo.put('consumption', { ...e, notes: 'editado' });
    expect((await repo.load()).data.consumption.map((x) => x.notes)).toEqual(['editado']);
    await repo.remove('consumption', e.id);
    expect((await repo.load()).data.consumption).toEqual([]);
  });

  it('omite (sin borrar) registros guardados inválidos', async () => {
    const repo = await IndexedDbRepository.open();
    await repo.put('consumption', testEntry('2026-10-12 21:00'));
    const db = await openDB(DB_NAME);
    await db.put('consumption', { id: 'corrupto-0001', basura: true });
    db.close();
    const { data, skipped } = await repo.load();
    expect(data.consumption).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it('replaceAll reemplaza todo y clearAll borra todo', async () => {
    const repo = await IndexedDbRepository.open();
    await repo.put('consumption', testEntry('2026-10-01 21:00'));
    const next = testData({ consumption: [testEntry('2026-10-12 21:00'), testEntry('2026-10-13 21:00')] });
    next.preferences.currency = 'ARS';
    await repo.replaceAll(next);
    let { data } = await repo.load();
    expect(data.consumption.map((e) => e.id).sort()).toEqual(next.consumption.map((e) => e.id).sort());
    expect(data.preferences.currency).toBe('ARS');
    await repo.clearAll();
    ({ data } = await repo.load());
    expect(data.consumption).toEqual([]);
    expect(data.preferences.currency).toBe('CLP');
  });

  it('replaceAll fallido no modifica los datos existentes', async () => {
    const repo = await IndexedDbRepository.open();
    const keep = testEntry('2026-10-01 21:00');
    await repo.put('consumption', keep);
    // Un valor no clonable hace fallar la escritura a mitad de la transacción.
    const broken = testData({ consumption: [testEntry('2026-10-12 21:00'), { ...testEntry('2026-10-13 21:00'), notes: (() => 1) as unknown as string }] });
    await expect(repo.replaceAll(broken)).rejects.toBeTruthy();
    const { data } = await repo.load();
    expect(data.consumption).toEqual([keep]);
  });
});

describe('MemoryRepository', () => {
  it('implementa la misma interfaz', async () => {
    const repo = new MemoryRepository();
    const e = testEntry('2026-10-12 21:00');
    await repo.put('consumption', e);
    expect((await repo.load()).data.consumption).toEqual([e]);
    await repo.clearAll();
    expect((await repo.load()).data.consumption).toEqual([]);
  });
});
