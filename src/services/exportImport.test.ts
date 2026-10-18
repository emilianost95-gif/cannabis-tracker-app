import { describe, expect, it } from 'vitest';
import { buildExport, consumptionCsv, csvCell, exportJson, parseImport } from './exportImport';
import { testCheckin, testData, testEntry, testExpense, testGoal } from '../../tests/fixtures';

const data = testData({
  consumption: [
    testEntry('2026-10-12 21:00', { quantity: { value: 0.5, unit: 'g' }, notes: 'con "amigos", tranquilo', cost: { kind: 'paid', amountMinor: 250050, currency: 'ARS' } }),
    testEntry('2026-10-10 20:00', { notes: '=HYPERLINK("http://x")' }),
  ],
  checkins: [testCheckin('2026-10-11 09:00', { mood: 4 })],
  expenses: [testExpense('2026-10-09', 20000)],
  goals: [testGoal({ target: { type: 'free_days', minFreeDaysPerWeek: 2 } })],
});

describe('exportación JSON', () => {
  it('incluye metadatos y conteos', () => {
    const f = buildExport(data, new Date('2026-10-18T15:00:00.000Z'));
    expect(f.meta).toEqual({
      app: 'ritmo',
      schemaVersion: 1,
      exportedAt: '2026-10-18T15:00:00.000Z',
      counts: { consumption: 2, checkins: 1, expenses: 1, goals: 1 },
    });
    expect(f.consumption[0]!.occurredAt < f.consumption[1]!.occurredAt).toBe(true);
  });

  it('ida y vuelta sin pérdida', () => {
    const r = parseImport(exportJson(data));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(new Set(r.data.consumption.map((e) => e.id))).toEqual(new Set(data.consumption.map((e) => e.id)));
      expect(r.data.preferences).toEqual(data.preferences);
      expect(r.data.goals).toEqual(data.goals);
    }
  });
});

describe('importación validada', () => {
  it('rechaza JSON dañado', () => {
    expect(parseImport('{"meta": ')).toMatchObject({ ok: false });
  });
  it('rechaza archivos de otra app', () => {
    expect(parseImport(JSON.stringify({ meta: { app: 'otra' } }))).toMatchObject({ ok: false, error: expect.stringContaining('no es una copia') });
    expect(parseImport('[]')).toMatchObject({ ok: false });
  });
  it('rechaza versiones de esquema más nuevas', () => {
    const f = JSON.parse(exportJson(data));
    f.meta.schemaVersion = 99;
    expect(parseImport(JSON.stringify(f))).toMatchObject({ ok: false, error: expect.stringContaining('más nueva') });
  });
  it('rechaza registros inválidos y explica dónde', () => {
    const f = JSON.parse(exportJson(data));
    f.consumption[1].quantity = { value: -3, unit: 'g' };
    const r = parseImport(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.details.join(' ')).toContain('consumption.1.quantity');
  });
  it('rechaza ids duplicados', () => {
    const f = JSON.parse(exportJson(data));
    f.consumption[1].id = f.consumption[0].id;
    expect(parseImport(JSON.stringify(f)).ok).toBe(false);
  });
  it('rechaza conteos que no coinciden (archivo truncado o alterado)', () => {
    const f = JSON.parse(exportJson(data));
    f.consumption.pop();
    expect(parseImport(JSON.stringify(f)).ok).toBe(false);
  });
  it('rechaza unidades o monedas desconocidas', () => {
    const f = JSON.parse(exportJson(data));
    f.consumption.find((e: { quantity: unknown }) => e.quantity).quantity.unit = 'kilos';
    expect(parseImport(JSON.stringify(f)).ok).toBe(false);
    const g = JSON.parse(exportJson(data));
    g.expenses[0].amount.currency = 'XXX';
    expect(parseImport(JSON.stringify(g)).ok).toBe(false);
  });
});

describe('CSV', () => {
  it('escapa comillas, comas y saltos de línea', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
    expect(csvCell('línea\notra')).toBe('"línea\notra"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(0)).toBe('0');
  });
  it('neutraliza fórmulas de hojas de cálculo', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@x')).toBe("'@x");
    expect(csvCell(-5)).toBe('-5'); // números negativos reales no se alteran
  });
  it('genera encabezado y una fila por registro, en orden cronológico', () => {
    const csv = consumptionCsv(data);
    expect(csv.startsWith('﻿id,fecha_hora_local')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("'=HYPERLINK");
    expect(lines[2]).toContain('2500.50,ARS,pagado');
    expect(lines[2]).toContain('"con ""amigos"", tranquilo"');
    expect(lines[2]).toContain('2026-10-12 21:00');
  });
});
