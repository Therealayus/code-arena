import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { formatCoins } from '../utils/format';
import { COLOR_META, Color, COLORS } from '../types';
import { useState, useEffect } from 'react';
import { pushToast } from '../components/Toast';
import { depositBonusFor } from '../utils/bonus';

export default function Admin() {
  const qc=useQueryClient();
  const { data: stats } = useQuery({ queryKey:['adminStats'], queryFn: async()=> (await api.get('/admin/stats')).data, refetchInterval:5000 });
  const { data: users } = useQuery({ queryKey:['adminUsers'], queryFn: async()=> (await api.get('/admin/users?limit=20')).data });
  const [adjust, setAdjust]=useState<{id:string; amount:string}>({id:'',amount:''});
  const [pwReset, setPwReset]=useState<{id:string; name:string; password:string}>({id:'',name:'',password:''});
  const [banForm, setBanForm]=useState<{id:string; name:string; banned:boolean; reason:string}>({id:'',name:'',banned:true,reason:''});
  const [adminUpi, setAdminUpi]=useState('');
  const [adminTg, setAdminTg]=useState('');
  const [selectedPay, setSelectedPay]=useState<any>(null);
  const [banCheck, setBanCheck]=useState(false);
  const [note, setNote]=useState('');
  const [qrUser, setQrUser]=useState<any>(null);

  const { data: adminUpiData, refetch: refetchAdminUpi } = useQuery({
    queryKey:['adminUpiAdmin'],
    queryFn: async()=> (await api.get('/payment/admin/manage-upi')).data,
  });
  useEffect(()=>{ if((adminUpiData as any)?.upiId !== undefined) setAdminUpi((adminUpiData as any).upiId||''); }, [adminUpiData]);

  const { data: supportData, refetch: refetchSupport } = useQuery({
    queryKey:['adminSupport'],
    queryFn: async()=> (await api.get('/admin/support')).data,
  });
  useEffect(()=>{ if((supportData as any)?.telegram !== undefined) setAdminTg((supportData as any).telegram||''); }, [supportData]);

  const { data: payments, refetch: refetchPays } = useQuery({
    queryKey:['adminPays'],
    queryFn: async()=> (await api.get('/payment/admin/list')).data.items,
    refetchInterval: 7000,
  });

  const mute=useMutation({
    mutationFn: async()=> {
      const res=await api.post(`/admin/users/${adjust.id}/balance`, { amount: parseInt(adjust.amount), reason: 'Admin manual adjustment' });
      return res.data;
    },
    onSuccess: ()=> { pushToast('Balance adjusted','success'); qc.invalidateQueries({queryKey:['adminUsers']}); qc.invalidateQueries({queryKey:['adminStats']}); setAdjust({id:'',amount:''}); },
    onError:(e:any)=> pushToast(e.response?.data?.error ||'Failed','error')
  });

  const saveUpiMut = useMutation({
    mutationFn: async()=> {
      const res = await api.post('/payment/admin/manage-upi', { upiId: adminUpi.trim().toLowerCase() });
      return res.data;
    },
    onSuccess: ()=> { pushToast('Admin UPI saved — QR updated everywhere','success'); refetchAdminUpi(); },
    onError:(e:any)=> pushToast(e.response?.data?.error||'Invalid UPI','error')
  });

  const saveTgMut = useMutation({
    mutationFn: async()=> {
      const res = await api.post('/admin/support', { telegram: adminTg.trim() });
      return res.data;
    },
    onSuccess: (d)=> { pushToast('Support link saved — visible on login page','success'); setAdminTg(d.telegram || ''); refetchSupport(); },
    onError:(e:any)=> pushToast(e.response?.data?.error||'Invalid link','error')
  });

  const pwResetMut = useMutation({
    mutationFn: async()=> {
      const res = await api.post(`/admin/users/${pwReset.id}/reset-password`, { newPassword: pwReset.password });
      return res.data;
    },
    onSuccess: ()=> { pushToast(`Password reset for ${pwReset.name}`, 'success'); setPwReset({id:'',name:'',password:''}); },
    onError:(e:any)=> pushToast(e.response?.data?.error||'Reset failed','error')
  });

  const banMut = useMutation({
    mutationFn: async()=> {
      const res = await api.post(`/admin/users/${banForm.id}/ban`, { banned: banForm.banned, reason: banForm.reason });
      return res.data;
    },
    onSuccess: (d)=> { pushToast(d.isBanned ? `${banForm.name} banned` : `${banForm.name} unbanned`, d.isBanned ? 'error' : 'success'); setBanForm({id:'',name:'',banned:true,reason:''}); qc.invalidateQueries({queryKey:['adminUsers']}); },
    onError:(e:any)=> pushToast(e.response?.data?.error||'Failed','error')
  });

  const verifyMut = useMutation({
    mutationFn: async({id, action}:{id:string; action:'approve'|'reject'})=>{
      const res = await api.post(`/payment/admin/${id}/verify`, { action, note, banUser: banCheck });
      return res.data;
    },
    onSuccess: ()=> { pushToast('Verified','success'); refetchPays(); qc.invalidateQueries({queryKey:['adminStats']}); setSelectedPay(null); setBanCheck(false); setNote(''); },
    onError:(e:any)=> pushToast(e.response?.data?.error||'Failed','error')
  });

  const cur=stats?.currentRound;
  const totals: Record<string,number> = cur?.colorTotals || {};

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <div className="rounded-[1.5rem] bg-gradient-to-br from-[#13131f] to-[#1a1a2e] border border-white/10 p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_500px_300px_at_90%_-20%,rgba(124,58,237,0.15),transparent_60%)] pointer-events-none" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/20 text-[11px] font-black tracking-[0.14em] text-amber-200">CONTROL CENTER • READ-ONLY WINNER</div>
            <h1 className="font-display font-black tracking-tight text-2xl sm:text-3xl mt-3 break-words">Admin <span className="text-gradient-violet">Dashboard</span> <span className="text-sm font-semibold text-white/30 align-middle">virtual coins</span></h1>
            <p className="text-white/50 text-xs mt-1">Monitor rounds, volume, and player balances. Winner cannot be changed after bets — deterministic.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 grid place-items-center shadow-glow-violet">⚙️</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          {label:'Total Users', value: stats?.totalUsers ?? '—', sub:'players'},
          {label:'Total Coins', value: stats ? formatCoins(stats.totalVirtualCoins ?? 0) : '—', sub:'users balance'},
          {label:'Total Rounds', value: stats?.totalRounds ?? '—'},
          {label:'Total Bets', value: stats?.totalBets ?? '—'},
          {label:'Total Volume', value: stats ? formatCoins(stats.totalBetAmount) : '—', sub:'coins bet'},
        ].map(k=>(
          <div key={k.label} className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5 min-w-0">
            <div className="text-xs tracking-widest font-bold text-white/50 truncate">{k.label}</div>
            <div className="text-xl sm:text-2xl font-extrabold mt-1 truncate">{k.value} <span className="text-sm font-normal text-white/40">{(k as any).sub||''}</span></div>
          </div>
        ))}
      </div>

      {/* Admin UPI + Payments */}
      <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4 sm:gap-6">
        <div className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5">
          <h3 className="font-bold flex items-center gap-2">Admin UPI <span className="text-xs font-normal text-white/50">for receiving payments</span></h3>
          <p className="text-xs text-white/50 mt-1">Editable anytime — shown to users as UPI ID</p>
          <div className="mt-3 flex gap-2">
            <input value={adminUpi} onChange={e=> setAdminUpi(e.target.value)} placeholder="admin@oksbi" className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 font-mono text-sm" />
            <button onClick={()=> saveUpiMut.mutate()} className="shrink-0 px-4 py-2 rounded-xl bg-violet-600 font-bold text-sm">Save</button>
          </div>
          {adminUpi && (
            <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="w-8 h-8 rounded-lg bg-white text-black grid place-items-center text-xs">UPI</span>
              <span className="font-mono text-sm font-bold flex-1 truncate">{adminUpi}</span>
              <button onClick={()=> {navigator.clipboard.writeText(adminUpi); pushToast('Copied','success')}} className="px-3 py-1.5 rounded-full bg-white text-black text-xs font-bold">Copy</button>
              <button onClick={()=> { if(navigator.share) navigator.share({title:'Admin UPI', text: adminUpi}); else {navigator.clipboard.writeText(adminUpi); pushToast('Copied','success')} }} className="w-8 h-8 rounded-full bg-white/10 border border-white/15 grid place-items-center" title="Share">↗</button>
            </div>
          )}
          <div className="mt-3 text-xs text-white/40">Shown on <span className="text-white">/payment</span> as UPI ID + copy/share. Users pay here.</div>
          {!(adminUpiData as any)?.upiId && <div className="mt-2 text-xs p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200">Set UPI to enable top-ups</div>}

          <div className="mt-5 pt-4 border-t border-white/10">
            <h3 className="font-bold flex items-center gap-2">Support Contact <span className="text-xs font-normal text-white/50">Telegram for password-reset help</span></h3>
            <p className="text-xs text-white/50 mt-1">Shown on the login page — locked-out users contact you here</p>
            <div className="mt-3 flex gap-2">
              <input value={adminTg} onChange={e=> setAdminTg(e.target.value)} placeholder="https://t.me/yourname or @yourname" className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 font-mono text-sm" />
              <button onClick={()=> saveTgMut.mutate()} className="shrink-0 px-4 py-2 rounded-xl bg-violet-600 font-bold text-sm">Save</button>
            </div>
            {adminTg && <a href={adminTg.startsWith('http') ? adminTg : `https://t.me/${adminTg.replace(/^@/, '')}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-violet-300 underline break-all">{adminTg}</a>}
          </div>
        </div>

        <div className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Payment Requests</h3>
            <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">{payments?.filter((p:any)=>p.status==='PENDING').length || 0} PENDING</span>
          </div>
          <div className="mt-3 space-y-2 max-h-[380px] overflow-auto pr-1">
            {(payments||[]).map((p:any)=>(
              <div key={p._id} className="p-3 rounded-xl bg-black/20 border border-white/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-bold text-sm break-words">₹{p.amount} • <span className={`px-1.5 py-0.5 rounded text-[11px] ${p.status==='PENDING'?'bg-amber-500/20 text-amber-300': p.status==='APPROVED'?'bg-emerald-500/20 text-emerald-300':'bg-red-500/20 text-red-300'}`}>{p.status}</span></div>
                    <div className="text-xs text-white/60 break-words">{p.userId?.name} • {p.userId?.email} • UPI {p.userId?.upiId || '—'} • Bal {formatCoins(p.userId?.virtualBalance||0)}</div>
                    <div className="text-xs text-white/40 break-words">{new Date(p.createdAt).toLocaleString()} • {p.upiId}</div>
                  </div>
                  <button onClick={()=> setSelectedPay(p)} className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-white text-black font-bold">View</button>
                </div>
              </div>
            ))}
            {!payments?.length && <div className="text-xs text-white/40 py-6 text-center">No requests</div>}
          </div>
        </div>
      </div>

      {cur && (
        <div className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold break-words">Current Round #{cur.roundNumber} <span className={`ml-2 text-xs px-2 py-1 rounded-full ${cur.status==='BETTING_OPEN'?'bg-emerald-500':'bg-amber-500'} text-black font-bold`}>{cur.status}</span></h3>
            <span className="text-sm text-white/60">Closes: {new Date(cur.bettingCloseTime).toLocaleTimeString()}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {COLORS.map(c=>(
              <div key={c} className="p-3 rounded-xl bg-black/30 border border-white/5 text-center min-w-0">
                <div className="text-xs font-bold truncate">{COLOR_META[c as Color].emoji} {c}</div>
                <div className="font-mono font-bold mt-1 truncate">{formatCoins((totals as any)[c] || 0)}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm text-white/60 break-words">Total pot: {formatCoins(cur.totalBetAmount)} • Bets: {cur.totalBetsCount} {cur.winningColor && <>• Winner: <span className="font-bold text-white">{cur.winningColor}</span></>}</div>
          {cur.tieBreakReason && <div className="mt-2 text-xs p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 break-words">{cur.tieBreakReason}</div>}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5">
          <h3 className="font-bold">Recent Rounds</h3>
          <div className="mt-3 space-y-2 max-h-[400px] overflow-auto pr-1">
            {(stats?.recentRounds||[]).map((r:any)=>(
              <div key={r._id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-black/20 border border-white/5 text-sm min-w-0">
                <span className="font-mono text-xs shrink-0">#{r.roundNumber} {r.status}</span>
                <span className="font-bold truncate text-center flex-1 min-w-0">{r.winningColor ? `${COLOR_META[r.winningColor as Color]?.emoji || ''} ${r.winningColor}` : cur?.status==='BETTING_OPEN'?'— betting —': 'pending'}</span>
                <span className="hidden min-[380px]:block text-xs text-white/50 shrink-0">{formatCoins(r.totalBetAmount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5">
          <h3 className="font-bold">Users & Balance Mgmt <span className="text-xs font-normal text-white/40">(admin excluded)</span></h3>
          <div className="mt-3 space-y-2 max-h-[400px] overflow-auto pr-1">
            {(users?.items||[]).map((u:any)=>(
              <div key={u._id} className="p-3 rounded-xl bg-black/20 border border-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm flex items-center gap-2 truncate">{u.name} <span className="text-xs font-normal text-white/50 truncate">{u.email}</span> {u.isBanned && <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">BANNED</span>}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10 font-mono truncate">{u.upiId || 'No UPI'}</span>
                      {u.upiId && <button onClick={()=> {navigator.clipboard.writeText(u.upiId); pushToast('Copied','success')}} className="text-[11px] px-2 py-1 rounded-full bg-white text-black font-bold shrink-0">Copy</button>}
                    </div>
                    {u.upiId && <div className="mt-2 flex items-center gap-2"><img onClick={()=> setQrUser(u)} src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`upi://pay?pa=${u.upiId}&pn=${encodeURIComponent(u.name)}`)}`} alt="User QR" className="w-20 h-20 rounded-lg border border-white/10 bg-white p-1 cursor-pointer hover:scale-[1.03] hover:shadow-lg transition-transform" title="Click to enlarge" /><span className="text-[11px] text-white/40">Click QR to enlarge • Scan to pay</span></div>}
                    {u.isBanned && <div className="text-xs text-red-300 mt-1">Ban: {u.banReason}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-amber-300 text-sm">{formatCoins(u.virtualBalance)}</div>
                    <button onClick={()=> setAdjust({id:u._id, amount:''})} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 mt-2">Adjust</button>
                    <button onClick={()=> setPwReset({id:u._id, name:u.name, password:''})} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 mt-1 ml-1">Reset PW</button>
                    {u.isBanned
                      ? <button onClick={()=> setBanForm({id:u._id, name:u.name, banned:false, reason:''})} className="text-xs px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 mt-1 ml-1 font-bold">Unban</button>
                      : <button onClick={()=> setBanForm({id:u._id, name:u.name, banned:true, reason:''})} className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500 mt-1 ml-1 font-bold">Ban</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {adjust.id && (
            <div className="mt-4 p-4 rounded-xl bg-black/40 border border-violet-500/30">
              <div className="text-sm font-bold">Adjust balance for {adjust.id.slice(-6)}</div>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <input type="number" value={adjust.amount} onChange={e=> setAdjust({...adjust, amount:e.target.value})} placeholder="+5000 or -2000" className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none text-base sm:text-sm" />
                <div className="flex gap-2">
                  <button onClick={()=> mute.mutate()} className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-violet-600 font-bold">Apply</button>
                  <button onClick={()=> setAdjust({id:'', amount:''})} className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-white/10">Cancel</button>
                </div>
              </div>
              <div className="text-xs text-white/50 mt-1">Positive to credit, negative to debit. Creates ADMIN_ADJUST transaction.</div>
            </div>
          )}

          <div className="mt-4 text-xs p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
            Admin cannot secretly change winner after seeing bets — winner is computed automatically and cannot be changed.
          </div>

          {pwReset.id && (
            <div className="mt-4 p-4 rounded-xl bg-black/40 border border-amber-500/30">
              <div className="text-sm font-bold">Reset password for {pwReset.name}</div>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <input type="text" value={pwReset.password} onChange={e=> setPwReset({...pwReset, password:e.target.value})} placeholder="New password (min 6 chars)" className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none text-base sm:text-sm" />
                <div className="flex gap-2">
                  <button onClick={()=> pwResetMut.mutate()} className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-amber-500 text-black font-bold">Set Password</button>
                  <button onClick={()=> setPwReset({id:'',name:'',password:''})} className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-white/10">Cancel</button>
                </div>
              </div>
              <div className="text-xs text-white/50 mt-1">User must be told the new password manually (e.g., via Telegram).</div>
            </div>
          )}

          {banForm.id && (
            <div className="mt-4 p-4 rounded-xl bg-black/40 border border-red-500/30">
              <div className="text-sm font-bold">{banForm.banned ? `Ban ${banForm.name}` : `Unban ${banForm.name}`} <span className="text-xs font-normal text-white/50">— takes effect immediately</span></div>
              {banForm.banned && (
                <input type="text" value={banForm.reason} onChange={e=> setBanForm({...banForm, reason:e.target.value})} placeholder="Reason (shown to user)" className="mt-2 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 outline-none text-base sm:text-sm" />
              )}
              <div className="flex gap-2 mt-2">
                <button onClick={()=> banMut.mutate()} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold ${banForm.banned ? 'bg-red-600' : 'bg-emerald-600'}`}>{banForm.banned ? 'Ban Account' : 'Unban Account'}</button>
                <button onClick={()=> setBanForm({id:'',name:'',banned:true,reason:''})} className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-white/10">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
      {selectedPay && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={()=> setSelectedPay(null)}>
          <div onClick={e=> e.stopPropagation()} className="w-full max-w-lg bg-[#13131f] border border-white/10 rounded-2xl p-4 sm:p-5 max-h-[90vh] overflow-auto">
            <h3 className="font-bold">Verify Payment #{selectedPay._id.slice(-6)} — ₹{selectedPay.amount}</h3>
            <div className="text-xs text-white/60">User: {selectedPay.userId?.name} ({selectedPay.userId?.email}) • UPI: {selectedPay.upiId} • Current bal: {formatCoins(selectedPay.userId?.virtualBalance||0)}</div>
            {(() => {
              try {
                const b = depositBonusFor(selectedPay.amount);
                return b.bonusCoins > 0 ? (
                  <div className="mt-2 text-xs p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 break-words">Approving credits ₹{selectedPay.amount} + {b.bonusCoins.toLocaleString('en-IN')} bonus ({b.bonusPercent}%) = {(selectedPay.amount + b.bonusCoins).toLocaleString('en-IN')} coins</div>
                ) : null;
              } catch { return null; }
            })()}
            <img src={`/api/payment/screenshot/${selectedPay.screenshotPath}`} alt="screenshot" className="mt-3 w-full max-h-80 object-contain rounded-xl border border-white/10 bg-black/30" onError={(e:any)=> e.currentTarget.src='https://via.placeholder.com/400x300?text=No+Image'} />
            <div className="mt-3 text-xs text-white/50">File: {selectedPay.screenshotOriginalName} • Uploaded: {new Date(selectedPay.createdAt).toLocaleString()}</div>
            <textarea value={note} onChange={e=> setNote(e.target.value)} placeholder="Admin note (reason)..." className="mt-3 w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 outline-none text-sm" rows={2} />
            <label className="mt-3 flex items-center gap-2 p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs">
              <input type="checkbox" checked={banCheck} onChange={e=> setBanCheck(e.target.checked)} />
              <span className="text-red-200">Tampered/wrong amount → Ban user (per Policy)</span>
            </label>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button onClick={()=> verifyMut.mutate({id:selectedPay._id, action:'approve'})} className="flex-1 py-2.5 px-2 rounded-xl bg-emerald-600 font-bold text-sm break-words">Approve & Credit + Bonus</button>
              <button onClick={()=> verifyMut.mutate({id:selectedPay._id, action:'reject'})} className="flex-1 py-2.5 px-2 rounded-xl bg-red-600 font-bold text-sm">Reject {banCheck ? '& Ban' : ''}</button>
            </div>
            <button onClick={()=> setSelectedPay(null)} className="mt-2 w-full py-2 rounded-xl bg-white/10">Close</button>
            <div className="mt-2 text-[11px] text-white/40">Policy: Amount in screenshot must equal {selectedPay.amount}. If tampered → no credit + ban.</div>
          </div>
        </div>
      )}

      {qrUser && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={()=> setQrUser(null)}>
          <div onClick={e=> e.stopPropagation()} className="bg-white rounded-[1.5rem] p-4 sm:p-6 flex flex-col items-center max-w-sm w-full shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 grid place-items-center text-white">◈</div>
            <h3 className="font-display font-bold text-lg mt-3 text-black">Pay {qrUser.name}</h3>
            <p className="font-mono text-sm font-bold text-black/70">{qrUser.upiId}</p>
            <p className="text-xs text-black/50">{qrUser.email} • {formatCoins(qrUser.virtualBalance)} coins</p>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(`upi://pay?pa=${qrUser.upiId}&pn=${encodeURIComponent(qrUser.name)}`)}`} alt="Big QR" className="w-64 h-64 sm:w-72 sm:h-72 max-w-[80vw] max-h-[80vw] mt-4 rounded-2xl border-2 border-black/5 bg-white p-2 aspect-square" />
            <div className="mt-4 flex gap-2 w-full">
              <button onClick={()=> {navigator.clipboard.writeText(qrUser.upiId); pushToast('Copied','success')}} className="flex-1 py-2.5 rounded-xl bg-black text-white font-bold">Copy UPI</button>
              <button onClick={()=> setQrUser(null)} className="flex-1 py-2.5 rounded-xl bg-white border-2 border-black/10 text-black font-bold">Close</button>
            </div>
            <p className="text-[11px] text-black/40 mt-2">Click outside to close • Scan with any UPI app</p>
          </div>
        </div>
      )}
    </>
  );
}
