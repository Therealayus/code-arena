import { Link } from 'react-router-dom';

export default function Policy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="rounded-[1.5rem] bg-[#13131f] border border-white/10 p-4 sm:p-6 lg:p-8">
        <h1 className="font-display font-black text-2xl sm:text-3xl">Policy & <span className="text-gradient-violet">Terms</span></h1>
        <p className="text-white/60 text-sm mt-1">Last updated: 8 Sep 2026 • Color Arena</p>

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-white/80">
          <section>
            <h2 className="font-bold text-white">1. Virtual Coins</h2>
            <p>All coins are virtual coins with no real monetary value. No cash-out, no real-money gambling. This is a play-money game for entertainment.</p>
          </section>
          <section>
            <h2 className="font-bold text-white">2. UPI Top-up (Manual Verification)</h2>
            <p>To request coins: pay via UPI to the admin UPI shown on <Link to="/payment" className="underline text-violet-300">Payment</Link> page, then upload a clear screenshot showing amount, UPI IDs, and transaction status. Admin will manually verify the screenshot matches the requested amount.</p>
          </section>
          <section>
            <h2 className="font-bold text-white">3. Screenshot Policy</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Amount in screenshot must exactly equal requested amount.</li>
              <li>Screenshot must be unedited, original, and clearly readable.</li>
              <li>Cropped/blurred/tampered/edited screenshots will be rejected.</li>
              <li>Do not upload repeated or fake screenshots.</li>
            </ul>
          </section>
          <section>
            <h2 className="font-bold text-white">4. Tampering & Ban</h2>
            <p className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200">If you tamper, edit, or submit a wrong-amount screenshot, your request will <b>NOT</b> be credited and your account will be <b>banned</b> (isBanned=true, banReason recorded). Banned accounts cannot login, bet, or request payments. Contact support to appeal.</p>
          </section>
          <section>
            <h2 className="font-bold text-white">5. Admin Verification</h2>
            <p>Admin checks: amount equality, UPI match, screenshot clarity. Approved → coins credited instantly (game multipliers not applied; top-up is 1:1). Rejected → no credit, reason noted. If banUser is checked, account banned.</p>
          </section>
          <section>
            <h2 className="font-bold text-white">6. UPI IDs & QR</h2>
            <p>Your saved UPI ID generates a shareable QR (`upi://pay?pa=...`). Admin UPI QR is also shareable/copyable. Keep UPI IDs accurate. Format: `name@bank` (e.g., `colorarena@oksbi`).</p>
          </section>
          <section>
            <h2 className="font-bold text-white">7. Liability</h2>
            <p>We are not liable for failed UPI transfers outside the game. Only verified in-app requests are credited.</p>
          </section>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link to="/payment" className="px-5 py-2.5 rounded-full bg-violet-600 font-bold text-sm text-center">Go to Payment</Link>
          <Link to="/game" className="px-5 py-2.5 rounded-full bg-white/10 border border-white/10 font-bold text-sm text-center">Back to Arena</Link>
        </div>
      </div>
    </div>
  );
}
