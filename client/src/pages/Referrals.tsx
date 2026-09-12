import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { pushToast } from '../components/Toast';
import { REFERRAL_RULES } from '../utils/bonus';

export default function Referrals() {
  const { data: stats } = useQuery({
    queryKey: ['referral'],
    queryFn: async () => (await api.get('/user/referral')).data,
  });
  const { data: friends } = useQuery({
    queryKey: ['referredFriends'],
    queryFn: async () => (await api.get('/user/referrals')).data.items,
  });

  const code: string = stats?.code || '';
  const inviteLink = code ? `${window.location.origin}/register?ref=${code}` : '';

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    pushToast('Copied to clipboard', 'success');
  }

  async function share() {
    const text = `Join me on Color Arena with my code ${code} and get ${REFERRAL_RULES.refereeSignupBonus} bonus coins free! ${inviteLink}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Join Color Arena', text }); } catch {}
    } else {
      copy(text);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">
      <div className="rounded-[1.5rem] bg-gradient-to-br from-[#13131f] to-[#1a1a2e] border border-amber-500/20 p-4 sm:p-6 lg:p-7 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_300px_at_20%_-10%,rgba(245,158,11,0.12),transparent_60%)] pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/20 text-[11px] font-black tracking-[0.14em] text-amber-200">🤝 REFER & EARN</div>
          <h1 className="font-display font-black tracking-tight text-2xl sm:text-3xl mt-3">Invite Friends, <span className="text-gradient-violet">Earn Coins</span></h1>
          <p className="text-white/60 text-sm mt-1.5 max-w-xl">
            Your friend gets <span className="text-white font-bold">+{REFERRAL_RULES.refereeSignupBonus} coins</span> on signup.
            You get <span className="text-white font-bold">+{REFERRAL_RULES.referrerFirstTopupReward.toLocaleString('en-IN')} coins</span> when their first top-up clears.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Friends joined', value: String(stats?.referredCount ?? '—') },
          { label: 'Coins earned', value: Number(stats?.referralEarned || 0).toLocaleString('en-IN') },
          { label: 'Reward per friend', value: `+${REFERRAL_RULES.referrerFirstTopupReward.toLocaleString('en-IN')}` },
        ].map((s) => (
          <div key={s.label} className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5 text-center min-w-0">
            <div className="text-xs tracking-widest font-bold text-white/50 truncate">{s.label}</div>
            <div className="text-2xl font-extrabold mt-1 text-amber-300 truncate">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5">
        <h3 className="font-bold">Your invite code</h3>
        {code ? (
          <>
            <div className="mt-3 flex items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10">
              <span className="font-mono text-lg sm:text-xl font-black flex-1 min-w-0 truncate tracking-[0.2em] text-center">{code}</span>
              <button onClick={() => copy(code)} className="shrink-0 px-4 py-2 rounded-full bg-white text-black text-xs font-bold">Copy</button>
              <button onClick={share} className="shrink-0 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-xs font-bold">Share</button>
            </div>
            <button onClick={() => copy(inviteLink)} className="mt-2 block w-full text-left text-xs text-white/50 hover:text-white truncate max-w-full">
              Invite link: <span className="font-mono underline">{inviteLink}</span>
            </button>
          </>
        ) : (
          <div className="mt-3 text-sm text-white/40">Loading your code…</div>
        )}
        <div className="mt-4 grid sm:grid-cols-3 gap-2 text-xs">
          {['1. Share your code or link', '2. Friend joins (+500 coins)', '3. You earn +1,000 on their first top-up'].map((s) => (
            <div key={s} className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/70 font-semibold">{s}</div>
          ))}
        </div>
      </div>

      <div className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5">
        <h3 className="font-bold">Friends you invited</h3>
        <div className="mt-3 space-y-2 max-h-[300px] overflow-auto pr-1">
          {(friends || []).map((f: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5 text-sm">
              <div className="min-w-0">
                <div className="font-bold truncate">{f.name}</div>
                <div className="text-xs text-white/40">Joined {new Date(f.joinedAt).toLocaleDateString()}</div>
              </div>
              <span className={`shrink-0 text-[11px] px-2 py-1 rounded-full font-bold ${f.toppedUp ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50'}`}>
                {f.toppedUp ? '✓ Reward earned' : 'Waiting for top-up'}
              </span>
            </div>
          ))}
          {!friends?.length && <div className="text-sm text-white/40 text-center py-6">No invites yet — share your code to start earning. <Link to="/game" className="underline text-violet-300">Back to Arena</Link></div>}
        </div>
      </div>
    </div>
  );
}
