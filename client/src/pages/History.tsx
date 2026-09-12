import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { GameRound, COLOR_META, COLORS } from '../types';
import { formatCoins } from '../utils/format';
import { useState } from 'react';

export default function History() {
  const [page,setPage]=useState(1);
  const { data, isLoading } = useQuery({
    queryKey:['history',page],
    queryFn: async()=> (await api.get(`/game/history?limit=10&page=${page}`)).data,
  });

  if (isLoading) return <div className="p-10 text-center text-white/60">Loading history...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="rounded-[1.5rem] bg-gradient-to-br from-[#13131f] to-[#1a1a2e] border border-white/10 p-4 sm:p-6 lg:p-7 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_300px_at_20%_-10%,rgba(124,58,237,0.12),transparent_60%)] pointer-events-none" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-[11px] font-black tracking-[0.14em] text-white/70">ARCHIVE • VERIFIABLE</div>
            <h1 className="font-display font-black tracking-tight text-2xl sm:text-3xl mt-3">Game <span className="text-gradient-violet">History</span></h1>
            <p className="text-white/60 text-sm mt-1.5 max-w-xl">Every round is verifiable — winner is lowest total, deterministic tie-break <span className="text-white font-semibold">RED › GREEN › BLUE</span></p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 font-bold">2.0x SINGLES • 1.5x COMBOS</span>
            <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 font-bold">VIRTUAL COINS</span>
          </div>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-2 text-[11px] font-bold tracking-widest text-white/30">
        <span className="w-6 h-[1px] bg-white/10" /> RECENT ROUNDS • LOWEST WINS</div>
      <div className="mt-6 space-y-3">
        {data?.items?.map((r: GameRound)=> (
          <div key={r._id} className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <span className="font-mono text-sm px-2.5 py-1 rounded-full bg-white/10 border border-white/10 shrink-0">#{r.roundNumber}</span>
                <span className="text-xs sm:text-sm text-white/60 break-words">{new Date(r.resultTime || r.startTime).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">Winner</span>
                <span className={`px-3 py-1 rounded-full text-sm font-black bg-gradient-to-r ${r.winningColor && (COLOR_META as any)[r.winningColor] ? (COLOR_META as any)[r.winningColor].gradient : 'from-zinc-600 to-zinc-700'} text-white`}>
                  {r.winningColor ? `${(COLOR_META as any)[r.winningColor]?.emoji || ''} ${(r.winningColor as string).replace('_', ' + ')}` : '—'}
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {COLORS.map(c=> {
                const tot = (r.colorTotals as any)?.[c] ?? 0;
                const isWin = r.winningColor===c;
                const isPartOfCombo = ((r.winningColor as string) || '').split('_').includes(c);
                return (
                  <div key={c} className={`p-3 rounded-xl border text-center min-w-0 ${isWin || isPartOfCombo ? 'bg-emerald-500/20 border-emerald-500/30 ring-1 ring-emerald-500/20' : 'bg-black/20 border-white/5'}`}>
                    <div className="text-xs font-bold tracking-widest truncate">{COLOR_META[c].emoji} {c}</div>
                    <div className="mt-1 font-mono font-bold truncate">{formatCoins(tot)}</div>
                    {(isWin || isPartOfCombo) && <div className="text-[10px] font-bold text-emerald-400 mt-1">WINNER</div>}
                  </div>
                );
              })}
            </div>
            {r.tieBreakReason && <div className="mt-3 text-xs p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 break-words">{r.tieBreakReason}</div>}
            <div className="mt-2 text-xs text-white/40">Total pot: {formatCoins(r.totalBetAmount)} • Bets: {r.totalBetsCount}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-center gap-2">
        <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-4 py-2 rounded-lg bg-white/10 disabled:opacity-30">Prev</button>
        <span className="text-sm text-white/60">Page {page} / {data?.pages || 1}</span>
        <button disabled={page>= (data?.pages||1)} onClick={()=>setPage(p=>p+1)} className="px-4 py-2 rounded-lg bg-white/10 disabled:opacity-30">Next</button>
      </div>
    </div>
  );
}
