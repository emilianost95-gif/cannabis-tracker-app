import { Compass } from 'lucide-react';
import { EmptyState, LinkButton } from '@/components/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      mood="curious"
      title="Acá no hay nada… ni humo"
      action={
        <LinkButton to="/" variant="primary">
          Volver al inicio
        </LinkButton>
      }
    >
      Puede que el registro se haya eliminado o que el enlace no exista.
    </EmptyState>
  );
}
