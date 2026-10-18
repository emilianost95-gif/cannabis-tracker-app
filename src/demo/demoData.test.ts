import { describe, expect, it } from 'vitest';
import { generateDemoData } from './demoData';
import { consumptionEntry, expenseEntry, moodCheckIn, personalGoal, userPreferences } from '@/domain/model';
import { evaluateGoal } from '@/domain/goals';
import { entriesInPeriod } from '@/domain/analytics';
import { dayKey, weekOf } from '@/utils/dates';

const now = new Date(2026, 9, 18, 16, 30);

describe('datos de ejemplo', () => {
  const d = generateDemoData(now);

  it('todos los registros son válidos según el esquema', () => {
    expect(d.consumption.length).toBeGreaterThan(30);
    for (const e of d.consumption) expect(consumptionEntry.safeParse(e).success).toBe(true);
    for (const c of d.checkins) expect(moodCheckIn.safeParse(c).success).toBe(true);
    for (const x of d.expenses) expect(expenseEntry.safeParse(x).success).toBe(true);
    for (const g of d.goals) expect(personalGoal.safeParse(g).success).toBe(true);
    expect(userPreferences.safeParse(d.preferences).success).toBe(true);
  });

  it('nada está en el futuro y los ids son únicos y marcados como demo', () => {
    const all = [...d.consumption, ...d.checkins];
    expect(all.every((e) => Date.parse(e.occurredAt) <= now.getTime())).toBe(true);
    expect(d.expenses.every((x) => x.date <= dayKey(now))).toBe(true);
    const ids = [...all, ...d.expenses, ...d.goals].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((i) => i.startsWith('demo-'))).toBe(true);
  });

  it('es determinista', () => {
    expect(generateDemoData(now)).toEqual(d);
  });

  it('cuenta una historia de reducción', () => {
    // 8 semanas: del lunes 24 ago al domingo 18 oct 2026.
    const firstTwo = { from: weekOf('2026-08-24').from, to: weekOf('2026-08-31').to };
    const lastTwo = { from: weekOf('2026-10-05').from, to: weekOf('2026-10-12').to };
    expect(entriesInPeriod(d.consumption, firstTwo).length).toBeGreaterThan(entriesInPeriod(d.consumption, lastTwo).length);
  });

  it('los objetivos se pueden evaluar', () => {
    for (const g of d.goals) expect(evaluateGoal(g, d, dayKey(now)).status).not.toBe('not_started');
  });
});
