import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileQuestion, Pencil, Trash2 } from 'lucide-react';
import { useData } from '@/state/DataContext';
import { storageErrorMessage, useToast } from '@/components/Toast';
import { Button, EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { ConfirmDialog } from '@/components/Dialog';
import { capitalize, formatDateTime, formatMoneyObj, formatQuantity, t } from '@/i18n';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 px-4 py-3 sm:grid-cols-[12rem_1fr]">
      <dt className="text-sm text-fg-subtle">{label}</dt>
      <dd className="text-sm text-fg">{children}</dd>
    </div>
  );
}

const Unknown = () => <span className="text-fg-subtle">Sin dato</span>;

function scaleText(v: number | null, labels: readonly string[]) {
  return v === null ? <Unknown /> : <span className="num">{`${v} de 5 · ${labels[v - 1]}`}</span>;
}

export function EntryDetailPage() {
  const { id } = useParams();
  const { data, remove } = useData();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const e = data.consumption.find((x) => x.id === id);

  if (!e) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Este registro no existe"
        action={
          <LinkButton to="/historial" variant="primary">
            Ir al historial
          </LinkButton>
        }
      >
        Puede que se haya eliminado.
      </EmptyState>
    );
  }

  async function onDelete() {
    setBusy(true);
    try {
      await remove('consumption', e!.id);
      toast('Registro eliminado');
      navigate('/historial');
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t.methods[e.method]}
        description={capitalize(formatDateTime(e.occurredAt))}
        actions={
          <>
            <LinkButton to="/historial" variant="ghost" icon={ArrowLeft} size="sm">
              Historial
            </LinkButton>
            <LinkButton to={`/registrar/${e.id}`} icon={Pencil} size="sm">
              Editar
            </LinkButton>
            <Button variant="danger" icon={Trash2} size="sm" onClick={() => setConfirm(true)}>
              Eliminar
            </Button>
          </>
        }
      />
      <dl className="card divide-y divide-border">
        <Row label="Cantidad">{e.quantity ? <span className="num">{formatQuantity(e.quantity)}</span> : <Unknown />}</Row>
        <Row label="Contexto">{e.context ? t.contexts[e.context] : <Unknown />}</Row>
        <Row label="Ánimo antes">{scaleText(e.moodBefore, t.scales.mood)}</Row>
        <Row label="Sueño previo">{scaleText(e.sleepQuality, t.scales.sleep)}</Row>
        <Row label="Estrés">{scaleText(e.stress, t.scales.stress)}</Row>
        <Row label="Gasto">
          {e.cost ? (
            <span className="num">
              {formatMoneyObj(e.cost)}{' '}
              <span className="text-fg-subtle">{e.cost.kind === 'paid' ? '· pagado en el momento' : '· valor estimado (no suma al gasto real)'}</span>
            </span>
          ) : (
            <Unknown />
          )}
        </Row>
        <Row label="Notas">{e.notes ? <p className="whitespace-pre-wrap break-words">{e.notes}</p> : <Unknown />}</Row>
        <Row label="Última modificación">
          <span className="text-fg-muted">{formatDateTime(e.updatedAt)}</span>
        </Row>
      </dl>
      <ConfirmDialog
        open={confirm}
        title="¿Eliminar este registro?"
        confirmLabel="Eliminar registro"
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void onDelete()}
      >
        Se borrará de este dispositivo y las estadísticas se recalcularán. No se puede deshacer.
      </ConfirmDialog>
    </>
  );
}
