import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FlaskConical, ShieldCheck } from 'lucide-react';
import { useData } from '@/state/DataContext';
import { useToast, storageErrorMessage } from '@/components/Toast';
import { Button, Segmented, cx } from '@/components/ui';
import { Humito, LogoMark, type HumitoMood } from '@/components/brand';
import type { Currency } from '@/domain/model';
import { markOnboarded } from './onboardingState';

const STEPS: { mood: HumitoMood; title: string; body: string }[] = [
  {
    mood: 'happy',
    title: 'Bienvenido al Fumómetro',
    body: 'Anotá cada sesión en segundos y mirá tus patrones: cuánto, cuándo, por qué y cuánta plata se va en humo. Sin vueltas.',
  },
  {
    mood: 'chill',
    title: 'Lo tuyo queda acá',
    body: 'Sin cuenta, sin servidor, sin publicidad. Tus datos se guardan solo en este dispositivo. Y nadie te juzga: ni siquiera Humito.',
  },
  {
    mood: 'curious',
    title: '¿Cómo arrancamos?',
    body: 'Contame un par de cosas (opcional) o mirá primero la demo con datos de ejemplo.',
  },
];

/** Bienvenida de 3 pasos. Aparece una sola vez, en el primer uso sin datos. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { data, savePreferences, enterDemo } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>(data.preferences.currency);
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const s = STEPS[step]!;

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const finish = () => {
    markOnboarded();
    onDone();
  };

  async function start() {
    try {
      await savePreferences({ ...data.preferences, displayName: name.trim().slice(0, 40), currency, updatedAt: new Date().toISOString() });
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
    }
    finish();
    navigate('/registrar');
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-bg/95 backdrop-blur" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-8 pt-6">
        <div className="flex items-center justify-between">
          <LogoMark className="size-9" />
          <Button variant="ghost" size="sm" onClick={finish}>
            Saltar
          </Button>
        </div>

        <div key={step} className="animate-rise flex flex-1 flex-col items-center justify-center py-8 text-center">
          <Humito mood={s.mood} className="w-44" />
          <h1 id={titleId} ref={headingRef} tabIndex={-1} className="mt-6 font-display text-3xl font-semibold tracking-tight outline-none">
            {s.title}
          </h1>
          <p className="mt-3 text-fg-muted">{s.body}</p>
          {step === 1 && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-fg-muted">
              <ShieldCheck aria-hidden size={14} className="text-accent" /> Podés exportar o borrar todo cuando quieras
            </p>
          )}
          {step === 2 && (
            <div className="mt-6 grid w-full gap-4 text-left">
              <label className="grid gap-1.5 text-sm font-medium">
                <span>
                  ¿Cómo te llamo? <span className="font-normal text-fg-subtle">(opcional)</span>
                </span>
                <input className="field-input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
              </label>
              <Segmented
                legend="Moneda"
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: 'CLP', label: 'Pesos chilenos' },
                  { value: 'ARS', label: 'Pesos argentinos' },
                  { value: 'USD', label: 'Dólares' },
                ]}
              />
            </div>
          )}
        </div>

        <div className="mb-5 flex justify-center gap-2" aria-label={`Paso ${step + 1} de ${STEPS.length}`} role="img">
          {STEPS.map((_, i) => (
            <span key={i} className={cx('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-accent' : 'w-1.5 bg-border-strong')} />
          ))}
        </div>

        {step < STEPS.length - 1 ? (
          <Button variant="primary" icon={ArrowRight} onClick={() => setStep((x) => x + 1)}>
            Siguiente
          </Button>
        ) : (
          <div className="grid gap-2">
            <Button variant="primary" onClick={() => void start()}>
              Anotar mi primera sesión
            </Button>
            <Button
              icon={FlaskConical}
              onClick={() => {
                finish();
                void enterDemo();
              }}
            >
              Ver la demo primero
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
