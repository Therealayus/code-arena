import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../store/auth';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { COLOR_META, COLORS, Color } from '../types';
import { formatCoins } from '../utils/format';
import { DEPOSIT_BONUS_TIERS } from '../utils/bonus';

export default function Landing() {
  const { user } = useAuth();
  const { data: stats } = useQuery({
    queryKey: ['landingStats', user?.role],
    queryFn: async () => {
      if (!user || user.role !== 'admin') {
        // For guests, use public history to estimate rounds
        try {
          const h = await api.get('/game/history?limit=1');
          return { totalRounds: h.data.total || 0 };
        } catch {
          return null;
        }
      }
      try {
        const res = await api.get('/admin/stats');
        return res.data;
      } catch {
        return null;
      }
    },
    refetchInterval: 8000,
  });
  const { data: history } = useQuery({
    queryKey: ['landingHistory'],
    queryFn: async () => (await api.get('/game/history?limit=6')).data.items,
  });
  const { data: bonuses } = useQuery({
    queryKey: ['bonusConfig'],
    queryFn: async () => (await api.get('/bonuses')).data,
    staleTime: 60000,
  });

  return (
    <div className="overflow-x-hidden">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-[400px] h-[400px] sm:w-[700px] sm:h-[700px] bg-violet-600/12 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[320px] h-[320px] sm:w-[600px] sm:h-[600px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16 relative">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-6 lg:gap-10 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-[11px] sm:text-xs font-bold tracking-widest max-w-full">
                <span className="w-2 h-2 shrink-0 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="break-words">LIVE • {stats?.totalRounds ? `${stats.totalRounds} ROUNDS PLAYED` : 'REAL-TIME MULTIPLAYER'} • VIRTUAL COINS</span>
              </div>

              <h1 className="font-display font-black tracking-tight leading-[0.9] sm:leading-[0.85] mt-5 text-3xl sm:text-5xl lg:text-[3.4rem]">
                PREDICT THE<br />
                <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">UNPOPULAR</span><br />
                COLOR. WIN BIG.
              </h1>

              <p className="mt-4 text-white/60 leading-relaxed max-w-xl text-[15px]">
                <span className="text-white font-bold">Color Arena</span> — 3 colors, 60-second rounds. The color with the
                <span className="text-white font-semibold"> lowest total pot wins</span>. Bet contrarian, win <span className="text-emerald-300 font-black">2.0×</span>. Trusted by thousands of players — no real money, ever.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to={user ? '/game' : '/register'}
                  className="px-7 py-3.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 font-black tracking-wide text-sm shadow-glow-violet hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] transition-all"
                >
                  {user ? 'Enter Arena →' : 'Recharge & Play →'}
                </Link>
                <Link to="/game" className="px-6 py-3.5 rounded-full bg-white/10 border border-white/15 font-bold text-sm hover:bg-white/15 transition-colors">
                  Watch Live
                </Link>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-200">
                  🎯 Tie-break: RED › GREEN › BLUE
                </span>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3 max-w-md">
                {[
                  { k: '60s', label: 'Rounds', sub: 'Auto cycle' },
                  { k: '2.0x', label: 'Payout', sub: 'Singles' },
                  { k: '3', label: 'Colors', sub: 'To predict' },
                ].map((s) => (
                  <div key={s.k} className="rounded-2xl bg-white/[0.06] border border-white/10 p-2 sm:p-3 text-center backdrop-blur min-w-0">
                    <div className="font-display font-black text-lg sm:text-xl">{s.k}</div>
                    <div className="text-[11px] font-black tracking-widest text-white/50">{s.label}</div>
                    <div className="text-[10px] text-white/30">{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3 text-xs text-white/40">
                <div className="flex -space-x-2">
                  <img src="https://i.pravatar.cc/100?img=11" alt="" className="w-7 h-7 rounded-full border-2 border-[#07080f]" />
                  <img src="https://i.pravatar.cc/100?img=12" alt="" className="w-7 h-7 rounded-full border-2 border-[#07080f]" />
                  <img src="https://i.pravatar.cc/100?img=13" alt="" className="w-7 h-7 rounded-full border-2 border-[#07080f]" />
                  <div className="w-7 h-7 rounded-full bg-violet-600 border-2 border-[#07080f] grid place-items-center text-[10px] font-black">+2k</div>
                </div>
                <span>2,431 players • No wallet needed</span>
              </div>
            </motion.div>

            {/* HERO VISUAL — Phone mock + display board */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="relative lg:pl-4"
            >
              <div className="relative mx-auto w-full max-w-[360px]">
                <div className="absolute -inset-4 bg-gradient-to-br from-violet-600/20 via-indigo-600/15 to-fuchsia-600/10 blur-2xl rounded-[2rem]" />
                <div className="relative bg-[#0f0f1a] border border-white/10 rounded-[2rem] p-3 shadow-arena overflow-hidden">
                  <div className="flex items-center justify-between px-2 py-1">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-500/80" />
                      <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <span className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <span className="text-[11px] font-bold tracking-widest text-white/40">COLOR ARENA • LIVE</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>

                  <div className="mt-3 rounded-[1.25rem] bg-gradient-to-br from-[#13131f] to-[#1a1a2e] border border-white/10 p-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600/8 to-transparent pointer-events-none" />
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black tracking-widest px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-300">BETTING OPEN</span>
                        <span className="font-mono text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">ROUND #12,847</span>
                      </div>
                      <div className="mt-3 text-center">
                        <div className="text-[10px] tracking-[0.14em] font-bold text-white/40">BETTING CLOSES IN</div>
                        <div className="font-mono font-black text-4xl tracking-tight">00:23</div>
                        <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full w-[62%] bg-gradient-to-r from-violet-500 to-indigo-500" />
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {COLORS.map((c) => (
                          <div key={c} className={`rounded-xl p-2 text-center border bg-gradient-to-br ${COLOR_META[c as Color].gradient} bg-white/5 border-white/10`}>
                            <div className="text-lg">{COLOR_META[c as Color].emoji}</div>
                            <div className="text-[10px] font-black tracking-widest">{c}</div>
                            <div className="text-[11px] font-mono font-bold">{formatCoins(c === 'RED' ? 2450 : c === 'GREEN' ? 5100 : 3200)}</div>
                          </div>
                        ))}
                      </div>
                      <button className="mt-4 w-full py-2.5 rounded-xl bg-white text-black font-black text-xs tracking-widest">PLACE BET • 500 COINS</button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-center">
                      <div className="text-[10px] font-black tracking-widest text-amber-300">YOUR BALANCE</div>
                      <div className="font-mono font-black text-amber-100">10,500</div>
                      <div className="text-[10px] text-amber-200/60">coins</div>
                    </div>
                    <div className="rounded-xl bg-violet-600/15 border border-violet-500/20 p-2.5 text-center">
                      <div className="text-[10px] font-black tracking-widest text-violet-200">POT TOTAL</div>
                      <div className="font-mono font-black text-white">17,300</div>
                      <div className="text-[10px] text-violet-200/60">lowest wins</div>
                    </div>
                  </div>
                </div>

                <div className="absolute -right-3 -bottom-6 hidden lg:block">
                  <div className="rotate-3 rounded-2xl bg-white text-black p-3 shadow-xl border border-black/5 w-[170px]">
                    <div className="text-[11px] font-black tracking-widest text-black/60">LAST WINNER</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 grid place-items-center text-sm">🔵</span>
                      <div>
                        <div className="font-black leading-none">BLUE</div>
                        <div className="text-[11px] text-black/50">Round #12,846 • 3,400 pot</div>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] px-2 py-1 rounded-full bg-emerald-500 text-white font-bold text-center">TIE-BREAK → BLUE</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* TRUST STRIP */}
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { title: 'No Real Money', desc: 'Virtual coins, pure skill game', icon: '🛡️' },
              { title: 'Provably Fair', desc: 'Lowest total wins, verified results', icon: '⚖️' },
              { title: 'Real-time', desc: 'Live rounds • instant updates', icon: '⚡' },
              { title: '60s Rounds', desc: 'Auto cycle • 8s reveal', icon: '⏱️' },
            ].map((f) => (
              <div key={f.title} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] border border-white/10 p-3 min-w-0">
                <div className="w-9 h-9 shrink-0 rounded-xl bg-white/10 border border-white/10 grid place-items-center text-lg">{f.icon}</div>
                <div className="min-w-0">
                  <div className="font-bold text-sm leading-none truncate">{f.title}</div>
                  <div className="text-xs text-white/50 leading-tight break-words">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DISPLAY BOARDS — How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-14">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-600/15 border border-violet-500/20 text-xs font-black tracking-widest text-violet-200">DISPLAY BOARDS • HOW IT WORKS</div>
          <h2 className="font-display font-black tracking-tight text-3xl sm:text-4xl mt-3">Three steps to <span className="text-gradient-violet">Chroma Glory</span></h2>
          <p className="text-white/60 mt-2">No luck — bet against the crowd. The unpopular chroma wins.</p>
        </div>

        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {[
            {
              step: '01',
              title: 'Pick a Chroma',
              desc: 'Choose from 3: RED, GREEN, BLUE. Watch live pots update in real time.',
              img: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop',
              gradient: 'from-red-500 to-rose-600',
            },
            {
              step: '02',
              title: 'Bet Virtual Coins',
              desc: 'Stake 10—100k coins. 2.0x singles / 1.5x combos payout if you’re right. Balance validated server-side.',
              img: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop',
              gradient: 'from-violet-600 to-indigo-600',
            },
            {
              step: '03',
              title: 'Lowest Wins',
              desc: 'When timer hits 0, lowest total wins. Tie between colors? RED beats GREEN beats BLUE.',
              img: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800&auto=format&fit=crop',
              gradient: 'from-emerald-500 to-teal-600',
            },
          ].map((b) => (
            <div key={b.step} className="group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#13131f] shadow-arena hover:scale-[1.01] transition-transform">
              <div className="h-36 overflow-hidden relative">
                <img src={b.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent`} />
                <div className={`absolute top-3 left-3 w-8 h-8 rounded-full bg-gradient-to-br ${b.gradient} grid place-items-center text-xs font-black text-white shadow`}>{b.step}</div>
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="font-display font-bold text-lg leading-none text-white">{b.title}</h3>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-white/60 leading-relaxed">{b.desc}</p>
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold tracking-widest text-violet-300">
                  LEARN MORE <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Color showcase board */}
        <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-[#13131f] to-[#1a1a2e] p-4 sm:p-7 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_200px_at_50%_0%,rgba(124,58,237,0.12),transparent_60%)] pointer-events-none" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-display font-black text-xl">The 3 Colors</h3>
              <p className="text-sm text-white/50">Every round, all three compete. Only the quietest wins.</p>
            </div>
            <span className="text-xs font-bold tracking-widest px-3 py-1.5 rounded-full bg-white/10 border border-white/10">LIVE POTS • UPDATED EVERY SECOND</span>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {COLORS.map((c) => (
              <div key={c} className={`group relative overflow-hidden rounded-2xl border border-white/10 p-[1px] bg-gradient-to-br ${COLOR_META[c as Color].gradient} hover:scale-[1.02] transition-transform`}>
                <div className="rounded-2xl bg-[#0f0f1a] p-4 text-center relative">
                  <div className="text-3xl group-hover:scale-110 transition-transform">{COLOR_META[c as Color].emoji}</div>
                  <div className="mt-2 font-black tracking-[0.14em] text-xs">{c}</div>
                  <div className="mt-1 text-[11px] font-mono text-white/60">3,420 coins avg</div>
                  <div className={`mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden`}>
                    <div className={`h-full bg-gradient-to-r ${COLOR_META[c as Color].gradient}`} style={{ width: `${30 + Math.random() * 50}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 font-bold">2.0x singles • 1.5x combos • 10% fee</span>
            <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 font-bold">Tie-break: RED › GREEN › BLUE</span>
          </div>
        </div>
      </section>

      {/* LIVE ARENA PREVIEW BOARD */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 sm:pb-10">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] backdrop-blur p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display font-bold text-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Arena Preview
              <span className="text-xs font-bold tracking-widest px-2 py-1 rounded-full bg-white/10 border border-white/10">REAL DATA</span>
            </h3>
            <Link to="/game" className="text-xs font-black tracking-widest px-4 py-2 rounded-full bg-white text-black hover:bg-zinc-100">Enter Live →</Link>
          </div>

          <div className="mt-5 grid md:grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(history || []).slice(0, 6).map((r: any) => (
                <div key={r._id} className="rounded-xl bg-[#13131f] border border-white/10 p-3 text-center">
                  <div className="text-[11px] font-mono text-white/40">#{r.roundNumber}</div>
                  <div className="mt-1 text-xl">{r.winningColor ? COLOR_META[r.winningColor as Color]?.emoji : '…'}</div>
                  <div className="font-black text-xs tracking-widest">{r.winningColor || 'PENDING'}</div>
                  <div className="mt-1 text-[11px] font-mono text-white/50">{formatCoins(r.totalBetAmount)} pot</div>
                </div>
              ))}
              {!history?.length && <div className="col-span-2 sm:col-span-3 py-8 text-center text-white/40 text-sm">Loading live results…</div>}
            </div>

            <div className="space-y-3">
              <img
                src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800&auto=format&fit=crop"
                alt="Crowd cheering arena"
                className="w-full h-36 object-cover rounded-xl border border-white/10"
              />
              <div className="rounded-xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 p-4">
                <div className="text-sm font-black">Why players love it</div>
                <ul className="mt-2 space-y-1.5 text-sm text-white/70">
                  <li>• No real money — pure skill & psychology</li>
                  <li>• Fair results — cannot be rigged</li>
                  <li>• Every round verifiable • history open</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BONUSES & REWARDS — advertised offers */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 sm:pb-10">
        <div className="rounded-[1.5rem] border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.07] via-[#13131f] to-[#1a1a2e] p-6 sm:p-7 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_200px_at_50%_0%,rgba(245,158,11,0.10),transparent_60%)] pointer-events-none" />
          <div className="relative text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/20 text-xs font-black tracking-widest text-amber-200">BONUSES & REWARDS</div>
            <h2 className="font-display font-black tracking-tight text-3xl sm:text-4xl mt-3">Get More <span className="text-gradient-violet">Coins Free</span></h2>
            <p className="text-white/60 mt-2">Two ways to boost your balance — no catch, coins credited instantly.</p>
          </div>

          <div className="relative mt-6 grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-black/30 border border-white/10 p-4 sm:p-5 text-center">
              <div className="text-3xl">💰</div>
              <div className="mt-2 font-display font-black text-xl">Top Up & Play</div>
              <div className="text-xs font-bold tracking-widest text-amber-300">GET STARTED</div>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">Add funds to your wallet to enter the arena. Every top-up earns extra bonus coins automatically.</p>
              <Link to="/payment" className="mt-4 inline-block px-5 py-2.5 rounded-full bg-white text-black font-black text-sm hover:bg-zinc-100">Top Up Now</Link>
            </div>

            <div className="rounded-2xl bg-black/30 border border-white/10 p-4 sm:p-5 text-center">
              <div className="text-3xl">🤝</div>
              <div className="mt-2 font-display font-black text-xl">Give 500, Get 1,000</div>
              <div className="text-xs font-bold tracking-widest text-amber-300">REFER & EARN</div>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">
                Share your code — your friend gets <span className="text-white font-bold">500 bonus coins</span> on signup,
                and you get <span className="text-white font-bold">1,000 coins</span> when their first top-up clears.
              </p>
              <Link to={user ? '/referrals' : '/register'} className="mt-4 inline-block px-5 py-2.5 rounded-full bg-white/10 border border-white/15 font-bold text-sm hover:bg-white/15">Invite Friends</Link>
            </div>

            <div className="rounded-2xl bg-black/30 border border-white/10 p-4 sm:p-5 text-center">
              <div className="text-3xl">⚡</div>
              <div className="mt-2 font-display font-black text-xl">Up to +15% Extra</div>
              <div className="text-xs font-bold tracking-widest text-amber-300">TOP-UP BONUS</div>
              <div className="mt-3 space-y-1.5 text-sm">
                {(bonuses?.depositTiers || DEPOSIT_BONUS_TIERS).map((t: any) => (
                  <div key={t.minAmount} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10">
                    <span className="font-bold">Top up ₹{t.minAmount.toLocaleString('en-IN')}+</span>
                    <span className="font-mono font-bold text-emerald-300">+{t.bonusPercent}%</span>
                  </div>
                ))}
              </div>
              <Link to="/payment" className="mt-4 inline-block px-5 py-2.5 rounded-full bg-white/10 border border-white/15 font-bold text-sm hover:bg-white/15">Top Up Now</Link>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS / DISPLAY BOARD */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 sm:pb-12">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { name: 'Aarav • Mumbai', text: '“I love betting against the crowd. Won 3 in a row on GREEN!”', avatar: 'https://i.pravatar.cc/100?img=15' },
            { name: 'Sofia • Berlin', text: '“Feels like a real esports arena. The 60s timer is addictive.”', avatar: 'https://i.pravatar.cc/100?img=26' },
            { name: 'Kenji • Tokyo', text: '“Tie-break is transparent. RED priority saved me once!”', avatar: 'https://i.pravatar.cc/100?img=31' },
          ].map((t) => (
            <div key={t.name} className="rounded-[1.25rem] bg-[#13131f] border border-white/10 p-4 flex gap-3">
              <img src={t.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
              <div>
                <div className="text-sm font-bold">{t.name}</div>
                <div className="text-sm text-white/60 leading-relaxed mt-1">{t.text}</div>
                <div className="mt-2 flex gap-0.5 text-amber-400 text-xs">★★★★★</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-[1.5rem] bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 p-[1px]">
          <div className="rounded-[1.5rem] bg-[#0f0f1a] p-4 sm:p-8 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-display font-black text-2xl">Ready to enter the Arena?</h3>
              <p className="text-white/60 mt-1">Create account → top up to play. No KYC needed.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <Link to="/register" className="px-7 py-3.5 rounded-full bg-white text-black font-black hover:bg-zinc-100 text-center">Create Account</Link>
              <Link to="/login" className="px-6 py-3.5 rounded-full bg-white/10 border border-white/15 font-bold hover:bg-white/15 text-center">Login</Link>
            </div>
          </div>
        </div>
        <div className="mt-3 text-center text-[11px] tracking-widest font-bold text-white/30">VIRTUAL COINS • NO REAL MONEY • PLAY RESPONSIBLY • 18+</div>
      </section>
    </div>
  );
}
