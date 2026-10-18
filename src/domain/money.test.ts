import { describe, expect, it } from 'vitest';
import { minorToInput, otherCurrencies, parseMoneyInput, prorate, sumMoney } from './money';
import { sumByUnit, addQuantities, IncompatibleUnitsError, parseQuantityInput, unitsPresent } from './quantity';

describe('parseMoneyInput', () => {
  const ok = (s: string, c: Parameters<typeof parseMoneyInput>[1]) => {
    const r = parseMoneyInput(s, c);
    if (!r.ok) throw new Error(r.error);
    return r.amountMinor;
  };

  it('CLP con separador de miles', () => {
    expect(ok('12.500', 'CLP')).toBe(12500);
    expect(ok('1.250.000', 'CLP')).toBe(1250000);
    expect(ok('$ 8000', 'CLP')).toBe(8000);
  });

  it('CLP rechaza decimales distintos de cero', () => {
    expect(parseMoneyInput('100,5', 'CLP').ok).toBe(false);
    expect(ok('100,00', 'CLP')).toBe(100);
  });

  it('ARS con decimales con coma', () => {
    expect(ok('12.500,50', 'ARS')).toBe(1250050);
    expect(ok('1500,5', 'ARS')).toBe(150050);
    expect(ok('15000', 'ARS')).toBe(1500000);
  });

  it('punto como decimal cuando es inequívoco', () => {
    expect(ok('10.5', 'USD')).toBe(1050);
    expect(ok('10.500', 'USD')).toBe(1050000); // tres dígitos = miles
  });

  it('rechaza entradas inválidas', () => {
    for (const s of ['', 'abc', '1,2,3', '12.50.0', '-5', '1e5']) expect(parseMoneyInput(s, 'ARS').ok).toBe(false);
    expect(parseMoneyInput('1,234', 'ARS').ok).toBe(false); // 3 decimales
  });

  it('rechaza importes absurdamente altos', () => {
    expect(parseMoneyInput('999999999999999', 'CLP').ok).toBe(false);
  });

  it('minorToInput es reversible', () => {
    expect(minorToInput(1250050, 'ARS')).toBe('12500,50');
    expect(minorToInput(1250000, 'ARS')).toBe('12500');
    expect(parseMoneyInput(minorToInput(1250050, 'ARS'), 'ARS')).toEqual({ ok: true, amountMinor: 1250050 });
    expect(minorToInput(12500, 'CLP')).toBe('12500');
    expect(minorToInput(5, 'USD')).toBe('0,05');
  });
});

describe('totales por moneda', () => {
  it('nunca suma monedas distintas', () => {
    const t = sumMoney([
      { amountMinor: 10000, currency: 'CLP' },
      { amountMinor: 5000, currency: 'CLP' },
      { amountMinor: 250000, currency: 'ARS' },
    ]);
    expect(t).toEqual({ CLP: 15000, ARS: 250000 });
    expect(otherCurrencies(t, 'CLP')).toEqual(['ARS']);
  });

  it('enteros: sin errores de coma flotante', () => {
    const t = sumMoney([
      { amountMinor: 10, currency: 'USD' },
      { amountMinor: 20, currency: 'USD' },
    ]);
    expect(t.USD).toBe(30);
  });
});

describe('prorate (estimación con precio de referencia)', () => {
  it('10.000 CLP por gramo × 0,3 g = 3.000', () => {
    expect(prorate(10000, 0.3, 1)).toBe(3000);
  });
  it('redondea a la unidad menor (half-up)', () => {
    expect(prorate(1000, 1, 3)).toBe(333);
    expect(prorate(1000, 2, 3)).toBe(667);
    expect(prorate(5, 1, 2)).toBe(3);
  });
  it('rechaza cantidad de referencia no positiva', () => {
    expect(() => prorate(100, 1, 0)).toThrow();
  });
});

describe('cantidades', () => {
  it('suma solo dentro de la misma unidad', () => {
    expect(
      sumByUnit([
        { value: 0.1, unit: 'g' },
        { value: 0.2, unit: 'g' },
        { value: 3, unit: 'puff' },
        null,
        { value: 10, unit: 'mg_thc' },
      ]),
    ).toEqual({ g: 0.3, puff: 3, mg_thc: 10 });
  });

  it('impide sumar unidades incompatibles', () => {
    expect(() => addQuantities({ value: 1, unit: 'g' }, { value: 2, unit: 'puff' })).toThrow(IncompatibleUnitsError);
    expect(addQuantities({ value: 0.1, unit: 'g' }, { value: 0.2, unit: 'g' })).toEqual({ value: 0.3, unit: 'g' });
  });

  it('lista unidades presentes en orden canónico', () => {
    expect(unitsPresent([{ value: 1, unit: 'puff' }, null, { value: 1, unit: 'g' }])).toEqual(['g', 'puff']);
  });

  it('parsea coma o punto decimal', () => {
    expect(parseQuantityInput('0,5')).toBe(0.5);
    expect(parseQuantityInput('1.25')).toBe(1.25);
    expect(parseQuantityInput('0')).toBeNull();
    expect(parseQuantityInput('-1')).toBeNull();
    expect(parseQuantityInput('abc')).toBeNull();
  });
});
