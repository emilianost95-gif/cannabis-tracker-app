import { describe, expect, it } from 'vitest';
import { buildDailyReminderIcs, icsEscape, parseTime, shouldNudge, dismissNudge } from './reminders';

describe('recordatorio en calendario', () => {
  const base = { appUrl: 'https://fumometro.onrender.com/', uid: 'test-uid' };

  it('genera un evento diario a la hora local elegida', () => {
    const ics = buildDailyReminderIcs({ ...base, time: '21:30', discreet: false, now: new Date(2026, 9, 18, 12, 0) });
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('DTSTART:20261018T213000\r\n'); // hoy, todavía no pasó
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('SUMMARY:Anotar en el Fumómetro');
    expect(ics).toContain('UID:test-uid@fumometro');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('si la hora ya pasó, empieza mañana (también a fin de mes)', () => {
    const ics = buildDailyReminderIcs({ ...base, time: '09:00', discreet: false, now: new Date(2026, 9, 31, 22, 0) });
    expect(ics).toContain('DTSTART:20261101T090000');
  });

  it('modo discreto: título neutro y sin descripción', () => {
    const ics = buildDailyReminderIcs({ ...base, time: '21:30', discreet: true, now: new Date(2026, 9, 18, 12, 0) });
    expect(ics).toContain('SUMMARY:Revisar mi bitácora');
    expect(ics).not.toMatch(/Fumómetro|humo|sesion/i);
  });

  it('valida la hora y escapa texto', () => {
    expect(parseTime('7:30')).toBeNull();
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('23:59')).toEqual({ h: 23, m: 59 });
    expect(() => buildDailyReminderIcs({ ...base, time: 'xx', discreet: false })).toThrow();
    expect(icsEscape('a, b; c\nd')).toBe('a\\, b\\; c\\nd');
  });
});

describe('aviso de la noche', () => {
  it('aparece desde las 19 h si hoy no hubo registro personal, y se puede descartar por hoy', () => {
    localStorage.removeItem('fumometro-nudge-dismissed');
    expect(shouldNudge(new Date(2026, 9, 18, 18, 59), '2026-10-18', false)).toBe(false);
    expect(shouldNudge(new Date(2026, 9, 18, 20, 0), '2026-10-18', true)).toBe(false);
    expect(shouldNudge(new Date(2026, 9, 18, 20, 0), '2026-10-18', false)).toBe(true);
    dismissNudge('2026-10-18');
    expect(shouldNudge(new Date(2026, 9, 18, 21, 0), '2026-10-18', false)).toBe(false);
    expect(shouldNudge(new Date(2026, 9, 19, 21, 0), '2026-10-19', false)).toBe(true);
  });
});
