import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../store/auth';
import { Color, COLORS, COLOR_META, GameRound } from '../types';
import ColorCard from '../components/ColorCard';
import { formatCoins, formatMs } from '../utils/format';
import { PLATFORM_FEE_PERCENT, PAYOUT_RULES, calculatePayout } from '../utils/payout';
import { pushToast } from '../components/Toast';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

function getTotals(round: GameRound | undefined): Record<Color, number> {
  const totals: Record<Color, number> = { RED:0, GREEN:0, BLUE:0 };
  if (!round?.colorTotals) return totals;
  const ct: any = round.colorTotals;
  if (ct instanceof Map) {
    ct.forEach((v:any,k:string)=> totals[k as Color]=Number(v)||0);
  } else {
    COLORS.forEach(c=> totals[c]= Number(ct[c])||0);
  }
  return totals;
}

function resultEmoji(w: string): string {
  if (w === 'RED_BLUE') return '🔴+🔵';
  if (w === 'GREEN_BLUE') return '🟢+🔵';
  return (COLOR_META as any)[w]?.emoji || '❓';
}

function resultGradient(w: string): string {
  return (COLOR_META as any)[w]?.gradient || 'from-violet-500 to-indigo-500';
}

export default function Game() {
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Color | null>(null);
  const [amount, setAmount] = useState<number>(100);
  const [remainingMs, setRemainingMs] = useState<number>(60000);
  const [liveTotals, setLiveTotals] = useState<Record<Color, number> | null>(null);
  const [showResult, setShowResult] = useState<{color:Color; roundNumber:number; reason?:string|null} | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const { data: current, refetch } = useQuery({
    queryKey: ['currentRound'],
    queryFn: async () => (await api.get('/game/current')).data as GameRound,
    refetchInterval: 5000,
  });

  const { data: history } = useQuery({
    queryKey: ['historyMini'],
    queryFn: async () => (await api.get('/game/history?limit=10')).data.items as GameRound[],
  });

  const { data: myBets, refetch: refetchBets } = useQuery({
    queryKey: ['myBets', current?._id],
    queryFn: async () => (await api.get(`/game/${current!._id}/bets`)).data,
    enabled: !!current?._id,
  });

  const betMutation = useMutation({
    mutationFn: async () => {
      if (!current || !selected) throw new Error('No selection');
      const res = await api.post(`/game/${current._id}/bet`, { color: selected, amount });
      return res.data;
    },
    onSuccess: (data) => {
      pushToast(`Bet placed: ${selected} ${formatCoins(amount)} coins`, 'success');
      setAmount(100); // reset for the next bet
      // update user balance locally
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        u.virtualBalance = data.balance;
        localStorage.setItem('user', JSON.stringify(u));
        // trigger header update by dispatching event?
        window.dispatchEvent(new CustomEvent('balance:update', { detail: { balance: data.balance } }));
      }
      qc.invalidateQueries({ queryKey: ['balance'] });
      refetchBets();
      // optimistic live totals will be updated via socket
    },
    onError: (e:any) => pushToast(e.response?.data?.error || 'Bet failed','error'),
  });

  // socket setup
  useEffect(() => {
    const s = io({ auth: { token } });
    setSocket(s);
    s.on('round:tick', (data) => {
      if (data.remainingMs !== undefined) setRemainingMs(data.remainingMs);
      if (data.colorTotals) {
        const t: Record<Color, number> = { RED:0,GREEN:0,BLUE:0 };
        const ct=data.colorTotals;
        if (ct instanceof Map) ct.forEach((v:any,k:string)=>t[k as Color]=Number(v));
        else COLORS.forEach(c=> t[c]=Number(ct[c])||0);
        setLiveTotals(t);
      }
      if (data.bettingCloseTime && data.status==='BETTING_OPEN') {
        const close=new Date(data.bettingCloseTime).getTime();
        setRemainingMs(close - Date.now());
      }
    });
    s.on('round:betUpdate', (data) => {
      const ct=data.colorTotals;
      if (!ct) return;
      const t: Record<Color, number> = { RED:0,GREEN:0,BLUE:0 };
      if (ct instanceof Map) ct.forEach((v:any,k:string)=>t[k as Color]=Number(v));
      else COLORS.forEach(c=> t[c]=Number(ct[c])||0);
      setLiveTotals(t);
    });
    s.on('round:new', (data) => {
      setLiveTotals(null);
      setShowResult(null);
      setRemainingMs(60000);
      refetch();
    });
    s.on('round:closing', () => {
      pushToast('Betting closed, calculating winner...','info');
    });
    s.on('round:result', (data) => {
      setShowResult({ color: data.winningColor, roundNumber: data.roundNumber, reason: data.tieBreakReason });
      setLiveTotals(data.colorTotals);
      refetch();
      qc.invalidateQueries({ queryKey: ['historyMini'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
      // refetch profile to update balance
      api.get('/user/profile').then(r=> {
        const u=r.data;
        const userObj={ id:u.id, name:u.name, email:u.email, virtualBalance:u.virtualBalance, role:u.role };
        localStorage.setItem('user', JSON.stringify(userObj));
      });
    });
    s.on('balance:update', (data) => {
      if (data.balance !== undefined && data.userId) {
        // only if it's our user?
      }
    });
    return () => { s.disconnect(); };
  }, [token, refetch, qc]);

  // local countdown tick
  useEffect(()=> {
    const iv=setInterval(()=> {
      if (current?.bettingCloseTime && current.status==='BETTING_OPEN') {
        const close=new Date(current.bettingCloseTime).getTime();
        // if socket provides live remaining, we still compute locally for smoothness
        // prefer socket remaining but fallback to local
        // We'll just compute diff if socket hasn't updated in last sec
        setRemainingMs(prev => {
          const local = close - Date.now();
          // smooth decay between socket updates
          if (Math.abs(local - prev) > 3000) return local;
          return Math.max(0, prev - 1000);
        });
      }
    },1000);
    return ()=> clearInterval(iv);
  },[current]);

  useEffect(()=> {
    if (current?.bettingCloseTime && current.status==='BETTING_OPEN') {
      setRemainingMs(new Date(current.bettingCloseTime).getTime() - Date.now());
    }
  },[current]);

  const totals = liveTotals || getTotals(current);
  const isBettingOpen = current?.status === 'BETTING_OPEN' && remainingMs > 0;
  const totalBetAll = Object.values(totals).reduce((a,b)=>a+b,0);

  if (!current) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-pulse text-white/60">Loading arena...</div></div>;
  }

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
      {/* Top banner — Branded Arena Header */}
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#13131f] via-[#15152a] to-[#1a1a2e] p-4 sm:p-8 shadow-arena">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_700px_300px_at_10%_-20%,rgba(124,58,237,0.18),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_500px_250px_at_90%_0%,rgba(79,70,229,0.12),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[11px] tracking-[0.14em] font-black">
              <span className={`w-2 h-2 rounded-full ${isBettingOpen? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]':'bg-amber-500'}`} />
              {isBettingOpen ? 'BETTING OPEN • CHROMA CLASH' : current.status.replace('_',' ')}
            </div>
            <h1 className="font-display font-black tracking-tight text-2xl sm:text-[2.1rem] mt-3 leading-none break-words">🎨 COLOR<span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">ARENA</span> <span className="hidden sm:inline text-[11px] font-black tracking-[0.16em] px-2 py-1 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-200 align-middle">PREDICT THE UNPOPULAR</span></h1>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-2">
              <span className="font-mono text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10 shrink-0"># {current.roundNumber}</span>
              <span className="text-xs text-white/40 break-words">• 60s rounds • 2.0x singles • lowest wins</span>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="text-xs tracking-widest text-white/50 font-bold">BETTING CLOSES IN</div>
            <div className={`text-4xl sm:text-6xl font-black font-mono tabular-nums mt-1 ${remainingMs < 10000 && isBettingOpen ? 'text-red-400' : 'text-white'}`}>
              {isBettingOpen ? formatMs(remainingMs) : '00:00'}
            </div>
            <div className="mt-2 w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, (remainingMs/60000)*100))}%` }} />
            </div>
          </div>

          <div className="w-full sm:w-auto text-center lg:text-right bg-white/5 border border-white/10 rounded-2xl px-6 py-4 sm:min-w-[180px] max-w-full">
            <div className="text-xs text-white/50 font-bold tracking-widest">VIRTUAL BALANCE</div>
            <div className="text-2xl font-extrabold text-amber-300 truncate">{formatCoins(user?.virtualBalance || 0)} <span className="text-sm font-normal text-white/60">coins</span></div>
            <div className="text-xs text-white/40 truncate">Total pot: {formatCoins(totalBetAll)}</div>
          </div>
        </div>
      </div>

      {/* Color grid */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-3 sm:gap-4">
        {COLORS.map(c => (
          <ColorCard key={c} color={c} total={totals[c]} selected={selected===c} onSelect={()=> setSelected(c)} disabled={!isBettingOpen} />
        ))}
      </div>

      {/* Bet panel */}
      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4 sm:gap-6">
        <div className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-6 min-w-0">
          <h3 className="font-bold flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">🎯</span>
            Place Your Bet
          </h3>

          {!selected ? (
            <div className="mt-6 py-10 text-center border-2 border-dashed border-white/10 rounded-xl text-white/50">
              Select a color above to start betting
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-2xl">{COLOR_META[selected].emoji}</span>
                <div>
                  <div className="font-bold">Selected: {selected}</div>
                  <div className="text-xs text-white/60">Lowest total wins • 2.0x singles • 1.5x combos • {PLATFORM_FEE_PERCENT}% fee</div>
                </div>
                <button onClick={()=> setSelected(null)} className="ml-auto text-sm px-3 py-1 rounded-full bg-white/10 hover:bg-white/20">Change</button>
              </div>

              <div>
                <label className="text-sm font-medium text-white/80">Amount (coins)</label>
                <div className="mt-2 flex flex-col min-[420px]:flex-row gap-2">
                  <input type="number" value={amount} onChange={e=> setAmount(Math.max(0, parseInt(e.target.value)||0))} className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 font-mono text-base sm:text-lg" min={10} step={10} />
                  <div className="flex gap-2">
                    <button onClick={()=> setAmount(a=> Math.max(10, a-100))} className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold">-100</button>
                    <button onClick={()=> setAmount(a=> a+100)} className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold">+100</button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[100,500,1000,5000].map(v=>(
                    <button key={v} onClick={()=> setAmount(v)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${amount===v? 'bg-violet-600 border-violet-500 text-white':'bg-white/5 border-white/10 hover:bg-white/10'}`}>{formatCoins(v)}</button>
                  ))}
                </div>
                {(() => {
                  let preview = null;
                  try {
                    if (amount > 0) preview = calculatePayout(amount, selected);
                  } catch { preview = null; }
                  return preview ? (
                    <div className="mt-2 text-xs text-white/50 space-y-1 rounded-xl bg-black/20 border border-white/5 p-3">
                      <div className="flex justify-between"><span>Bet amount</span><span className="font-mono font-bold text-white">{formatCoins(preview.betAmount)}</span></div>
                      <div className="flex justify-between"><span>Gross payout ({preview.multiplier.toFixed(1)}x)</span><span className="font-mono font-bold text-white">{formatCoins(preview.grossPayout)}</span></div>
                      <div className="flex justify-between"><span>Platform fee ({PLATFORM_FEE_PERCENT}%)</span><span className="font-mono font-bold text-amber-300">-{formatCoins(preview.platformFee)}</span></div>
                      <div className="flex justify-between border-t border-white/10 pt-1"><span className="font-bold text-white">You receive if win</span><span className="text-emerald-400 font-bold font-mono">{formatCoins(preview.netPayout)} coins</span></div>
                    </div>
                  ) : null;
                })()}
              </div>

              <button
                onClick={()=> betMutation.mutate()}
                disabled={!isBettingOpen || betMutation.isPending || amount <=0 || amount > (user?.virtualBalance||0)}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-extrabold text-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-900/30">
                {betMutation.isPending ? 'Placing...' : `PLACE BET • ${formatCoins(amount)}`}
              </button>
              {!isBettingOpen && <div className="text-center text-sm text-red-400 font-medium">Betting closed for this round</div>}
              {amount > (user?.virtualBalance||0) && <div className="text-center text-sm text-red-400">Insufficient balance</div>}
            </div>
          )}

          {/* my bets */}
          {myBets?.bets?.length >0 && (
            <div className="mt-6">
              <div className="text-sm font-bold text-white/70">Your bets this round</div>
              <div className="mt-2 space-y-2">
                {myBets.bets.map((b:any)=>(
                  <div key={b._id} className="p-3 rounded-xl bg-black/20 border border-white/5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">{COLOR_META[b.color as Color].emoji} {b.color}</span>
                      <span className="font-mono font-bold">{formatCoins(b.amount)}</span>
                    </div>
                    {b.payout && (
                      <div className="mt-2 pt-2 border-t border-white/5 text-xs text-white/50 space-y-0.5">
                        <div className="flex justify-between"><span>Gross ({Number(b.payout.multiplier).toFixed(1)}x)</span><span className="font-mono">{formatCoins(b.payout.grossPayout)}</span></div>
                        <div className="flex justify-between"><span>Fee ({PLATFORM_FEE_PERCENT}%)</span><span className="font-mono">-{formatCoins(b.payout.platformFee)}</span></div>
                        <div className="flex justify-between"><span className="font-bold text-white">You receive</span><span className="font-mono font-bold text-emerald-400">{formatCoins(b.payout.netPayout)}</span></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel: recent results & info */}
        <div className="space-y-4">
          <div className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Recent Results</h3>
              <Link to="/history" className="text-xs text-violet-400 hover:underline">View all</Link>
            </div>
            <div className="mt-4 space-y-2">
              {(history||[]).slice(0,6).map((r)=> (
                <div key={r._id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5 min-w-0">
                  <span className="font-mono text-xs text-white/60 shrink-0">#{r.roundNumber}</span>
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold truncate"><span className="shrink-0">{r.winningColor ? resultEmoji(r.winningColor) : '❓'}</span> <span className="truncate">{r.winningColor ? r.winningColor.replace('_', ' + ') : '—'}</span></span>
                  <span className="hidden min-[380px]:block text-xs text-white/50 shrink-0">{new Date(r.resultTime || r.startTime).toLocaleTimeString()}</span>
                </div>
              ))}
              {!history?.length && <div className="text-sm text-white/40 text-center py-6">No history yet</div>}
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 rounded-2xl p-4 sm:p-5">
            <h4 className="font-bold text-sm">💰 Payout Rules</h4>
            <div className="mt-3 space-y-1.5 text-sm">
              {[
                ['Single color wins', PAYOUT_RULES.RED],
                ['Two colors win together', PAYOUT_RULES.RED_BLUE],
              ].map(([label, m]) => (
                <div key={label as string} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-black/30 border border-white/10">
                  <span className="font-bold">{label}</span>
                  <span className="font-mono font-bold text-emerald-300">{Number(m).toFixed(1)}x</span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-white/60">Multipliers are gross returns (stake included). Platform fee: <span className="font-bold text-white">{PLATFORM_FEE_PERCENT}%</span> on every win.</div>
          </div>

          <div className="bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 rounded-2xl p-4 sm:p-5">
            <h4 className="font-bold text-sm">💡 How to win</h4>
            <p className="text-sm text-white/70 mt-2 leading-relaxed">
              The color with the <span className="text-white font-bold">lowest total bet</span> wins. Bet on unpopular colors! Tie-break: priority RED &gt; GREEN &gt; BLUE.
            </p>
            <div className="mt-3 text-xs px-3 py-2 rounded-lg bg-black/30 border border-white/10">
              Virtual coins have no real value.
            </div>
          </div>
        </div>
      </div>

      </div>
      {/* Result modal — outside space-y to avoid margin bleeding */}
      <AnimatePresence>
        {showResult && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={()=> setShowResult(null)}>
            <motion.div initial={{scale:0.8, rotate:-2}} animate={{scale:1, rotate:0}} exit={{scale:0.8}} onClick={e=>e.stopPropagation()} className="w-full max-w-md bg-[#13131f] border border-white/10 rounded-[1.5rem] p-6 sm:p-8 text-center overflow-hidden relative max-h-[90vh] overflow-y-auto">
              <div className={`absolute inset-0 bg-gradient-to-br ${resultGradient(showResult.color)} opacity-20`} />
              <div className="relative">
                <div className="text-sm tracking-widest font-bold text-white/60">ROUND #{showResult.roundNumber} RESULT</div>
                <div className="mt-4 text-6xl animate-bounce">{resultEmoji(showResult.color)}</div>
                <div className={`mt-2 text-3xl break-words sm:text-4xl font-black bg-gradient-to-r ${resultGradient(showResult.color)} bg-clip-text text-transparent`}>{showResult.color.replace('_', ' + ')} WINS!</div>
                {showResult.reason && <div className="mt-3 text-xs p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 break-words">{showResult.reason}</div>}
                <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
                  {COLORS.map(c=> (
                    <div key={c} className={`p-2 rounded-lg border break-words font-mono ${c===showResult.color? 'bg-white text-black border-white font-bold':'bg-white/5 border-white/10'}`}>{c}: {formatCoins((liveTotals||totals)[c])}</div>
                  ))}
                </div>
                <button onClick={()=> setShowResult(null)} className="mt-6 w-full py-3 rounded-xl bg-white text-black font-bold">Continue</button>
                <div className="mt-2 text-xs text-white/40">Next round starting soon...</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
