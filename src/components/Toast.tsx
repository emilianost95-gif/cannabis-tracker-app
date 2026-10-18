import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { cx } from './ui';

type Tone = 'success' | 'error';
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
}

const Ctx = createContext<((message: string, tone?: Tone) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message: string, tone: Tone = 'success') => {
      const id = next.current++;
      setItems((xs) => [...xs.slice(-2), { id, tone, message }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 3500);
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+0.75rem)] z-[60] flex flex-col items-center gap-2 px-3 lg:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cx(
              'animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-[var(--radius-md)] border bg-surface-3 px-3 py-2.5 text-sm text-fg shadow-[var(--shadow-pop)]',
              t.tone === 'error' ? 'border-[rgb(255_138_128/0.4)]' : 'border-border-strong',
            )}
          >
            {t.tone === 'error' ? (
              <CircleAlert aria-hidden size={18} className="mt-0.5 shrink-0 text-danger" />
            ) : (
              <CircleCheck aria-hidden size={18} className="mt-0.5 shrink-0 text-accent" />
            )}
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-m-1 rounded p-1 text-fg-subtle hover:text-fg"
              aria-label="Cerrar aviso"
            >
              <X aria-hidden size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast debe usarse dentro de ToastProvider');
  return v;
}

/** Mensaje legible para errores de almacenamiento (sin datos del registro). */
export function storageErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'QuotaExceededError') return 'No hay espacio de almacenamiento disponible en este dispositivo.';
  if (name === 'InvalidStateError') return 'El almacenamiento local se cerró. Recargá la página e intentá de nuevo.';
  return `No se pudo guardar en el almacenamiento local${name ? ` (${name})` : ''}. Intentá de nuevo.`;
}
