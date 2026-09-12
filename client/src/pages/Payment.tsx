import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../store/auth';
import { pushToast } from '../components/Toast';
import { Link } from 'react-router-dom';
import { REFERRAL_RULES, DEPOSIT_BONUS_TIERS, depositBonusFor } from '../utils/bonus';

export default function Payment() {
  const { user } = useAuth();
  const [myUpi, setMyUpi] = useState('');
  const [adminUpi, setAdminUpi] = useState<string | null>(null);
  const [amount, setAmount] = useState(500);
  const [agree, setAgree] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: myUpiData, refetch: refetchMy } = useQuery({
    queryKey: ['myUpi'],
    queryFn: async () => (await api.get('/payment/my-upi')).data,
  });
  useEffect(()=>{ if((myUpiData as any)?.upiId) setMyUpi((myUpiData as any).upiId); }, [myUpiData]);

  const { data: adminData } = useQuery({
    queryKey: ['adminUpi'],
    queryFn: async () => (await api.get('/payment/admin-upi')).data,
  });
  useEffect(()=>{ if((adminData as any)?.upiId !== undefined) setAdminUpi((adminData as any).upiId); }, [adminData]);

  const { data: myPayments, refetch: refetchPayments } = useQuery({
    queryKey: ['myPayments'],
    queryFn: async () => (await api.get('/payment/my')).data.items,
  });

  const { data: referral } = useQuery({
    queryKey: ['referral'],
    queryFn: async () => (await api.get('/user/referral')).data,
  });

  // Keep myUpi in sync
  if ((myUpiData as any)?.upiId && myUpi !== (myUpiData as any).upiId && !myUpi) {
    // initial load
  }

  const adminUpiVal = (adminData as any)?.upiId || adminUpi;
  const upiUrl = adminUpiVal ? `upi://pay?pa=${adminUpiVal}&pn=ColorArena&am=${amount}&cu=INR` : '';
  const qrUrl = upiUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUrl)}` : '';

  async function saveMyUpi() {
    if (!myUpi || !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(myUpi.trim().toLowerCase())) {
      pushToast('Invalid UPI ID (e.g., name@bank)', 'error');
      return;
    }
    try {
      await api.post('/payment/my-upi', { upiId: myUpi.trim().toLowerCase() });
      pushToast('UPI ID saved — QR updated', 'success');
      refetchMy();
    } catch (e: any) {
      pushToast(e.response?.data?.error || 'Failed', 'error');
    }
  }

  function onFile(e: any) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      pushToast('Only JPG/PNG/WEBP', 'error');
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      pushToast('Max 2MB — image too large', 'error');
      return;
    }
    // Quick client-side script check: read as text and look for <script
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = (reader.result as string) || '';
        if (/<\s*script|javascript:|onerror=|onload=/i.test(text.slice(0, 2000))) {
          pushToast('Invalid image — possible script detected', 'error');
          return;
        }
      } catch {}
      setFile(f);
      setPreview(URL.createObjectURL(f));
    };
    // For binary, reading first 2KB as text is enough for check
    reader.readAsText(f.slice(0, 2048));
  }

  async function submitPayment() {
    if (!adminUpiVal) {
      pushToast('Admin UPI not configured', 'error');
      return;
    }
    if (!amount || amount < 100 || amount > 50000) {
      pushToast('Amount 100—50000', 'error');
      return;
    }
    if (!file) {
      pushToast('Screenshot required', 'error');
      return;
    }
    if (!agree) {
      pushToast('Accept Policy & Terms', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('amount', String(amount));
      fd.append('agreePolicy', 'true');
      fd.append('screenshot', file);
      const res = await api.post('/payment/request', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      pushToast(`Request #${res.data.payment._id.slice(-6)} submitted — awaiting admin verification`, 'success');
      setFile(null);
      setPreview(null);
      refetchPayments();
    } catch (e: any) {
      pushToast(e.response?.data?.error || 'Failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    pushToast('Copied to clipboard', 'success');
  }

  async function shareUpi() {
    const text = adminUpiVal || '';
    if (navigator.share) {
      try { await navigator.share({ title: 'Color Arena UPI', text }); } catch {}
    } else {
      copy(text);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <div className="rounded-[1.5rem] bg-gradient-to-br from-[#13131f] to-[#1a1a2e] border border-white/10 p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_300px_at_20%_-10%,rgba(124,58,237,0.12),transparent_60%)] pointer-events-none" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-600/15 border border-emerald-500/20 text-[11px] font-black tracking-widest text-emerald-200">TOP-UP • MANUAL VERIFICATION</div>
            <h1 className="font-display font-black text-2xl sm:text-3xl mt-3 break-words">Add <span className="text-gradient-violet">Coins</span> <span className="text-sm font-semibold text-white/40">via UPI</span></h1>
            <p className="text-white/60 text-sm mt-1 max-w-xl">Pay via UPI to admin, upload screenshot, admin verifies amount and credits coins. Tampered/wrong screenshot = no credit & ban per policy.</p>
          </div>
          <div className="text-xs px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-200 font-bold">Balance: {user?.virtualBalance?.toLocaleString()} coins</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left: User UPI + Admin QR */}
        <div className="space-y-4">
          <div className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5">
            <h3 className="font-bold flex items-center gap-2"><span className="w-7 h-7 shrink-0 rounded-lg bg-violet-600 grid place-items-center text-sm">◈</span> Your UPI ID</h3>
            <p className="text-xs text-white/50 mt-1">Editable anytime — saved for admin payouts</p>
            <div className="mt-3 flex gap-2">
              <input value={myUpi} onChange={e=> setMyUpi(e.target.value)} placeholder="name@bank" className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 font-mono text-base sm:text-sm" />
              <button onClick={saveMyUpi} className="shrink-0 px-4 py-2 rounded-xl bg-white text-black font-bold text-sm">Save</button>
            </div>
            {myUpi && (
              <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 grid place-items-center text-white text-xs">UPI</span>
                <span className="font-mono text-sm font-bold flex-1 min-w-0 truncate">{myUpi}</span>
                <button onClick={()=> copy(myUpi)} className="shrink-0 px-3 py-1.5 rounded-full bg-white text-black text-xs font-bold">Copy</button>
                <button onClick={()=> navigator.share ? navigator.share({title:'My UPI', text: myUpi}) : copy(myUpi)} className="shrink-0 w-8 h-8 rounded-full bg-white/10 border border-white/15 grid place-items-center" title="Share">↗</button>
              </div>
            )}
          </div>

          <div className="bg-[#13131f] border border-amber-500/20 rounded-2xl p-4 sm:p-5">
            <h3 className="font-bold flex items-center gap-2"><span className="w-7 h-7 shrink-0 rounded-lg bg-amber-500 grid place-items-center text-sm">🤝</span> Refer & Earn</h3>
            <p className="text-xs text-white/50 mt-1">Friend gets <span className="text-white font-bold">+{REFERRAL_RULES.refereeSignupBonus}</span> on signup • You get <span className="text-white font-bold">+{REFERRAL_RULES.referrerFirstTopupReward.toLocaleString('en-IN')}</span> when their first top-up clears</p>
            {referral?.code ? (
              <>
                <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="font-mono text-sm font-bold flex-1 min-w-0 truncate tracking-widest">{referral.code}</span>
                  <button onClick={()=> copy(referral.code)} className="shrink-0 px-3 py-1.5 rounded-full bg-white text-black text-xs font-bold">Copy</button>
                  <button onClick={()=> navigator.share ? navigator.share({title:'Join Color Arena', text:`Join with my code ${referral.code} and get bonus coins!`}) : copy(referral.code)} className="shrink-0 w-8 h-8 rounded-full bg-white/10 border border-white/15 grid place-items-center" title="Share">↗</button>
                </div>
                <div className="mt-2 text-xs text-white/50">{referral.referredCount || 0} friends joined • {Number(referral.referralEarned || 0).toLocaleString('en-IN')} coins earned • <Link to="/referrals" className="underline text-violet-300">Open refer board →</Link></div>
              </>
            ) : (
              <div className="mt-3 text-xs text-white/40">Loading your code…</div>
            )}
          </div>

          <div className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5">
            <h3 className="font-bold">Admin UPI — Pay Here</h3>
            <p className="text-xs text-white/50 mt-1">Scan QR to pay admin (cross-display) — your own QR hidden</p>
            {adminUpiVal ? (
              <>
                <div className="mt-3 flex flex-col items-center p-3 sm:p-4 rounded-xl bg-white border min-w-0">
                  <img src={qrUrl} alt="Admin QR" className="w-48 h-48 sm:w-52 sm:h-52 max-w-[80vw] max-h-[80vw] aspect-square" />
                  <div className="mt-3 flex w-full min-w-0 flex-wrap items-center justify-center gap-2 font-mono text-sm font-bold text-black">
                    <span className="min-w-0 flex-1 basis-full text-center break-all sm:basis-auto sm:text-left">{adminUpiVal}</span>
                    <button onClick={()=> copy(adminUpiVal)} className="shrink-0 px-3 py-1 rounded-full bg-black text-white text-xs font-bold">Copy</button>
                    <button onClick={shareUpi} className="shrink-0 w-8 h-8 rounded-full bg-white border border-black/10 grid place-items-center" title="Share">↗</button>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-black/60"><span className="px-1.5 py-0.5 rounded bg-black text-white font-bold text-[10px]">UPI</span> Scan QR or copy • ₹{amount} prefilled</div>
                </div>
                <div className="mt-2 text-xs text-white/40 truncate">QR: <span className="font-mono">{upiUrl}</span></div>
              </>
            ) : (
              <div className="mt-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">Admin UPI not set yet. Contact support.</div>
            )}
          </div>
        </div>

        {/* Right: Payment request */}
        <div className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5 min-w-0">
          <h3 className="font-bold flex items-center gap-2"><span className="w-7 h-7 shrink-0 rounded-lg bg-emerald-600 grid place-items-center text-sm">₹</span> Request Top-up</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-bold tracking-widest text-white/70">AMOUNT (INR = COINS)</label>
              <div className="mt-1.5 flex flex-col min-[420px]:flex-row gap-2">
                <input type="number" value={amount} onChange={e=> setAmount(Math.max(0, parseInt(e.target.value)||0))} className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 font-mono text-base" min={100} max={50000} />
                <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 font-mono font-bold grid place-items-center shrink-0 whitespace-nowrap">≈ {amount} coins</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[500,1000,2000,5000].map(v=> <button key={v} onClick={()=> setAmount(v)} className={`px-3 py-1 rounded-full text-xs font-bold border ${amount===v?'bg-violet-600 border-violet-500':'bg-white/5 border-white/10'}`}>{v}</button>)}
              </div>
              {(() => {
                try {
                  const b = depositBonusFor(amount);
                  return b.bonusCoins > 0 ? (
                    <div className="mt-2 text-xs p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">
                      ⚡ Top-up bonus: <b>+{b.bonusCoins.toLocaleString('en-IN')} coins ({b.bonusPercent}%)</b> — you get ≈ {(amount + b.bonusCoins).toLocaleString('en-IN')} coins total
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-white/40">Top up ₹500+ to unlock bonus coins (up to +15%)</div>
                  );
                } catch { return null; }
              })()}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DEPOSIT_BONUS_TIERS.map(t => (
                  <span key={t.minAmount} className={`text-[11px] px-2 py-1 rounded-full border font-bold ${amount >= t.minAmount ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-white/50'}`}>₹{t.minAmount.toLocaleString('en-IN')}+ → +{t.bonusPercent}%</span>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold tracking-widest text-white/70">PAYMENT SCREENSHOT</label>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} className="mt-1.5 w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:bg-white file:text-black file:font-bold file:border-0 file:cursor-pointer bg-black/30 border border-white/10 rounded-xl p-2" />
              {preview && <img src={preview} alt="preview" className="mt-3 w-full max-h-64 object-contain rounded-xl border border-white/10 bg-black/20" />}
              <div className="text-[11px] text-white/40 mt-1">JPG/PNG/WEBP, max 2MB. Must clearly show amount {amount} and UPI {adminUpiVal || '—'} — scripts blocked</div>
            </div>

            <label className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/10">
              <input type="checkbox" checked={agree} onChange={e=> setAgree(e.target.checked)} className="mt-1" />
              <span className="text-xs leading-relaxed text-white/80">I agree to <Link to="/policy" className="underline text-violet-300">Policy & Terms</Link>. I understand tampered/wrong screenshot = no credit and ban. Amount in screenshot must equal {amount}.</span>
            </label>

            <button onClick={submitPayment} disabled={submitting || !agree} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-black tracking-wide disabled:opacity-40">
              {submitting ? 'Submitting...' : 'Submit for Verification →'}
            </button>

            <div className="text-xs p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 leading-relaxed">
              ⚠️ <b>Policy:</b> If screenshot is tampered, edited, or amount mismatch, coins will <b>NOT</b> be credited and account will be <b>banned</b> per <Link to="/policy" className="underline">Policy</Link>.
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-bold text-sm">My Requests</h4>
            <div className="mt-2 space-y-2 max-h-[260px] overflow-auto pr-1">
              {(myPayments||[]).map((p:any)=>(
                <div key={p._id} className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs">
                  <div>
                    <div className="font-mono font-bold">₹{p.amount} • {p.status}</div>
                    <div className="text-white/50">{new Date(p.createdAt).toLocaleString()}</div>
                  </div>
                  <span className={`px-2 py-1 rounded-full font-bold text-[11px] ${p.status==='PENDING'?'bg-amber-500/20 text-amber-300': p.status==='APPROVED'?'bg-emerald-500/20 text-emerald-300':'bg-red-500/20 text-red-300'}`}>{p.status}</span>
                </div>
              ))}
              {!myPayments?.length && <div className="text-xs text-white/40 py-4 text-center">No requests yet</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
