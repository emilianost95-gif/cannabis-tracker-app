/** Estado de la bienvenida (solo una marca en localStorage, sin datos personales). */
export const ONBOARDED_KEY = 'fumometro-onboarded';

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return true; // sin localStorage no insistimos en cada visita
  }
}
export function markOnboarded() {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // ignorar
  }
}

