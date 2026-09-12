import { useEffect, useState } from 'react';

type Toast = { id:number; msg:string; type:'success'|'error'|'info' };
let listeners: ((t:Toast[])=>void)[] = [];
let toasts: Toast[] = [];
let id=0;
export function pushToast(msg:string, type:Toast['type']='info') {
  const t={id:++id, msg, type};
  toasts=[...toasts, t];
  listeners.forEach(l=>l(toasts));
  setTimeout(()=> {
    toasts=toasts.filter(x=>x.id!==t.id);
    listeners.forEach(l=>l(toasts));
  }, 3200);
}

export function ToastContainer() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(()=>{
    const fn=(t:Toast[])=>setList([...t]);
    listeners.push(fn);
    return ()=> { listeners=listeners.filter(l=>l!==fn); };
  },[]);
  return (
    <div className="fixed top-20 sm:top-16 left-4 right-4 sm:left-auto sm:right-4 z-[100] flex flex-col gap-2 pointer-events-none sm:max-w-[92vw]">
      {list.map(t=>(
        <div key={t.id} className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold leading-snug backdrop-blur-xl break-words ${t.type==='success'?'bg-emerald-600/90 border-emerald-500/50 text-white shadow-emerald-900/20': t.type==='error'?'bg-red-600/90 border-red-500/50 text-white shadow-red-900/20':'bg-zinc-800/90 border-white/10 text-white'}`}>
          <span className={`mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full ${t.type==='success'?'bg-white': t.type==='error'?'bg-white':'bg-violet-400'} animate-pulse`} />
          <span className="min-w-0 flex-1 break-words">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
