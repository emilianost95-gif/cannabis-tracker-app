/**
 * Recordatorio diario como evento de calendario (.ics, RFC 5545).
 *
 * Sin servidor no se pueden enviar notificaciones push confiables (y en
 * iPhone solo funcionan con la app instalada). Un evento recurrente en el
 * calendario del teléfono avisa siempre, a la hora elegida, sin compartir
 * ningún dato: el archivo solo contiene el título y el link a la app.
 */

export interface ReminderOptions {
  /** Hora local "HH:MM". */
  time: string;
  /** Título neutro para que nadie vea de qué se trata en la pantalla bloqueada. */
  discreet: boolean;
  appUrl: string;
  now?: Date;
  uid?: string;
}

export const REMINDER_TITLES = {
  normal: 'Anotar en el Fumómetro',
  discreet: 'Revisar mi bitácora',
} as const;

/** Escapa texto según RFC 5545 (barra, punto y coma, coma y saltos de línea). */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

const pad = (n: number) => String(n).padStart(2, '0');
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export function parseTime(time: string): { h: number; m: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
}

export function buildDailyReminderIcs(o: ReminderOptions): string {
  const t = parseTime(o.time);
  if (!t) throw new Error('Hora inválida');
  const now = o.now ?? new Date();
  // Primera ocurrencia: hoy a esa hora si todavía no pasó; si no, mañana. Hora "flotante" (local del teléfono).
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), t.h, t.m);
  if (first.getTime() <= now.getTime()) first.setDate(first.getDate() + 1);
  const dtstart = `${first.getFullYear()}${pad(first.getMonth() + 1)}${pad(first.getDate())}T${pad(t.h)}${pad(t.m)}00`;
  const title = o.discreet ? REMINDER_TITLES.discreet : REMINDER_TITLES.normal;
  const desc = o.discreet ? '' : 'Un minuto para anotar tus sesiones o cómo estás.';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fumometro//Recordatorio//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${o.uid ?? `${now.getTime()}-${Math.random().toString(36).slice(2)}`}@fumometro`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${dtstart}`,
    'DURATION:PT5M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${icsEscape(title)}`,
    ...(desc ? [`DESCRIPTION:${icsEscape(desc)}`] : []),
    `URL:${o.appUrl}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

// ---------- Aviso dentro de la app ----------

const NUDGE_KEY = 'fumometro-nudge-dismissed';

/** ¿Mostrar el aviso de la noche? Desde las 19 h, si hoy no hubo registro personal y no se descartó hoy. */
export function shouldNudge(now: Date, today: string, hasCheckinToday: boolean): boolean {
  if (hasCheckinToday || now.getHours() < 19) return false;
  try {
    return localStorage.getItem(NUDGE_KEY) !== today;
  } catch {
    return true;
  }
}

export function dismissNudge(today: string): void {
  try {
    localStorage.setItem(NUDGE_KEY, today);
  } catch {
    // sin localStorage el aviso vuelve a aparecer: inofensivo
  }
}
