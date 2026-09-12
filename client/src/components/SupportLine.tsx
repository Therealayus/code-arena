import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

/** Telegram support link set by the admin (for manual password resets). Renders nothing if unset. */
export function useSupportTelegram(): string | null {
  const { data } = useQuery({
    queryKey: ['supportContact'],
    queryFn: async () => (await api.get('/support')).data,
    staleTime: 60000,
  });
  return (data as any)?.telegram || null;
}

export function SupportLine() {
  const telegram = useSupportTelegram();
  if (!telegram) return null;
  return (
    <div className="text-sm text-center text-white/60">
      Locked out?{' '}
      <a href={telegram} target="_blank" rel="noreferrer" className="text-violet-300 hover:text-violet-200 font-semibold underline decoration-violet-500/30">
        Contact admin on Telegram →
      </a>
    </div>
  );
}
