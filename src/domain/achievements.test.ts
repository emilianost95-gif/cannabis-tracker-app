import { describe, expect, it } from 'vitest';
import { computeAchievements, type AchievementId } from './achievements';
import { testCheckin, testData, testEntry, testExpense, testGoal } from '../../tests/fixtures';

const get = (r: ReturnType<typeof computeAchievements>, id: AchievementId) => r.achievements.find((a) => a.id === id)!;

describe('logros y rachas', () => {
  it('sin datos no hay nada desbloqueado', () => {
    const r = computeAchievements(testData(), '2026-10-18');
    expect(r).toMatchObject({ currentFreeStreak: 0, bestFreeStreak: 0, freeDaysTotal: 0 });
    expect(r.achievements.every((a) => !a.unlocked)).toBe(true);
  });

  it('racha actual y mejor racha cuentan solo días terminados', () => {
    // Sesiones el 5 y el 9; hoy es 14 (sin sesión): libres 6,7,8 y 10..13.
    const d = testData({ consumption: [testEntry('2026-10-05 20:00'), testEntry('2026-10-09 20:00')] });
    const r = computeAchievements(d, '2026-10-14');
    expect(r.currentFreeStreak).toBe(4);
    expect(r.bestFreeStreak).toBe(4);
    expect(r.freeDaysTotal).toBe(7);
    expect(get(r, 'streak_3').unlocked).toBe(true);
    expect(get(r, 'streak_7')).toMatchObject({ unlocked: false, value: 4, target: 7 });
  });

  it('si hoy ya hubo sesión la racha actual es 0', () => {
    const d = testData({ consumption: [testEntry('2026-10-05 20:00'), testEntry('2026-10-14 10:00')] });
    expect(computeAchievements(d, '2026-10-14').currentFreeStreak).toBe(0);
  });

  it('no premia la cantidad consumida', () => {
    const many = testData({ consumption: Array.from({ length: 40 }, (_, i) => testEntry(`2026-10-${String(1 + (i % 14)).padStart(2, '0')} ${10 + (i % 10)}:00`)) });
    const r = computeAchievements(many, '2026-10-15');
    expect(r.achievements.filter((a) => a.unlocked).map((a) => a.id)).toEqual([]);
  });

  it('finde sin humo', () => {
    // 10 y 11 oct 2026 son sábado y domingo.
    const d = testData({ consumption: [testEntry('2026-10-09 20:00'), testEntry('2026-10-12 20:00')] });
    expect(get(computeAchievements(d, '2026-10-13'), 'free_weekend').unlocked).toBe(true);
    expect(get(computeAchievements(d, '2026-10-11'), 'free_weekend').unlocked).toBe(false); // domingo no terminó
  });

  it('semana por debajo del propio promedio', () => {
    const weeks = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'];
    const consumption = weeks.flatMap((w) => [0, 1, 2, 3].map((i) => testEntry(`${w.slice(0, 8)}${String(Number(w.slice(8)) + i).padStart(2, '0')} 20:00`)));
    consumption.push(testEntry('2026-10-05 20:00')); // semana del 5 oct: 1 sesión (< 4)
    const r = computeAchievements(testData({ consumption }), '2026-10-13');
    expect(get(r, 'below_average').unlocked).toBe(true);
  });

  it('metas cumplidas, constancia y presupuesto', () => {
    const data = testData({
      consumption: [testEntry('2026-10-05 20:00')],
      checkins: ['05', '06', '07', '08', '09', '10', '11'].map((d) => testCheckin(`2026-10-${d} 09:00`, { mood: 3 })),
      goals: [testGoal({ startDate: '2026-10-05', target: { type: 'reduce_frequency', maxSessionsPerWeek: 2 } })],
      expenses: [testExpense('2026-09-10', 10000)],
    });
    data.preferences.budgets.monthly = { amountMinor: 20000, currency: 'CLP' };
    // El registro empieza el 10 sep: septiembre no está completo en datos → no cuenta.
    const r = computeAchievements(data, '2026-10-13');
    expect(get(r, 'goal_met').unlocked).toBe(true);
    expect(get(r, 'log_7').unlocked).toBe(true);
    expect(get(r, 'budget_month').unlocked).toBe(false);

    data.expenses = [testExpense('2026-09-01', 10000)];
    expect(get(computeAchievements(data, '2026-10-13'), 'budget_month').unlocked).toBe(true);
  });
});
