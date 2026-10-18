import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom no implementa ResizeObserver (lo usa Recharts).
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver ??= RO;

afterEach(() => cleanup());

// La bienvenida se prueba aparte; en el resto de las pruebas se da por vista.
beforeEach(() => {
  localStorage.setItem('fumometro-onboarded', '1');
  localStorage.removeItem('fumometro-mode');
});

// jsdom no implementa scrollTo.
window.scrollTo = (() => undefined) as typeof window.scrollTo;
