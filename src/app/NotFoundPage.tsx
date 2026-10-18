import { Compass } from 'lucide-react';
import { EmptyState, LinkButton } from '@/components/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="No encontramos esta pantalla"
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
