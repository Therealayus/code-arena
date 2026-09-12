import { useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { pushToast } from './Toast';

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: any) {
    e.preventDefault();
    if (newPassword.length < 6) {
      pushToast('New password must be at least 6 chars', 'error');
      return;
    }
    if (newPassword !== confirm) {
      pushToast('New passwords do not match', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/user/change-password', { currentPassword, newPassword });
      pushToast('Password changed successfully', 'success');
      onClose();
    } catch (err: any) {
      pushToast(err.response?.data?.error || 'Change failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Portal out of the sticky blurred header: backdrop-filter on an ancestor
  // would otherwise trap `fixed` positioning and misalign the dialog.
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex p-4 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="m-auto w-full max-w-sm max-h-full overflow-y-auto bg-[#13131f] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl">
        <h3 className="font-display font-bold text-lg">Change Password</h3>
        <p className="text-xs text-white/50 mt-1">You stay logged in on this device.</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-xs font-bold tracking-widest text-white/70">CURRENT PASSWORD
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1.5 w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 text-base sm:text-sm" />
          </label>
          <label className="block text-xs font-bold tracking-widest text-white/70">NEW PASSWORD
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1.5 w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 text-base sm:text-sm" placeholder="min 6 chars" />
          </label>
          <label className="block text-xs font-bold tracking-widest text-white/70">CONFIRM NEW PASSWORD
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1.5 w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-violet-500 text-base sm:text-sm" />
          </label>
          <div className="flex flex-col min-[380px]:flex-row gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-bold disabled:opacity-50">
              {saving ? 'Saving…' : 'Change Password'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/10 font-bold">Cancel</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
