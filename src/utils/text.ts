/** Minúsculas sin tildes, para búsquedas tolerantes. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
