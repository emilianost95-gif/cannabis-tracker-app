import { describe, expect, it } from 'vitest';
import { DEFAULT_SHARE_OPTIONS, shareCardContent } from './shareCard';
import { testData, testEntry, testExpense } from '../../tests/fixtures';

const fmt = { money: (m: number) => `$${m}`, number: (n: number) => String(n) };

describe('tarjeta para compartir', () => {
  // Semana del lunes 12 oct; hoy jueves 15. Sesión el lunes; martes y miércoles sin humo.
  const data = testData({
    consumption: [testEntry('2026-10-05 20:00'), testEntry('2026-10-12 20:00')],
    expenses: [testExpense('2026-10-13', 20000)],
  });

  it('por defecto muestra solo días sin humo y racha', () => {
    const c = shareCardContent(data, '2026-10-15', DEFAULT_SHARE_OPTIONS, fmt);
    expect(c.stats.map((s) => s.key)).toEqual(['freeDays', 'streak']);
    expect(c.stats[0]).toMatchObject({ value: '2/3' });
    expect(c.stats[1]).toMatchObject({ value: '2' });
    expect(c.period).toEqual({ from: '2026-10-12', to: '2026-10-18' });
  });

  it('sesiones y gasto solo si se eligen', () => {
    const c = shareCardContent(data, '2026-10-15', { freeDays: false, streak: false, sessions: true, spending: true }, fmt);
    expect(c.stats).toEqual([
      { key: 'sessions', value: '1', label: 'sesiones (mi promedio: 1)' },
      { key: 'spending', value: '$20000', label: 'en humo esta semana' },
    ]);
  });

  it('lunes: todavía no hay días terminados en la semana', () => {
    const c = shareCardContent(data, '2026-10-12', DEFAULT_SHARE_OPTIONS, fmt);
    expect(c.stats[0]!.value).toBe('—');
  });
});

describe('tarjeta: racha', () => {
  it('si hoy no hay racha muestra la mejor', () => {
    const d = testData({ consumption: [testEntry('2026-10-05 20:00'), testEntry('2026-10-09 20:00'), testEntry('2026-10-15 10:00')] });
    const c = shareCardContent(d, '2026-10-15', DEFAULT_SHARE_OPTIONS, fmt);
    expect(c.stats[1]).toEqual({ key: 'streak', value: '5', label: 'días: mi mejor racha sin humo' });
  });
});
