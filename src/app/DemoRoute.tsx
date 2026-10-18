import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/state/DataContext';
import { Spinner } from '@/components/ui';

/** Link para compartir: /#/demo abre la app con datos de ejemplo. */
export function DemoRoute() {
  const { enterDemo } = useData();
  const navigate = useNavigate();
  useEffect(() => {
    void enterDemo().then(() => navigate('/', { replace: true }));
  }, [enterDemo, navigate]);
  return <Spinner label="Preparando la demo" />;
}
