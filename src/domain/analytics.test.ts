import { describe, expect, it } from 'vitest';
import {
  averagePerDay,
  budgetStatus,
  checkinAssociation,
  comparePeriods,
  contextDistribution,
  dailyCounts,
  dailyQuantity,
  dailySpending,
  entriesInPeriod,
  estimatedUsage,
  freeDays,
  quantityTotals,
  realSpending,
  trackingStart,
  weeklyCounts,
} from './analytics';
import { comparedRange } from '@/utils/dates';
import { testCheckin, testEntry, testExpense } from '../../tests/fixtures';

const entries = [
  testEntry('2026-10-12 21:00', { quantity: { value: 0.5, unit: 'g' }, context: 'relax' }),
  testEntry('2026-10-12 23:59', { quantity: { value: 0.25, unit: 'g' }, context: 'social' }),
  testEntry('2026-10-14 00:01', { quantity: { value: 5, unit: 'puff' }, context: 'relax', method: 'vape_cartridge' }),
  testEntry('2026-10-16 20:00'),
];

describe('frecuencia diaria', () => {
  it('agrupa por día local y respeta la medianoche', () => {
    const d = dailyCounts(entries, { from: '2026-10-12', to: '2026-10-16' }, '2026-10-12');
    expect(d.map((x) => x.count)).toEqual([2, 0, 1, 0, 1]);
    expect(d.every((x) => x.tracked)).toBe(true);
  });

  it('marca como desconocidos los días anteriores al inicio del registro', () => {
    const d = dailyCounts(entries, { from: '2026-10-10', to: '2026-10-12' }, '2026-10-12');
    expect(d.map((x) => x.tracked)).toEqual([false, false, true]);
  });
});

describe('frecuencia semanal', () => {
  it('cuenta por semana lunes–domingo dentro del período', () => {
    const w = weeklyCounts(entries, { from: '2026-10-12', to: '2026-10-25' }, '2026-10-12');
    expect(w.map((x) => [x.week.from, x.count])).toEqual([
      ['2026-10-12', 4],
      ['2026-10-19', 0],
    ]);
  });
});

describe('días sin consumo', () => {
  it('excluye días sin datos y no los cuenta como libres', () => {
    expect(freeDays(entries, { from: '2026-10-10', to: '2026-10-16' }, '2026-10-12')).toEqual({ free: 2, tracked: 5, untracked: 2 });
  });
  it('sin ningún registro todo es desconocido', () => {
    expect(freeDays([], { from: '2026-10-10', to: '2026-10-16' }, null)).toEqual({ free: 0, tracked: 0, untracked: 7 });
  });
});

describe('comparación de períodos', () => {
  it('compara exactamente los rangos indicados', () => {
    const older = [testEntry('2026-10-05 10:00'), testEntry('2026-10-06 10:00'), testEntry('2026-10-07 10:00'), testEntry('2026-10-08 10:00'), testEntry('2026-10-09 10:00')];
    const all = [...older, ...entries];
    const c = comparePeriods(all, comparedRange('7d', '2026-10-18'), '2026-10-05');
    expect(c.current).toBe(4);
    expect(c.previous).toBe(5);
    expect(c.delta).toBe(-1);
    expect(c.previousComparable).toBe(true);
  });

  it('no compara si el período anterior es previo al inicio del registro', () => {
    const c = comparePeriods(entries, comparedRange('7d', '2026-10-18'), '2026-10-12');
    expect(c.previousComparable).toBe(false);
  });
});

describe('cantidades', () => {
  it('totales por unidad y sesiones sin cantidad aparte', () => {
    const q = quantityTotals(entries);
    expect(q.totals).toEqual({ g: 0.75, puff: 5 });
    expect(q.withoutQuantity).toBe(1);
  });

  it('serie diaria en una sola unidad', () => {
    expect(dailyQuantity(entries, { from: '2026-10-12', to: '2026-10-14' }, 'g').map((d) => d.value)).toEqual([0.75, 0, 0]);
    expect(dailyQuantity(entries, { from: '2026-10-12', to: '2026-10-14' }, 'puff').map((d) => d.value)).toEqual([0, 0, 5]);
  });
});

describe('contexto', () => {
  it('distribución ordenada con "sin contexto" al final', () => {
    expect(contextDistribution(entries)).toEqual([
      { context: 'relax', count: 2 },
      { context: 'social', count: 1 },
      { context: null, count: 1 },
    ]);
  });
});

describe('gasto', () => {
  const consumption = [
    testEntry('2026-10-12 21:00', { cost: { kind: 'paid', amountMinor: 5000, currency: 'CLP' } }),
    testEntry('2026-10-13 21:00', { cost: { kind: 'estimated', amountMinor: 3000, currency: 'CLP' } }),
    testEntry('2026-10-13 22:00', { cost: { kind: 'paid', amountMinor: 200000, currency: 'ARS' } }),
  ];
  const expenses = [testExpense('2026-10-12', 20000), testExpense('2026-10-20', 15000)];
  const p = { from: '2026-10-12', to: '2026-10-18' };

  it('gasto real = compras + pagos en sesión, sin estimaciones', () => {
    expect(realSpending(expenses, consumption, p)).toEqual({ CLP: 25000, ARS: 200000 });
  });

  it('estimaciones aparte (sin doble conteo)', () => {
    expect(estimatedUsage(consumption, p)).toEqual({ CLP: 3000 });
  });

  it('serie diaria en una moneda', () => {
    expect(dailySpending(expenses, consumption, { from: '2026-10-12', to: '2026-10-13' }, 'CLP')).toEqual([
      { day: '2026-10-12', amountMinor: 25000 },
      { day: '2026-10-13', amountMinor: 0 },
    ]);
  });

  it('presupuesto: margen y exceso', () => {
    expect(budgetStatus(30000, 25000)).toEqual({ limitMinor: 30000, spentMinor: 25000, remainingMinor: 5000, ratio: 25000 / 30000 });
    expect(budgetStatus(20000, 25000).remainingMinor).toBe(-5000);
  });
});

describe('asociación con el registro personal', () => {
  it('no concluye nada con pocos datos', () => {
    const r = checkinAssociation(entries, [testCheckin('2026-10-12 10:00', { mood: 2 })], 'mood', { from: '2026-10-01', to: '2026-10-31' });
    expect(r.sufficient).toBe(false);
    expect(r.withConsumption.days).toBe(1);
  });

  it('promedia por día y separa días con y sin consumo', () => {
    const consumed = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'];
    const free = ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'];
    const c = consumed.map((d) => testEntry(`${d} 21:00`));
    const ch = [
      ...consumed.map((d) => testCheckin(`${d} 09:00`, { mood: 2 })),
      ...consumed.slice(0, 1).map((d) => testCheckin(`${d} 18:00`, { mood: 4 })), // ese día promedia 3
      ...free.map((d) => testCheckin(`${d} 09:00`, { mood: 4 })),
    ];
    const r = checkinAssociation(c, ch, 'mood', { from: '2026-10-01', to: '2026-10-31' });
    expect(r.sufficient).toBe(true);
    expect(r.withConsumption).toEqual({ days: 5, average: 2.2 });
    expect(r.withoutConsumption).toEqual({ days: 5, average: 4 });
  });
});

describe('promedio por día', () => {
  it('usa solo los días con datos', () => {
    expect(averagePerDay(3, 2)).toBe(1.5);
    expect(averagePerDay(1, 3)).toBe(0.3);
    expect(averagePerDay(5, 0)).toBe(0);
  });
});

describe('inicio del registro', () => {
  it('toma el primer registro de cualquier tipo', () => {
    expect(trackingStart(entries, [testCheckin('2026-10-01 10:00', { mood: 3 })], [])).toBe('2026-10-01');
    expect(trackingStart([], [], [testExpense('2026-09-30', 100)])).toBe('2026-09-30');
    expect(trackingStart([], [], [])).toBeNull();
  });

  it('entriesInPeriod usa el día local', () => {
    expect(entriesInPeriod(entries, { from: '2026-10-14', to: '2026-10-14' })).toHaveLength(1);
  });
});
