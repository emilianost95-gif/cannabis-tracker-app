import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles/index.css';
import { AppRoutes } from './app/App';
import { DataProvider } from './state/DataContext';
import { ToastProvider } from './components/Toast';
import { registerServiceWorker } from './app/pwa';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Rutas con hash: funcionan en cualquier hosting estático sin reglas de reescritura. */}
    <HashRouter>
      <ToastProvider>
        <DataProvider>
          <AppRoutes />
        </DataProvider>
      </ToastProvider>
    </HashRouter>
  </StrictMode>,
);

registerServiceWorker();
