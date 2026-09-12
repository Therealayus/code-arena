import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useEffect, useState } from 'react';
import ChangePasswordModal from './ChangePasswordModal';

export default function Header() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [showPw, setShowPw] = useState(false);
  const { data: bal } = useQuery({
    queryKey: ['balance'],
    queryFn: async () => (await api.get('/user/balance')).data.balance,
    enabled: !!user,
    refetchInterval: 10000,
  });

  const displayBalance = bal ?? user?.virtualBalance ?? 0;
  const isActive = (p: string) => loc.pathname === p;

  useEffect(() => {
    const onBal = () => {};
    window.addEventListener('balance:update' as any, onBal);
    return () => window.removeEventListener('balance:update' as any, onBal);
  }, []);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#07080f]/80 border-b border-white/[0.06] supports-[backdrop-filter]:bg-[#07080f]/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <Link to="/" className="order-1 flex items-center gap-2 sm:gap-3 group min-w-0 flex-1 sm:flex-none">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 flex items-center justify-center text-[18px] shadow-glow-violet group-hover:scale-[1.03] transition-transform shrink-0">
            <span className="relative">🎨</span>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
          </div>
          <div className="flex flex-col leading-none min-w-0">
            <span className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] flex items-baseline gap-1.5 truncate">
              COLOR<span className="text-gradient-violet">ARENA</span>
              <span className="hidden sm:inline-flex items-center text-[10px] font-black tracking-[0.14em] px-1.5 py-0.5 rounded-md bg-white/10 border border-white/10 text-white/70">CHROMA CLASH</span>
            </span>
            <span className="hidden sm:block text-[10px] tracking-[0.18em] font-semibold text-white/40 -mt-0.5 truncate">PREDICT THE UNPOPULAR</span>
          </div>
          <span className="hidden lg:inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> VIRTUAL COINS
          </span>
        </Link>

        {user ? (
          <>
            {/* Mobile row 1 (right): compact balance */}
            <div className="order-2 flex md:hidden min-w-0 items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/25 shrink-0">
              <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-black font-mono text-amber-100 truncate max-w-[60px]">{displayBalance.toLocaleString()}</span>
            </div>
            {/* Mobile row 1 (right): compact logout */}
            <button
              onClick={() => { logout(); nav('/login'); }}
              className="order-3 md:hidden text-[11px] font-bold px-2.5 py-2 min-h-[40px] rounded-full bg-white text-black hover:bg-zinc-100 transition-colors shrink-0 whitespace-nowrap"
            >
              Logout
            </button>
            {/* Desktop balance pill */}
            <div className="order-2 hidden md:flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/12 to-yellow-500/8 border border-amber-500/20 shadow-sm">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-[11px] font-black text-black">◈</div>
              <div className="flex flex-col leading-none">
                <span className="text-[11px] font-bold tracking-widest text-amber-200/70">BALANCE</span>
                <span className="text-[13px] font-black font-mono text-amber-100 -mt-0.5">{displayBalance.toLocaleString()}</span>
              </div>
              <span className="text-[10px] font-bold text-amber-300/60 ml-1">COINS</span>
            </div>

            {/* Mobile row 2: icon nav spread across full width */}
            <nav className="order-4 md:order-3 flex w-full md:w-auto items-center gap-1 sm:gap-2 flex-wrap sm:justify-end" aria-label="Game">
              <div className="hidden md:flex items-center gap-1 ml-1 p-1 rounded-full bg-white/[0.06] border border-white/10">
                <Link to="/game" className={`text-xs font-bold px-3 py-2 min-h-[36px] flex items-center rounded-full transition-colors ${isActive('/game') ? 'bg-white text-black shadow' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>Arena</Link>
                <Link to="/payment" className={`text-xs font-bold px-3 py-2 min-h-[36px] flex items-center rounded-full transition-colors ${isActive('/payment') ? 'bg-white text-black shadow' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>Wallet</Link>
                <Link to="/history" className={`text-xs font-bold px-3 py-2 min-h-[36px] flex items-center rounded-full transition-colors ${isActive('/history') ? 'bg-white text-black shadow' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>History</Link>
                <Link to="/referrals" className={`text-xs font-bold px-3 py-2 min-h-[36px] flex items-center rounded-full transition-colors ${isActive('/referrals') ? 'bg-white text-black shadow' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>Refer</Link>
                {user.role === 'admin' && <Link to="/admin" className={`text-xs font-bold px-3 py-2 min-h-[36px] flex items-center rounded-full transition-colors ${isActive('/admin') ? 'bg-violet-600 text-white shadow' : 'bg-violet-600/20 text-violet-200 hover:bg-violet-600 hover:text-white'}`}>Admin</Link>}
              </div>
              <div className="flex md:hidden items-center justify-between gap-1 w-full">
                <Link to="/game" aria-label="Arena" className="min-w-[44px] min-h-[44px] w-11 h-11 grid place-items-center rounded-full bg-white text-black font-black text-[11px] border border-white/10">▶</Link>
                <Link to="/payment" aria-label="Wallet" className="min-w-[44px] min-h-[44px] w-11 h-11 grid place-items-center rounded-full bg-emerald-600 text-white font-bold text-[11px]">₹</Link>
                <Link to="/history" aria-label="History" className="min-w-[44px] min-h-[44px] w-11 h-11 grid place-items-center rounded-full bg-white/10 border border-white/10 text-sm">≡</Link>
                <Link to="/referrals" aria-label="Refer and earn" className="min-w-[44px] min-h-[44px] w-11 h-11 grid place-items-center rounded-full bg-amber-500/20 border border-amber-500/30 text-sm">🤝</Link>
                {user.role === 'admin' && <Link to="/admin" aria-label="Admin" className="min-w-[44px] min-h-[44px] w-11 h-11 grid place-items-center rounded-full bg-violet-600 text-white font-black text-xs">A</Link>}
                <button onClick={() => setShowPw(true)} aria-label="Change password" className="min-w-[44px] min-h-[44px] w-11 h-11 grid place-items-center rounded-full bg-white/10 border border-white/10 text-sm">🔒</button>
              </div>
            </nav>

            {/* Desktop user block */}
            <div className="order-4 hidden md:flex items-center gap-1.5 sm:gap-2 ml-1 shrink-0">
              <div className="hidden md:flex flex-col items-end leading-none mr-1 min-w-0">
                <span className="text-xs font-semibold text-white truncate max-w-[90px]">{user.name}</span>
                <span className="text-[10px] text-white/50">{user.role}</span>
              </div>
              <button
                onClick={() => setShowPw(true)}
                aria-label="Change password"
                title="Change password"
                className="min-w-[40px] min-h-[44px] w-10 h-11 grid place-items-center rounded-full bg-white/10 border border-white/10 text-sm hover:bg-white/20 transition-colors shrink-0"
              >
                🔒
              </button>
              <button
                onClick={() => { logout(); nav('/login'); }}
                className="text-xs font-bold px-2.5 sm:px-3 py-2 min-h-[44px] rounded-full bg-white text-black hover:bg-zinc-100 transition-colors shrink-0"
              >
                Logout
              </button>
            </div>
          </>
        ) : (
          <nav className="order-2 flex items-center gap-2" aria-label="Account">
            <Link to="/login" className="text-[11px] sm:text-xs font-bold px-3 sm:px-4 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] flex-1 sm:flex-none text-center flex items-center justify-center whitespace-nowrap rounded-full bg-white text-black hover:bg-zinc-100 transition-colors">Login</Link>
            <Link to="/register" className="text-[11px] sm:text-xs font-bold px-3 sm:px-4 py-2 sm:py-2.5 min-h-[40px] sm:min-h-[44px] flex-1 sm:flex-none text-center flex items-center justify-center whitespace-nowrap rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-glow-violet hover:opacity-95">Create Account</Link>
          </nav>
        )}
      </div>
      {showPw && <ChangePasswordModal onClose={() => setShowPw(false)} />}
    </header>
  );
}
