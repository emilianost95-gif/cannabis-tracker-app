import { format } from 'date-fns';
import { es as dateEs } from 'date-fns/locale';
import type { Currency, Money, Quantity, Unit } from '@/domain/model';
import { MINOR_DIGITS, type MoneyTotals } from '@/domain/money';
import { parseDayKey, type DayKey, type Period } from '@/utils/dates';
import { es } from './es';

/** Diccionario activo. Único punto a cambiar al incorporar otro idioma. */
export const t = es;
const dateLocale = dateEs;

export function formatMoney(amountMinor: number, c: Currency): string {
  const digits = MINOR_DIGITS[c];
  const value = amountMinor / 10 ** digits; // solo para mostrar; los cálculos usan enteros
  return new Intl.NumberFormat(t.locale, {
    style: 'currency',
    currency: c,
    minimumFractionDigits: digits === 0 ? 0 : amountMinor % 10 ** digits === 0 ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatMoneyObj(m: Money): string {
  return formatMoney(m.amountMinor, m.currency);
}

/** "$12.500 · US$ 10" — un importe por moneda, nunca convertidos entre sí. */
export function formatTotals(totals: MoneyTotals, preferred: Currency): string {
  const entries = (Object.entries(totals) as [Currency, number][]).filter(([, v]) => v > 0);
  if (entries.length === 0) return formatMoney(0, preferred);
  entries.sort(([a], [b]) => (a === preferred ? -1 : b === preferred ? 1 : a.localeCompare(b)));
  return entries.map(([c, v]) => formatMoney(v, c)).join(' · ');
}

export function formatNumber(n: number, maxDigits = 2): string {
  return new Intl.NumberFormat(t.locale, { maximumFractionDigits: maxDigits }).format(n);
}

export function formatQuantity(q: Quantity): string {
  return `${formatNumber(q.value, 3)} ${t.units[q.unit].short}`;
}

export function unitLabel(u: Unit): string {
  return t.units[u].short;
}

export function formatDay(key: DayKey, pattern = "EEEE d 'de' MMMM"): string {
  return format(parseDayKey(key), pattern, { locale: dateLocale });
}

export function formatShortDay(key: DayKey): string {
  return format(parseDayKey(key), 'd MMM', { locale: dateLocale });
}

export function formatDateTime(iso: string): string {
  return format(new Date(iso), "EEE d MMM yyyy, HH:mm", { locale: dateLocale });
}

export function formatTime(iso: string): string {
  return format(new Date(iso), 'HH:mm', { locale: dateLocale });
}

export function formatPeriod(p: Period): string {
  const a = parseDayKey(p.from);
  const b = parseDayKey(p.to);
  if (p.from === p.to) return format(a, 'd MMM yyyy', { locale: dateLocale });
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = format(a, sameYear ? 'd MMM' : 'd MMM yyyy', { locale: dateLocale });
  return `${left} – ${format(b, 'd MMM yyyy', { locale: dateLocale })}`;
}

export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
