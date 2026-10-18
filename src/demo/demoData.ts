/**
 * DATOS DE EJEMPLO para el modo demo.
 *
 * Se generan de forma determinista (misma semilla → mismos datos) relativos a
 * la fecha actual, para que la demo siempre muestre las últimas 8 semanas.
 * Viven en una base de datos separada (`fumometro-demo`) y la interfaz los
 * marca como ejemplo en todo momento: nunca se mezclan con datos reales.
 *
 * La historia que cuentan: alguien que fumaba casi a diario, se propuso bajar
 * y lo va logrando de a poco, con altibajos.
 */
import {
  SCHEMA_VERSION,
  defaultPreferences,
  type AppData,
  type ConsumptionEntry,
  type Context,
  type ExpenseEntry,
  type Method,
  type MoodCheckIn,
  type PersonalGoal,
  type Quantity,
} from '@/domain/model';
import { addDaysKey, dayKey, parseDayKey, weekStartKey, type DayKey } from '@/utils/dates';

export const DEMO_WEEKS = 8;

/** PRNG pequeño y determinista (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [v, w] of items) {
    x -= w;
    if (x <= 0) return v;
  }
  return items[items.length - 1]![0];
}

function at(day: DayKey, hour: number, minute: number): string {
  const d = parseDayKey(day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

export function generateDemoData(now: Date = new Date(), seed = 420): AppData {
  const r = rng(seed);
  const today = dayKey(now);
  const start = addDaysKey(weekStartKey(today), -7 * (DEMO_WEEKS - 1));
  const stamp = now.toISOString();
  let n = 0;
  const id = (kind: string) => `demo-${kind}-${String(++n).padStart(5, '0')}`;

  const consumption: ConsumptionEntry[] = [];
  const checkins: MoodCheckIn[] = [];
  const expenses: ExpenseEntry[] = [];

  // Trayectoria semanal explícita (sesiones por semana): baja con altibajos.
  const WEEKLY = [10, 9, 10, 8, 7, 7, 5, 4];
  const sessionsPerDay = new Map<DayKey, number>();
  for (let w = 0; w < DEMO_WEEKS; w++) {
    const days = Array.from({ length: 7 }, (_, i) => addDaysKey(start, w * 7 + i));
    // Viernes y sábado pesan el doble; domingo, un poco más.
    const weight = (i: number) => (i === 4 || i === 5 ? 2 : i === 6 ? 1.5 : 1);
    let remaining = WEEKLY[w] ?? 4;
    let guard = 0;
    while (remaining > 0 && guard++ < 200) {
      const i = pick(r, days.map((_, k) => [k, weight(k)] as const));
      const d = days[i]!;
      if ((sessionsPerDay.get(d) ?? 0) >= 2) continue;
      sessionsPerDay.set(d, (sessionsPerDay.get(d) ?? 0) + 1);
      remaining--;
    }
  }

  for (let day = start; day <= today; day = addDaysKey(day, 1)) {
    const week = Math.floor((parseDayKey(day).getTime() - parseDayKey(start).getTime()) / (7 * 864e5));
    const progress = week / (DEMO_WEEKS - 1); // 0 → 1
    const weekday = parseDayKey(day).getDay(); // 0 domingo
    const weekend = weekday === 0 || weekday === 5 || weekday === 6;
    const sessions = sessionsPerDay.get(day) ?? 0;

    let consumedToday = false;
    for (let s = 0; s < sessions; s++) {
      // Hoy solo hasta la hora actual.
      const hour = weekend && s === 0 && r() < 0.35 ? 15 + Math.floor(r() * 4) : 19 + Math.floor(r() * 5);
      const minute = Math.floor(r() * 60);
      const occurredAt = at(day, hour % 24, minute);
      if (Date.parse(occurredAt) > now.getTime()) continue;

      const method: Method = pick(r, [
        ['flower_smoked', 70],
        ['flower_vaporized', 8],
        ['vape_cartridge', 14],
        ['edible', 8],
      ] as const);
      let quantity: Quantity | null = null;
      if (r() > 0.12) {
        if (method === 'vape_cartridge') quantity = { unit: 'puff', value: 4 + Math.floor(r() * 9) };
        else if (method === 'edible') quantity = { unit: 'piece', value: 1 };
        else quantity = { unit: 'g', value: Math.round((0.15 + r() * 0.35 - 0.08 * progress) * 20) / 20 };
      }
      const context: Context | null = pick(r, [
        ['relax', 30],
        ['social', weekend ? 30 : 10],
        ['stress', 14],
        ['sleep', 12],
        ['habit', 10],
        ['boredom', 8],
        ['creative', 5],
        [null, 6],
      ] as const);
      const stress = r() < 0.6 ? clamp(2.6 + (context === 'stress' ? 1.4 : 0) + (r() - 0.5) * 2, 1, 5) : null;
      consumption.push({
        id: id('s'),
        schemaVersion: SCHEMA_VERSION,
        occurredAt,
        method,
        quantity,
        context,
        moodBefore: r() < 0.55 ? clamp(3 + (r() - 0.5) * 2.4, 1, 5) : null,
        sleepQuality: r() < 0.4 ? clamp(3 + (r() - 0.5) * 2.4, 1, 5) : null,
        stress,
        cost:
          quantity?.unit === 'g'
            ? { kind: 'estimated', amountMinor: Math.round((quantity.value * 8000) / 10) * 10, currency: 'CLP' }
            : null,
        strain:
          method === 'edible'
            ? null
            : pick(r, [
                ['Amnesia', 30],
                ['Northern Lights', 22],
                ['Gelato', 18],
                ['Haze del amigo', 12],
                [null, 18],
              ] as const),
        effectRating: r() < 0.45 ? clamp(3.4 + (r() - 0.5) * 2.4, 1, 5) : null,
        notes: s === 0 && r() < 0.08 ? pick(r, [['Después del laburo', 1], ['Con amigos en la plaza', 1], ['Para bajar antes de dormir', 1]] as const) : '',
        createdAt: occurredAt,
        updatedAt: occurredAt,
      });
      consumedToday = true;
    }

    // Registro personal casi todos los días, a la mañana.
    const checkinAt = at(day, 9, Math.floor(r() * 50));
    if (r() < 0.75 && Date.parse(checkinAt) <= now.getTime()) {
      // Los días sin consumo el ánimo y el sueño mejoran levemente (asociación, no causa).
      const base = consumedToday ? 3 : 3.5;
      checkins.push({
        id: id('c'),
        schemaVersion: SCHEMA_VERSION,
        occurredAt: checkinAt,
        mood: clamp(base + (r() - 0.5) * 2, 1, 5),
        stress: clamp(3 - (consumedToday ? 0 : 0.3) + (r() - 0.5) * 2, 1, 5),
        sleep: clamp(base + (r() - 0.5) * 2, 1, 5),
        craving: clamp(2.2 - 1.2 * progress + (r() - 0.5) * 2, 0, 4),
        reason: null,
        notes: '',
        createdAt: checkinAt,
        updatedAt: checkinAt,
      });
    }

    // Compras: cada ~9 días al principio, cada ~14 al final.
    const every = Math.round(9 + 5 * progress);
    const dayIndex = Math.round((parseDayKey(day).getTime() - parseDayKey(start).getTime()) / 864e5);
    if (dayIndex % every === 2) {
      const grams = progress < 0.5 ? 5 : 3;
      expenses.push({
        id: id('e'),
        schemaVersion: SCHEMA_VERSION,
        date: day,
        amount: { amountMinor: grams * 8000, currency: 'CLP' },
        category: 'product',
        quantity: { unit: 'g', value: grams },
        notes: '',
        createdAt: stamp,
        updatedAt: stamp,
      });
      if (r() < 0.4) {
        expenses.push({
          id: id('e'),
          schemaVersion: SCHEMA_VERSION,
          date: day,
          amount: { amountMinor: 2500, currency: 'CLP' },
          category: 'accessory',
          quantity: null,
          notes: 'Papelillos y filtros',
          createdAt: stamp,
          updatedAt: stamp,
        });
      }
    }
  }

  const goal = (over: Pick<PersonalGoal, 'title' | 'startDate' | 'target'>): PersonalGoal => ({
    id: id('g'),
    schemaVersion: SCHEMA_VERSION,
    endDate: null,
    status: 'active',
    pausedIntervals: [],
    createdAt: stamp,
    updatedAt: stamp,
    ...over,
  });
  const goals: PersonalGoal[] = [
    goal({ title: 'Bajar a 5 por semana', startDate: addDaysKey(start, 21), target: { type: 'reduce_frequency', maxSessionsPerWeek: 5 } }),
    goal({ title: 'Dos días sin humo', startDate: addDaysKey(start, 28), target: { type: 'free_days', minFreeDaysPerWeek: 2 } }),
    goal({
      title: 'No pasar de 60 lucas al mes',
      startDate: addDaysKey(start, 14),
      target: { type: 'spending_limit', period: 'month', limit: { amountMinor: 60000, currency: 'CLP' } },
    }),
  ];

  const preferences = {
    ...defaultPreferences(now),
    displayName: '',
    currency: 'CLP' as const,
    referencePrices: [{ unit: 'g' as const, perQuantity: 1, price: { amountMinor: 8000, currency: 'CLP' as const } }],
    budgets: { weekly: { amountMinor: 15000, currency: 'CLP' as const }, monthly: { amountMinor: 60000, currency: 'CLP' as const } },
    nextAction: 'Entre semana, nada después de las 23 h.',
  };

  return { preferences, consumption, checkins, expenses, goals };
}
