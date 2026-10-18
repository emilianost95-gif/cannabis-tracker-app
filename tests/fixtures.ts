/**
 * DATOS DE PRUEBA. Solo para tests; nunca se cargan en la aplicación.
 * Las fechas se expresan en hora local (TZ de las pruebas: America/Santiago).
 */
import {
  SCHEMA_VERSION,
  defaultPreferences,
  type AppData,
  type ConsumptionEntry,
  type ExpenseEntry,
  type MoodCheckIn,
  type PersonalGoal,
} from '@/domain/model';

let seq = 0;
const testId = () => `test-${String(++seq).padStart(8, '0')}`;
const STAMP = '2026-01-01T12:00:00.000Z';

/** "2026-10-05 21:30" en hora local → ISO UTC */
export function local(dt: string): string {
  const [d, t = '12:00'] = dt.split(' ');
  const [y, m, day] = d!.split('-').map(Number) as [number, number, number];
  const [h, mi] = t.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, day, h, mi).toISOString();
}

export function testEntry(at: string, over: Partial<ConsumptionEntry> = {}): ConsumptionEntry {
  return {
    id: testId(),
    schemaVersion: SCHEMA_VERSION,
    occurredAt: local(at),
    method: 'flower_smoked',
    quantity: null,
    context: null,
    moodBefore: null,
    sleepQuality: null,
    stress: null,
    cost: null,
    notes: '',
    createdAt: STAMP,
    updatedAt: STAMP,
    ...over,
  };
}

export function testCheckin(at: string, over: Partial<MoodCheckIn> = {}): MoodCheckIn {
  return {
    id: testId(),
    schemaVersion: SCHEMA_VERSION,
    occurredAt: local(at),
    mood: null,
    stress: null,
    sleep: null,
    craving: null,
    reason: null,
    notes: '',
    createdAt: STAMP,
    updatedAt: STAMP,
    ...over,
  };
}

export function testExpense(date: string, amountMinor: number, over: Partial<ExpenseEntry> = {}): ExpenseEntry {
  return {
    id: testId(),
    schemaVersion: SCHEMA_VERSION,
    date,
    amount: { amountMinor, currency: 'CLP' },
    category: 'product',
    quantity: null,
    notes: '',
    createdAt: STAMP,
    updatedAt: STAMP,
    ...over,
  };
}

export function testGoal(over: Partial<PersonalGoal> & Pick<PersonalGoal, 'target'>): PersonalGoal {
  return {
    id: testId(),
    schemaVersion: SCHEMA_VERSION,
    title: 'Objetivo de prueba',
    startDate: '2026-10-05',
    endDate: null,
    status: 'active',
    pausedIntervals: [],
    createdAt: STAMP,
    updatedAt: STAMP,
    ...over,
  };
}

export function testData(over: Partial<AppData> = {}): AppData {
  return {
    preferences: defaultPreferences(new Date(STAMP)),
    consumption: [],
    checkins: [],
    expenses: [],
    goals: [],
    ...over,
  };
}
