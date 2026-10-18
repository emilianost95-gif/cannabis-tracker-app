import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom no implementa ResizeObserver (lo usa Recharts).
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver ??= RO;

afterEach(() => cleanup());

// jsdom no implementa scrollTo.
window.scrollTo = (() => undefined) as typeof window.scrollTo;
