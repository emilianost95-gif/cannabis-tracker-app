/**
 * Dinero en unidades menores enteras. Nunca se convierte entre monedas:
 * los totales se agrupan por moneda.
 */
import { MAX_AMOUNT_MINOR, type Currency, type Money } from './model';

/** Decimales de cada moneda (ISO 4217). CLP no usa decimales. */
export const MINOR_DIGITS: Record<Currency, number> = {
  CLP: 0,
  ARS: 2,
  USD: 2,
  EUR: 2,
  MXN: 2,
  UYU: 2,
  COP: 2,
  PEN: 2,
  BRL: 2,
};

/** Totales por moneda. */
export type MoneyTotals = Partial<Record<Currency, number>>;

export function addToTotals(totals: MoneyTotals, m: Money): MoneyTotals {
  totals[m.currency] = (totals[m.currency] ?? 0) + m.amountMinor;
  return totals;
}

export function sumMoney(items: Money[]): MoneyTotals {
  return items.reduce<MoneyTotals>((acc, m) => addToTotals(acc, m), {});
}

export function totalIn(totals: MoneyTotals, c: Currency): number {
  return totals[c] ?? 0;
}

/** Monedas presentes distintas de la preferida (para avisar sin convertir). */
export function otherCurrencies(totals: MoneyTotals, preferred: Currency): Currency[] {
  return (Object.keys(totals) as Currency[]).filter((c) => c !== preferred && (totals[c] ?? 0) > 0);
}

export type ParseMoneyResult = { ok: true; amountMinor: number } | { ok: false; error: string };

/**
 * Interpreta lo que escribe una persona en Chile o Argentina:
 * "12.500" → 12 500; "12.500,50" → 12 500,50; "1500,5" → 1 500,50.
 * Con un solo punto seguido de 1–2 dígitos se interpreta como decimal ("10.5").
 * Para monedas sin decimales (CLP) se rechazan decimales distintos de cero.
 */
export function parseMoneyInput(raw: string, c: Currency): ParseMoneyResult {
  const s = raw.replace(/[\s$]/g, '').replace(/^(CLP|ARS|USD|EUR|MXN|UYU|COP|PEN|BRL)/i, '');
  if (s === '') return { ok: false, error: 'Ingresá un importe' };
  if (!/^[\d.,]+$/.test(s)) return { ok: false, error: 'Usá solo números, puntos y comas' };

  let intPart: string;
  let decPart = '';
  const lastComma = s.lastIndexOf(',');
  if (lastComma >= 0) {
    if (s.indexOf(',') !== lastComma) return { ok: false, error: 'Formato de importe inválido' };
    intPart = s.slice(0, lastComma).replace(/\./g, '');
    decPart = s.slice(lastComma + 1);
  } else {
    const dots = s.split('.');
    const last = dots[dots.length - 1] ?? '';
    if (dots.length === 2 && last.length >= 1 && last.length <= 2) {
      intPart = dots[0] ?? '';
      decPart = last;
    } else {
      if (dots.slice(1).some((g) => g.length !== 3)) return { ok: false, error: 'Formato de importe inválido' };
      intPart = dots.join('');
    }
  }
  if (intPart === '' && decPart === '') return { ok: false, error: 'Formato de importe inválido' };
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart)) return { ok: false, error: 'Formato de importe inválido' };

  const digits = MINOR_DIGITS[c];
  if (decPart.length > Math.max(digits, 0)) {
    if (/^0*$/.test(decPart)) decPart = '';
    else return { ok: false, error: digits === 0 ? `${c} no usa decimales` : `Máximo ${digits} decimales` };
  }
  const minorStr = (intPart || '0') + decPart.padEnd(digits, '0');
  const amountMinor = Number(minorStr);
  if (!Number.isSafeInteger(amountMinor) || amountMinor > MAX_AMOUNT_MINOR) {
    return { ok: false, error: 'El importe es demasiado alto' };
  }
  return { ok: true, amountMinor };
}

/** Representación editable (sin separador de miles) de un importe. */
export function minorToInput(amountMinor: number, c: Currency): string {
  const digits = MINOR_DIGITS[c];
  if (digits === 0) return String(amountMinor);
  const neg = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const s = String(abs).padStart(digits + 1, '0');
  const out = `${s.slice(0, -digits)},${s.slice(-digits)}`.replace(/,0+$/, '');
  return neg ? `-${out}` : out;
}

/**
 * Multiplica un precio por una fracción (cantidad / cantidad de referencia)
 * redondeando a la unidad menor (half-up). Opera con enteros para evitar
 * errores de coma flotante: las cantidades se llevan a milésimas.
 */
export function prorate(priceMinor: number, quantity: number, perQuantity: number): number {
  const q = Math.round(quantity * 1000);
  const per = Math.round(perQuantity * 1000);
  if (per <= 0) throw new Error('perQuantity debe ser positivo');
  const num = BigInt(priceMinor) * BigInt(q);
  const den = BigInt(per);
  const res = (num * 2n + den) / (2n * den);
  return Number(res);
}
