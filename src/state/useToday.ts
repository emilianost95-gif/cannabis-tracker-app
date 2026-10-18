import { useEffect, useState } from 'react';
import { dayKey, type DayKey } from '@/utils/dates';

/** Día local actual; se actualiza al volver a la pestaña y cada minuto (cambio de día). */
export function useToday(): DayKey {
  const [today, setToday] = useState(() => dayKey(new Date()));
  useEffect(() => {
    const update = () => setToday(dayKey(new Date()));
    const timer = setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return today;
}
