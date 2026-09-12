export function formatCoins(n: number): string {
  return n.toLocaleString('en-IN');
}
export function formatMs(ms: number): string {
  if (ms <= 0) return '00:00';
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60).toString().padStart(2,'0');
  const sec = (s % 60).toString().padStart(2,'0');
  return `${m}:${sec}`;
}
