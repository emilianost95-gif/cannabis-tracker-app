import { describe, expect, it } from 'vitest';
import { strainKey, strainNames, strainSummaries } from './strains';
import { consumptionEntry } from './model';
import { testEntry } from '../../tests/fixtures';

describe('variedades', () => {
  const entries = [
    testEntry('2026-10-01 20:00', { strain: 'amnesia', effectRating: 4 }),
    testEntry('2026-10-03 20:00', { strain: 'Amnesia ', effectRating: 2 }),
    testEntry('2026-10-05 20:00', { strain: 'Amnesia' }),
    testEntry('2026-10-04 20:00', { strain: 'Gelato', effectRating: 5 }),
    testEntry('2026-10-06 20:00'),
  ];

  it('agrupa sin distinguir mayúsculas, tildes ni espacios', () => {
    expect(strainKey('  Ámnesia   Haze ')).toBe('amnesia haze');
    const s = strainSummaries(entries);
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual({ name: 'Amnesia', sessions: 3, rated: 2, averageRating: 3, lastUsed: entries[2]!.occurredAt });
    expect(s[1]).toMatchObject({ name: 'Gelato', sessions: 1, averageRating: 5 });
  });

  it('el promedio solo usa sesiones calificadas', () => {
    expect(strainSummaries([testEntry('2026-10-01 20:00', { strain: 'X' })])[0]!.averageRating).toBeNull();
  });

  it('nombres para autocompletar, más usados primero', () => {
    expect(strainNames(entries)).toEqual(['Amnesia', 'Gelato']);
  });
});

describe('migración del esquema v1 → v2', () => {
  it('un registro v1 (sin variedad) se lee como v2 con valores vacíos', () => {
    const { strain: _s, effectRating: _e, ...v1 } = { ...testEntry('2026-10-01 20:00'), schemaVersion: 1 };
    const r = consumptionEntry.safeParse(v1);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ schemaVersion: 2, strain: null, effectRating: null });
  });

  it('variedad vacía se guarda como null y se recorta', () => {
    expect(consumptionEntry.parse({ ...testEntry('2026-10-01 20:00'), strain: '   ' }).strain).toBeNull();
    expect(consumptionEntry.parse({ ...testEntry('2026-10-01 20:00'), strain: ' Gelato ' }).strain).toBe('Gelato');
  });

  it('rechaza versiones desconocidas', () => {
    expect(consumptionEntry.safeParse({ ...testEntry('2026-10-01 20:00'), schemaVersion: 3 }).success).toBe(false);
  });
});
