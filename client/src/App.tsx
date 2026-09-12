import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useEffect } from 'react';
import Header from './components/Header';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Game from './pages/Game';
import History from './pages/History';
import Admin from './pages/Admin';
import Payment from './pages/Payment';
import Referrals from './pages/Referrals';
import Policy from './pages/Policy';
import { useAuth } from './store/auth';
import { ToastContainer } from './components/Toast';
import { useSupportTelegram } from './components/SupportLine';

function Protected({ children, admin }: { children: JSX.Element; admin?: boolean }) {
  const { user, hydrated } = useAuth();
  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-white/60">Loading arena...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/game" replace />;
  return children;
}

function FooterSupport() {
  const telegram = useSupportTelegram();
  if (!telegram) return null;
  return (
    <>
      <a href={telegram} target="_blank" rel="noreferrer" className="underline hover:text-white">Support (Telegram)</a>
      <span>•</span>
    </>
  );
}

export default function App() {
  const init = useAuth((s) => s.init);
  const hydrated = useAuth((s) => s.hydrated);
  useEffect(() => {
    init();
  }, [init]);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a12] text-white/60">
        Loading...
      </div>
    );
  }
  return (
    <BrowserRouter>
      <Header />
      <ToastContainer />
      <main className="min-h-[calc(100vh-64px)] overflow-x-clip">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/game" element={<Protected><Game /></Protected>} />
          <Route path="/history" element={<Protected><History /></Protected>} />
          <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
          <Route path="/payment" element={<Protected><Payment /></Protected>} />
          <Route path="/referrals" element={<Protected><Referrals /></Protected>} />
          <Route path="/policy" element={<Policy />} />
          <Route path="*" element={<div className="p-10 text-center text-white/60">Not found</div>} />
        </Routes>
      </main>
      <footer className="border-t border-white/10 py-6 px-4 text-center text-xs text-white/30 space-y-2">
        <div className="max-w-4xl mx-auto break-words leading-relaxed">Color Arena • Virtual coins have no real value • Payout 2.0x singles • 1.5x combos • 10% platform fee • Tie-break RED &gt; GREEN &gt; BLUE</div>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          <Link to="/policy" className="underline hover:text-white">Policy & Terms</Link>
          <span>•</span>
          <Link to="/payment" className="underline hover:text-white">Wallet / UPI</Link>
          <span>•</span>
          <FooterSupport />
          <span>UPI QR shareable • Manual verification</span>
        </div>
      </footer>
    </BrowserRouter>
  );
}
