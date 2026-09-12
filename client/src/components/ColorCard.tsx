import { Color, COLOR_META } from '../types';
import { formatCoins } from '../utils/format';

export default function ColorCard({ color, total, selected, onSelect, disabled }: { color: Color; total:number; selected?:boolean; onSelect:()=>void; disabled?:boolean }) {
  const meta = COLOR_META[color];
  const intensity = Math.min(100, (total / 3000) * 100);
  return (
    <div className={`group relative overflow-hidden rounded-[1.25rem] p-[1.5px] transition-all duration-300 ${selected ? 'scale-[1.02] shadow-glow-violet' : 'hover:scale-[1.01]'} ${disabled ? 'opacity-70' : ''} ${selected ? 'bg-white/20' : 'bg-white/[0.07] hover:bg-white/[0.12]'}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-0 group-hover:opacity-20 transition-opacity ${selected ? '!opacity-30' : ''}`} />
      <div className={`relative h-full bg-[#13131f] rounded-[1.15rem] p-3 sm:p-3.5 flex flex-col gap-3 overflow-hidden ${selected ? 'ring-1 ring-white/20' : ''}`}>
        {selected && <div className={`absolute -top-6 -right-6 w-16 h-16 bg-gradient-to-br ${meta.gradient} opacity-20 blur-2xl`} />}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className={`w-8 h-8 shrink-0 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-[16px] shadow-sm`}>{meta.emoji}</div>
            <div className="flex flex-col leading-none min-w-0">
              <span className="font-display font-bold tracking-[0.1em] sm:tracking-[0.14em] text-[11px] sm:text-[12px] truncate">{color}</span>
              <span className="text-[10px] font-semibold tracking-widest text-white/40">CHROMA</span>
            </div>
          </div>
          {selected ? (
            <span className="shrink-0 text-[9px] sm:text-[10px] font-black tracking-widest px-1.5 sm:px-2 py-1 rounded-full bg-white text-black shadow">SELECTED</span>
          ) : (
            <span className={`shrink-0 w-2 h-2 rounded-full bg-gradient-to-br ${meta.gradient} shadow-sm opacity-80`} />
          )}
        </div>

        <div className="mt-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-bold tracking-[0.14em] text-white/40">TOTAL POT</span>
            <span className="text-[10px] font-mono font-bold text-white/30">{intensity.toFixed(0)}%</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 min-w-0">
            <span className="text-base sm:text-[18px] font-black font-mono tracking-tight truncate">{formatCoins(total)}</span>
            <span className="text-[10px] font-bold tracking-widest text-white/30 shrink-0">COINS</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] border border-white/[0.03] overflow-hidden p-0.5">
            <div className={`h-full rounded-full bg-gradient-to-r ${meta.gradient} transition-all duration-700 ease-out`} style={{ width: `${Math.min(100, Math.max(6, intensity))}%` }} />
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-white/30">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> Live • lowest wins
          </div>
        </div>

        <button
          onClick={onSelect}
          disabled={disabled}
          className={`mt-auto w-full py-2.5 min-h-[44px] rounded-xl font-black tracking-[0.12em] text-[12px] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${selected ? 'bg-white text-black shadow hover:bg-zinc-50' : `bg-gradient-to-r ${meta.gradient} text-white shadow hover:opacity-95 hover:shadow-md`}`}>
          {selected ? 'CHANGE PICK' : 'BET NOW'}
        </button>
      </div>
    </div>
  );
}
