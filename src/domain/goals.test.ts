import { describe, expect, it } from 'vitest';
import { complianceRate, evaluateGoal, togglePause } from './goals';
import { personalGoal } from './model';
import { testCheckin, testEntry, testExpense, testGoal } from '../../tests/fixtures';

const empty = { consumption: [], checkins: [], expenses: [] };

describe('reducir frecuencia (máx. sesiones por semana)', () => {
  const goal = testGoal({ startDate: '2026-10-05', target: { type: 'reduce_frequency', maxSessionsPerWeek: 2 } });

  it('evalúa cada semana cerrada y la actual en curso', () => {
    const consumption = [
      testEntry('2026-10-05 20:00'),
      testEntry('2026-10-07 20:00'), // semana 1: 2 → cumplido
      testEntry('2026-10-12 20:00'),
      testEntry('2026-10-13 20:00'),
      testEntry('2026-10-14 20:00'), // semana 2: 3 → no cumplido
      testEntry('2026-10-19 20:00'), // semana 3: 1 → en curso
    ];
    const ev = evaluateGoal(goal, { ...empty, consumption }, '2026-10-20');
    expect(ev.periods.map((p) => [p.period.from, p.status, p.value])).toEqual([
      ['2026-10-05', 'met', 2],
      ['2026-10-12', 'not_met', 3],
      ['2026-10-19', 'in_progress', 1],
    ]);
    expect(ev.status).toBe('in_progress');
    expect(complianceRate(ev)).toEqual({ met: 1, closed: 2 });
  });

  it('una semana en curso ya superada se marca como no cumplida', () => {
    const consumption = ['2026-10-19', '2026-10-20', '2026-10-20'].map((d) => testEntry(`${d} 21:00`));
    const ev = evaluateGoal(goal, { ...empty, consumption }, '2026-10-20');
    expect(ev.current?.status).toBe('not_met');
  });

  it('no cuenta sesiones anteriores al inicio del objetivo', () => {
    const g = testGoal({ startDate: '2026-10-08', target: { type: 'reduce_frequency', maxSessionsPerWeek: 1 } });
    const consumption = [testEntry('2026-10-06 20:00'), testEntry('2026-10-07 20:00'), testEntry('2026-10-09 20:00')];
    const ev = evaluateGoal(g, { ...empty, consumption }, '2026-10-20');
    expect(ev.periods[0]).toMatchObject({ window: { from: '2026-10-08', to: '2026-10-11' }, value: 1, status: 'met' });
  });
});

describe('días sin consumo', () => {
  const goal = testGoal({ startDate: '2026-10-12', target: { type: 'free_days', minFreeDaysPerWeek: 3 } });

  it('cumplido cuando hay suficientes días cerrados sin sesiones', () => {
    const consumption = ['2026-10-12', '2026-10-14', '2026-10-16'].map((d) => testEntry(`${d} 21:00`));
    const ev = evaluateGoal(goal, { ...empty, consumption }, '2026-10-25');
    expect(ev.periods[0]).toMatchObject({ value: 4, target: 3, status: 'met' });
  });

  it('el día de hoy no cuenta como libre hasta que termine', () => {
    const ev = evaluateGoal(goal, empty, '2026-10-12');
    expect(ev.current).toMatchObject({ value: 0, status: 'in_progress' });
  });

  it('no cumplido cuando ya no alcanzan los días restantes', () => {
    const consumption = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'].map((d) => testEntry(`${d} 21:00`));
    const ev = evaluateGoal(goal, { ...empty, consumption }, '2026-10-17');
    expect(ev.current?.status).toBe('not_met');
  });

  it('ajusta la meta en una semana parcial', () => {
    const g = testGoal({ startDate: '2026-10-17', target: { type: 'free_days', minFreeDaysPerWeek: 5 } }); // sábado
    const ev = evaluateGoal(g, empty, '2026-10-19');
    expect(ev.periods[0]).toMatchObject({ target: 2, value: 2, status: 'met' });
  });
});

describe('pausa', () => {
  const goal = testGoal({ startDate: '2026-10-10', endDate: '2026-10-16', target: { type: 'pause' } });

  it('en curso con avance por días', () => {
    const ev = evaluateGoal(goal, empty, '2026-10-12');
    expect(ev.status).toBe('in_progress');
    expect(ev.progress).toEqual({ elapsedDays: 3, totalDays: 7, sessions: 0 });
  });

  it('cumplida si no hubo sesiones al terminar', () => {
    expect(evaluateGoal(goal, { ...empty, consumption: [testEntry('2026-10-17 10:00')] }, '2026-10-20').status).toBe('met');
  });

  it('no cumplida si hubo sesiones durante la pausa', () => {
    const ev = evaluateGoal(goal, { ...empty, consumption: [testEntry('2026-10-11 22:00')] }, '2026-10-20');
    expect(ev.status).toBe('not_met');
    expect(ev.progress?.sessions).toBe(1);
  });

  it('el esquema exige fecha de fin', () => {
    const bad = { ...testGoal({ target: { type: 'pause' } }), endDate: null };
    expect(personalGoal.safeParse(bad).success).toBe(false);
  });
});

describe('límite de gasto', () => {
  it('mensual: usa el gasto real (no estimado) en su moneda', () => {
    const g = testGoal({
      startDate: '2026-09-01',
      target: { type: 'spending_limit', period: 'month', limit: { amountMinor: 30000, currency: 'CLP' } },
    });
    const data = {
      ...empty,
      expenses: [testExpense('2026-09-10', 20000), testExpense('2026-09-25', 15000), testExpense('2026-10-02', 10000)],
      consumption: [testEntry('2026-10-03 20:00', { cost: { kind: 'estimated', amountMinor: 50000, currency: 'CLP' } })],
    };
    const ev = evaluateGoal(g, data, '2026-10-18');
    expect(ev.periods.map((p) => [p.period.from, p.value, p.status])).toEqual([
      ['2026-09-01', 35000, 'not_met'],
      ['2026-10-01', 10000, 'in_progress'],
    ]);
  });
});

describe('registro diario y observación', () => {
  it('registro diario cuenta consumos y registros personales', () => {
    const g = testGoal({ startDate: '2026-10-12', target: { type: 'daily_log', minLoggedDaysPerWeek: 3 } });
    const ev = evaluateGoal(
      g,
      { ...empty, consumption: [testEntry('2026-10-12 20:00')], checkins: [testCheckin('2026-10-13 10:00', { mood: 3 }), testCheckin('2026-10-15 10:00', { mood: 3 })] },
      '2026-10-20',
    );
    expect(ev.periods[0]).toMatchObject({ value: 3, status: 'met' });
  });

  it('observación termina tras N semanas', () => {
    const g = testGoal({ startDate: '2026-10-01', target: { type: 'observe', weeks: 2 } });
    expect(evaluateGoal(g, empty, '2026-10-10')).toMatchObject({ status: 'in_progress', progress: { elapsedDays: 10, totalDays: 14 } });
    expect(evaluateGoal(g, empty, '2026-10-20').status).toBe('met');
  });

  it('un objetivo futuro aún no empieza', () => {
    const g = testGoal({ startDate: '2026-11-01', target: { type: 'observe', weeks: 2 } });
    expect(evaluateGoal(g, empty, '2026-10-20').status).toBe('not_started');
  });
});

describe('pausar y reanudar objetivos', () => {
  it('las semanas completamente en pausa no se evalúan', () => {
    const g = testGoal({
      startDate: '2026-10-05',
      status: 'active',
      pausedIntervals: [{ from: '2026-10-12', to: '2026-10-18' }],
      target: { type: 'reduce_frequency', maxSessionsPerWeek: 0 },
    });
    const consumption = [testEntry('2026-10-14 20:00')];
    const ev = evaluateGoal(g, { ...empty, consumption }, '2026-10-20');
    expect(ev.periods.map((p) => p.status)).toEqual(['met', 'paused', 'in_progress']);
  });

  it('togglePause abre y cierra intervalos', () => {
    const g = testGoal({ target: { type: 'observe', weeks: 4 } });
    const paused = togglePause(g, '2026-10-10', 'x');
    expect(paused).toMatchObject({ status: 'paused', pausedIntervals: [{ from: '2026-10-10', to: null }] });
    const resumed = togglePause(paused, '2026-10-15', 'y');
    expect(resumed).toMatchObject({ status: 'active', pausedIntervals: [{ from: '2026-10-10', to: '2026-10-14' }] });
    // Pausar y reanudar el mismo día no deja intervalo.
    expect(togglePause(togglePause(g, '2026-10-10', 'a'), '2026-10-10', 'b').pausedIntervals).toEqual([]);
  });
});
