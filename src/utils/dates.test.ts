import { describe, expect, it } from 'vitest';
import {
  comparedRange,
  dayKey,
  dayKeyOfIso,
  daysBetweenInclusive,
  eachDayKey,
  localInputToIso,
  monthOf,
  weekOf,
  weeksIn,
} from './dates';

describe('zona horaria de las pruebas', () => {
  it('es America/Santiago', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Santiago');
  });
});

describe('conversión a día local', () => {
  it('asigna al día local, no al día UTC', () => {
    // 2026-10-06 01:30 UTC = 2026-10-05 22:30 en Santiago (UTC-3 en horario de verano)
    expect(dayKeyOfIso('2026-10-06T01:30:00.000Z')).toBe('2026-10-05');
    expect(dayKeyOfIso('2026-10-06T03:30:00.000Z')).toBe('2026-10-06');
  });

  it('cuenta días correctamente a través del cambio de hora de septiembre', () => {
    // En Chile el reloj se adelanta el primer domingo de septiembre (6 sep 2026).
    const days = eachDayKey({ from: '2026-09-04', to: '2026-09-08' });
    expect(days).toEqual(['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08']);
    expect(daysBetweenInclusive({ from: '2026-09-01', to: '2026-09-30' })).toBe(30);
  });

  it('cuenta días correctamente a través del cambio de hora de abril', () => {
    expect(eachDayKey({ from: '2026-04-03', to: '2026-04-06' })).toHaveLength(4);
  });

  it('período vacío si fin < inicio', () => {
    expect(eachDayKey({ from: '2026-01-02', to: '2026-01-01' })).toEqual([]);
  });
});

describe('semanas y meses', () => {
  it('semanas de lunes a domingo', () => {
    expect(weekOf('2026-10-18')).toEqual({ from: '2026-10-12', to: '2026-10-18' }); // domingo
    expect(weekOf('2026-10-19')).toEqual({ from: '2026-10-19', to: '2026-10-25' }); // lunes
  });

  it('semanas que cruzan un cambio de mes', () => {
    expect(weekOf('2026-11-01')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(weeksIn({ from: '2026-10-28', to: '2026-11-03' }).map((w) => w.from)).toEqual(['2026-10-26', '2026-11-02']);
  });

  it('mes completo, incluido febrero bisiesto', () => {
    expect(monthOf('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthOf('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('comparación de períodos', () => {
  it('últimos 7 días vs 7 anteriores', () => {
    expect(comparedRange('7d', '2026-10-18')).toEqual({
      current: { from: '2026-10-12', to: '2026-10-18' },
      previous: { from: '2026-10-05', to: '2026-10-11' },
    });
  });

  it('30 días cruzando meses', () => {
    const r = comparedRange('30d', '2026-03-05');
    expect(r.current).toEqual({ from: '2026-02-04', to: '2026-03-05' });
    expect(daysBetweenInclusive(r.previous)).toBe(30);
    expect(r.previous.to).toBe('2026-02-03');
  });

  it('mes en curso vs mismo tramo del mes anterior', () => {
    expect(comparedRange('month', '2026-10-18')).toEqual({
      current: { from: '2026-10-01', to: '2026-10-18' },
      previous: { from: '2026-09-01', to: '2026-09-18' },
    });
  });

  it('31 de marzo se compara con todo febrero (mes más corto)', () => {
    expect(comparedRange('month', '2026-03-31').previous).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('enero se compara con diciembre del año anterior', () => {
    expect(comparedRange('month', '2027-01-15').previous).toEqual({ from: '2026-12-01', to: '2026-12-15' });
  });
});

describe('entrada datetime-local', () => {
  it('convierte hora local a UTC', () => {
    expect(localInputToIso('2026-10-05T22:30')).toBe('2026-10-06T01:30:00.000Z');
  });
  it('rechaza fechas inválidas', () => {
    expect(localInputToIso('2026-02-30T10:00')).toBeNull();
    expect(localInputToIso('no es fecha')).toBeNull();
    expect(localInputToIso('')).toBeNull();
  });
  it('dayKey usa la fecha local', () => {
    expect(dayKey(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01');
  });
});
