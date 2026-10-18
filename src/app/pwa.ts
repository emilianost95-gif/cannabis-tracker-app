/**
 * Registro del service worker (solo en producción). Permite usar la app sin
 * conexión e instalarla desde el navegador cuando este lo ofrece.
 * El service worker solo cachea archivos de la app; nunca datos personales.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      // Sin service worker la app sigue funcionando en línea.
    });
}
