import { describe, expect, it } from 'vitest';
import { buildConsumptionEntry, buildRepeatEntry, estimateCost, findPossibleDuplicate, lastEntry, type ConsumptionFormValues } from './entries';
import { consumptionEntry } from './model';
import { testEntry } from '../../tests/fixtures';

const now = new Date(2026, 9, 18, 12, 0); // 18 oct 2026 12:00 local
const base: ConsumptionFormValues = {
  occurredAtLocal: '2026-10-18T10:30',
  method: 'flower_smoked',
  quantityText: '',
  unit: 'g',
  context: null,
  moodBefore: null,
  sleepQuality: null,
  stress: null,
  costMode: 'none',
  costText: '',
  currency: 'CLP',
  notes: '',
  strainText: '',
  effectRating: null,
};
const opts = { referencePrices: [], now, id: 'test-id-0001' };

describe('validación de registros de consumo', () => {
  it('guarda una sesión mínima sin cantidad ni campos emocionales', () => {
    const r = buildConsumptionEntry(base, opts);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.entry.quantity).toBeNull();
      expect(r.entry.moodBefore).toBeNull();
      expect(r.entry.occurredAt).toBe('2026-10-18T13:30:00.000Z');
      expect(consumptionEntry.safeParse(r.entry).success).toBe(true);
    }
  });

  it('rechaza fechas futuras e inválidas', () => {
    expect(buildConsumptionEntry({ ...base, occurredAtLocal: '2026-10-19T10:00' }, opts)).toMatchObject({ ok: false, errors: { occurredAt: expect.any(String) } });
    expect(buildConsumptionEntry({ ...base, occurredAtLocal: '' }, opts)).toMatchObject({ ok: false });
    expect(buildConsumptionEntry({ ...base, occurredAtLocal: '1999-12-31T10:00' }, opts)).toMatchObject({ ok: false });
  });

  it('exige unidad cuando hay cantidad', () => {
    expect(buildConsumptionEntry({ ...base, quantityText: '0,5', unit: null }, opts)).toMatchObject({ ok: false, errors: { unit: expect.any(String) } });
  });

  it('rechaza cantidades inválidas o fuera de límite', () => {
    expect(buildConsumptionEntry({ ...base, quantityText: '-1' }, opts).ok).toBe(false);
    expect(buildConsumptionEntry({ ...base, quantityText: 'mucho' }, opts).ok).toBe(false);
    expect(buildConsumptionEntry({ ...base, quantityText: '500', unit: 'g' }, opts)).toMatchObject({ ok: false, errors: { quantity: expect.stringContaining('50') } });
    expect(buildConsumptionEntry({ ...base, quantityText: '0,1234' }, opts)).toMatchObject({ ok: false, errors: { quantity: expect.any(String) } });
  });

  it('importe pagado: valida y guarda en unidades menores', () => {
    const r = buildConsumptionEntry({ ...base, costMode: 'paid', costText: '5.000' }, opts);
    expect(r.ok && r.entry.cost).toEqual({ kind: 'paid', amountMinor: 5000, currency: 'CLP' });
    expect(buildConsumptionEntry({ ...base, costMode: 'paid', costText: '0' }, opts).ok).toBe(false);
  });

  it('estimación: requiere precio de referencia en la misma unidad', () => {
    const refs = [{ unit: 'g' as const, perQuantity: 1, price: { amountMinor: 10000, currency: 'CLP' as const } }];
    const ok = buildConsumptionEntry({ ...base, quantityText: '0,3', costMode: 'estimated' }, { ...opts, referencePrices: refs });
    expect(ok.ok && ok.entry.cost).toEqual({ kind: 'estimated', amountMinor: 3000, currency: 'CLP' });
    const wrongUnit = buildConsumptionEntry({ ...base, quantityText: '3', unit: 'puff', costMode: 'estimated' }, { ...opts, referencePrices: refs });
    expect(wrongUnit.ok).toBe(false);
    expect(estimateCost({ value: 3, unit: 'puff' }, refs)).toBeNull();
  });

  it('al editar conserva id y fecha de creación', () => {
    const existing = testEntry('2026-10-10 20:00');
    const r = buildConsumptionEntry({ ...base, notes: '  nota  ' }, { ...opts, existing });
    expect(r.ok && [r.entry.id, r.entry.createdAt, r.entry.notes]).toEqual([existing.id, existing.createdAt, 'nota']);
  });
});

describe('posibles duplicados', () => {
  it('detecta el mismo formato y cantidad a menos de 10 minutos', () => {
    const a = testEntry('2026-10-18 10:30', { quantity: { value: 0.5, unit: 'g' } });
    const b = testEntry('2026-10-18 10:35', { quantity: { value: 0.5, unit: 'g' } });
    const c = testEntry('2026-10-18 11:00', { quantity: { value: 0.5, unit: 'g' } });
    const d = testEntry('2026-10-18 10:35', { quantity: { value: 0.5, unit: 'g' }, method: 'edible' });
    expect(findPossibleDuplicate([a], b)?.id).toBe(a.id);
    expect(findPossibleDuplicate([a], c)).toBeNull();
    expect(findPossibleDuplicate([a], d)).toBeNull();
    expect(findPossibleDuplicate([a], a)).toBeNull();
  });
});

describe('repetir la última sesión', () => {
  const refs = [{ unit: 'g' as const, perQuantity: 1, price: { amountMinor: 10000, currency: 'CLP' as const } }];

  it('elige la sesión más reciente por fecha', () => {
    const a = testEntry('2026-10-10 20:00');
    const b = testEntry('2026-10-12 20:00');
    expect(lastEntry([b, a])?.id).toBe(b.id);
    expect(lastEntry([])).toBeNull();
  });

  it('copia forma, cantidad, contexto y variedad; no copia estado ni notas', () => {
    const last = testEntry('2026-10-12 20:00', {
      method: 'vape_cartridge',
      quantity: { value: 6, unit: 'puff' },
      context: 'relax',
      strain: 'Gelato',
      moodBefore: 2,
      effectRating: 5,
      notes: 'de ese día',
    });
    const r = buildRepeatEntry(last, refs, now, 'test-id-rep1');
    expect(r).toMatchObject({ id: 'test-id-rep1', method: 'vape_cartridge', quantity: { value: 6, unit: 'puff' }, context: 'relax', strain: 'Gelato' });
    expect(r).toMatchObject({ moodBefore: null, effectRating: null, notes: '', occurredAt: now.toISOString() });
  });

  it('no copia importes pagados y recalcula los estimados', () => {
    const paid = testEntry('2026-10-12 20:00', { quantity: { value: 0.5, unit: 'g' }, cost: { kind: 'paid', amountMinor: 7000, currency: 'CLP' } });
    expect(buildRepeatEntry(paid, refs, now, 'test-id-rep2').cost).toBeNull();
    const est = testEntry('2026-10-12 20:00', { quantity: { value: 0.5, unit: 'g' }, cost: { kind: 'estimated', amountMinor: 1, currency: 'CLP' } });
    expect(buildRepeatEntry(est, refs, now, 'test-id-rep3').cost).toEqual({ kind: 'estimated', amountMinor: 5000, currency: 'CLP' });
    expect(buildRepeatEntry(est, [], now, 'test-id-rep4').cost).toBeNull();
  });
});
