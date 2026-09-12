import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../store/auth';
import { pushToast } from '../components/Toast';
import { useSupportTelegram } from '../components/SupportLine';

function ResetHelp() {
  const [open, setOpen] = useState(false);
  const telegram = useSupportTelegram();
  return (
    <div className="text-center">
      <button type="button" onClick={() => setOpen(!open)} className="text-sm text-violet-300 hover:text-violet-200 font-semibold underline decoration-violet-500/30">
        Forgot password?
      </button>
      {open && (
        <div className="mt-3 text-left rounded-xl bg-white/[0.04] border border-white/10 p-4 space-y-2.5">
          <div className="text-xs font-black tracking-widest text-white/70">HOW PASSWORD RESET WORKS</div>
          <ol className="space-y-2 text-sm text-white/70 leading-relaxed list-none">
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-violet-600 grid place-items-center text-[11px] font-black">1</span><span>Message the admin on <span className="text-white font-bold">Telegram</span> from your account.</span></li>
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-violet-600 grid place-items-center text-[11px] font-black">2</span><span>Share your <span className="text-white font-bold">registered name & email</span> so the admin can verify it's really you.</span></li>
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-violet-600 grid place-items-center text-[11px] font-black">3</span><span>Admin resets it <span className="text-white font-bold">manually</span> and sends your new password on Telegram — log in with it.</span></li>
          </ol>
          {telegram ? (
            <a href={telegram} target="_blank" rel="noreferrer" className="block text-center w-full py-2.5 rounded-xl bg-[#229ED9] text-white font-bold text-sm hover:opacity-90">Message Admin on Telegram →</a>
          ) : (
            <div className="text-xs text-white/40 text-center">Support contact is being set up — please try again later.</div>
          )}
          <div className="text-[11px] text-white/40 leading-relaxed">🛡️ Safety: the admin will never ask for your current password or money. Only use the official link shown here.</div>
        </div>
      )}
    </div>
  );
}

export default function Login() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [loading,setLoading]=useState(false);
  const nav=useNavigate();
  const { setAuth, user } = useAuth();

  if (user) return <Navigate to="/game" replace />;

  async function submit(e:any) {
    e.preventDefault();
    setLoading(true);
    try {
      const res=await api.post('/auth/login',{email,password});
      setAuth(res.data.user, res.data.token);
      pushToast('Welcome back!','success');
      nav('/game');
    } catch(err:any) {
      pushToast(err.response?.data?.error || 'Login failed','error');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-center">
        <div className="hidden lg:block space-y-6 pr-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-600/15 border border-violet-500/20 text-[11px] font-black tracking-[0.14em] text-violet-200">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" /> CHROMA CLASH • SEASON 01
          </div>
          <div>
            <h1 className="font-display font-black tracking-tight leading-[0.9] text-5xl">
              ENTER THE<br />
              <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">COLOR ARENA</span>
            </h1>
            <p className="mt-3 text-white/60 leading-relaxed max-w-md">
              Predict the <span className="text-white font-bold">unpopular</span> color. The lowest total pot wins — 2.0× payout. Real-time, multiplayer action.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { k:'60s', v:'Rounds' },
              { k:'2.0x', v:'Payout' },
              { k:'3', v:'Colors' },
            ].map(s=>(
              <div key={s.k} className="rounded-2xl bg-white/[0.06] border border-white/10 p-3 text-center">
                <div className="font-display font-black text-xl">{s.k}</div>
                <div className="text-[11px] tracking-widest font-bold text-white/40">{s.v}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-white/30">
            <span className="w-8 h-[1px] bg-white/20" /> VIRTUAL COINS • NO REAL MONEY • FAIR TIE-BREAK
          </div>
        </div>

        <form onSubmit={submit} className="w-full max-w-md mx-auto bg-[#13131f] border border-white/10 rounded-[1.5rem] p-6 sm:p-7 space-y-5 shadow-arena">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 grid place-items-center text-xl shadow-glow-violet">🎨</div>
            <div>
              <h2 className="font-display font-bold text-xl leading-none">Welcome back</h2>
              <p className="text-white/60 text-xs mt-1">Login to enter the arena</p>
            </div>
            <span className="ml-auto text-[11px] font-black tracking-widest px-2 py-1 rounded-full bg-white/10 border border-white/10">LIVE</span>
          </div>
          <div className="space-y-3">
            <label className="block text-xs font-bold tracking-widest text-white/70">EMAIL
              <input value={email} onChange={e=>setEmail(e.target.value)} className="mt-1.5 w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 focus:bg-white/[0.06] transition-colors text-base sm:text-sm" placeholder="you@demo.com" />
            </label>
            <label className="block text-xs font-bold tracking-widest text-white/70">PASSWORD
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1.5 w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 focus:bg-white/[0.06] transition-colors text-base sm:text-sm" />
            </label>
          </div>
          <button disabled={loading} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-black tracking-wide hover:opacity-95 disabled:opacity-50 shadow-glow-violet">
            {loading?'Signing in...':'Enter Arena →'}
          </button>
          <div className="text-sm text-center text-white/60">No account? <Link to="/register" className="text-violet-300 hover:text-violet-200 font-semibold underline decoration-violet-500/30">Create one</Link></div>
          <ResetHelp />
        </form>
      </div>
    </div>
  );
}
