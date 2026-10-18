import { useState } from 'react';
import { Repeat2 } from 'lucide-react';
import { useData } from '@/state/DataContext';
import { storageErrorMessage, useToast } from '@/components/Toast';
import { Button } from '@/components/ui';
import { ConfirmDialog } from '@/components/Dialog';
import { DUPLICATE_WINDOW_MS, buildRepeatEntry, lastEntry } from '@/domain/entries';
import type { ConsumptionEntry } from '@/domain/model';
import { formatQuantity, formatTime, t } from '@/i18n';
import { newId } from '@/utils/id';

function describeRepeat(e: ConsumptionEntry): string {
  return [t.methods[e.method], e.quantity ? formatQuantity(e.quantity) : null, e.strain].filter(Boolean).join(' · ');
}

/** «Repetir la última»: un toque para anotar otra sesión igual, con deshacer. */
export function QuickRepeat() {
  const { data, save, remove } = useData();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const last = lastEntry(data.consumption);
  if (!last) return null;
  const recent = Date.now() - Date.parse(last.occurredAt) < DUPLICATE_WINDOW_MS;

  async function repeat() {
    if (!last) return;
    setBusy(true);
    try {
      const entry = buildRepeatEntry(last, data.preferences.referencePrices, new Date(), newId());
      await save('consumption', entry);
      toast(`Anotado: ${describeRepeat(entry)}`, 'success', {
        label: 'Deshacer',
        onClick: () => {
          remove('consumption', entry.id)
            .then(() => toast('Listo, se deshizo'))
            .catch((err) => toast(storageErrorMessage(err), 'error'));
        },
      });
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 py-2">
      <span className="min-w-0 text-xs text-fg-muted">
        Última: <span className="text-fg">{describeRepeat(last)}</span>
      </span>
      <Button size="sm" icon={Repeat2} disabled={busy} onClick={() => (recent ? setConfirm(true) : void repeat())}>
        Repetir la última
      </Button>
      <ConfirmDialog
        open={confirm}
        title="¿Anotar otra igual?"
        confirmLabel="Sí, anotar otra"
        danger={false}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void repeat()}
      >
        Ya anotaste una a las {formatTime(last.occurredAt)}. Si es otra sesión, anotala igual.
      </ConfirmDialog>
    </div>
  );
}
