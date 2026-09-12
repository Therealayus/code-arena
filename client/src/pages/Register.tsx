import { useState } from 'react';
import { Link, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../store/auth';
import { pushToast } from '../components/Toast';
import { REFERRAL_RULES } from '../utils/bonus';

export default function Register() {
  const [params] = useSearchParams();
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [referralCode,setReferralCode]=useState(params.get('ref') || '');
  const [loading,setLoading]=useState(false);
  const nav=useNavigate();
  const { setAuth, user } = useAuth();

  if (user) return <Navigate to="/game" replace />;

  async function submit(e:any) {
    e.preventDefault();
    setLoading(true);
    try {
      const res=await api.post('/auth/register',{name,email,password, referralCode: referralCode.trim() || undefined});
      setAuth(res.data.user, res.data.token);
      pushToast(res.data.referralBonus ? `Welcome ${res.data.user.name}! ${res.data.referralBonus} referral bonus credited — top up to play` : `Welcome ${res.data.user.name}! Top up to start playing`,'success');
      nav('/game');
    } catch(err:any) {
      pushToast(err.response?.data?.error || err.response?.data?.details?.[0]?.msg || 'Register failed','error');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-center">
        <div className="hidden lg:block space-y-6 pr-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-600/15 border border-emerald-500/20 text-[11px] font-black tracking-[0.14em] text-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> BONUS ON EVERY TOP-UP
          </div>
          <div>
            <h1 className="font-display font-black tracking-tight leading-[0.9] text-5xl">
              JOIN THE<br />
              <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">CHROMA CLASH</span>
            </h1>
            <p className="mt-3 text-white/60 leading-relaxed max-w-md">
              Create your player profile. No email verification — top up and play with virtual coins. Lowest pot wins.
            </p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 p-4">
            <div className="text-xs font-black tracking-widest text-violet-200">HOW IT WORKS</div>
            <div className="mt-2 space-y-1.5 text-sm text-white/70 leading-relaxed">
              <div>1. Pick a chroma • 2. Bet coins • 3. Lowest total wins 2.0x (1.5x combos, 10% fee)</div>
              <div className="text-xs text-white/40">Tie-break: RED › GREEN › BLUE</div>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="w-full max-w-md mx-auto bg-[#13131f] border border-white/10 rounded-[1.5rem] p-6 sm:p-7 space-y-5 shadow-arena">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 grid place-items-center text-xl shadow-glow-violet">✦</div>
            <div>
              <h2 className="font-display font-bold text-xl leading-none">Create account</h2>
              <p className="text-white/60 text-xs mt-1">Top up to start playing</p>
            </div>
          </div>
          <div className="space-y-3">
            <label className="block text-xs font-bold tracking-widest text-white/70">NAME
              <input value={name} onChange={e=>setName(e.target.value)} className="mt-1.5 w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 text-base sm:text-sm" placeholder="Alex" />
            </label>
            <label className="block text-xs font-bold tracking-widest text-white/70">EMAIL
              <input value={email} onChange={e=>setEmail(e.target.value)} className="mt-1.5 w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 text-base sm:text-sm" placeholder="alex@demo.com" />
            </label>
            <label className="block text-xs font-bold tracking-widest text-white/70">PASSWORD
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1.5 w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 text-base sm:text-sm" placeholder="min 6 chars" />
            </label>
            <label className="block text-xs font-bold tracking-widest text-white/70">REFERRAL CODE <span className="text-white/30">(OPTIONAL)</span>
              <input value={referralCode} onChange={e=>setReferralCode(e.target.value.toUpperCase())} className="mt-1.5 w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 text-base sm:text-sm font-mono" placeholder="ARENA-XXXXXX" />
            </label>
            {referralCode.trim() && <div className="text-xs text-emerald-300">🎁 +{REFERRAL_RULES.refereeSignupBonus} referral bonus coins on signup</div>}
          </div>
          <button disabled={loading} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-black tracking-wide hover:opacity-95 disabled:opacity-50 shadow-glow-violet">
            {loading?'Creating...':'Create Account →'}
          </button>
          <div className="text-sm text-center text-white/60">Have account? <Link to="/login" className="text-violet-300 font-semibold underline decoration-violet-500/30">Login</Link></div>
          <div className="text-xs text-white/30 text-center">No real money, ever. Top up to play.</div>
        </form>
      </div>
    </div>
  );
}
