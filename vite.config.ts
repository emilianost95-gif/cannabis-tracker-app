/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Las pruebas fijan una zona horaria con horario de verano (Chile) para
// ejercitar los límites de día y los cambios de hora de forma reproducible.
process.env.TZ ??= 'America/Santiago';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Fumómetro',
        short_name: 'Fumómetro',
        description: 'Medí cuánto, cuándo y cuánta plata se va en humo. Privado y sin cuenta.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b0c0e',
        theme_color: '#0b0c0e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    // La carpeta puede estar bajo una ruta virtualizada de Windows (MSIX); evita resolver a la ruta real.
    preserveSymlinks: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/recharts|d3-|victory-vendor|redux|immer|reselect/.test(id)) return 'charts';
          // Rutas con "/" o "\" (Windows).
          if (/react-router|react-dom|scheduler|[\\/]react[\\/]/.test(id)) return 'react';
          return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
    css: false,
    testTimeout: 20000,
  },
});
