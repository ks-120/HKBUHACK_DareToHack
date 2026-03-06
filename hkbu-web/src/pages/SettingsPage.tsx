import { useState } from 'react'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { auth } from '../config/firebaseConfig'
import s from './Page.module.css'

export default function SettingsPage() {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(''); setErr('')
    if (newPw !== confirmPw) return setErr('New passwords do not match.')
    if (newPw.length < 6) return setErr('Password must be at least 6 characters.')
    const user = auth.currentUser
    if (!user || !user.email) return
    setSaving(true)
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPw)
      await reauthenticateWithCredential(user, cred)
      await updatePassword(user, newPw)
      setMsg('✅ Password updated successfully!')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch {
      setErr('❌ Current password is incorrect.')
    }
    setSaving(false)
  }

  return (
    <div className={s.pageWrap}>
      <h2 className={s.pageTitle}>Settings ⚙️</h2>
      <p className={s.pageSub}>Manage your account preferences</p>

      {/* Account info */}
      <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: 24,
        border: '1px solid var(--border)', marginBottom: 20 }}>
        <p className={s.label}>Logged in as</p>
        <p style={{ color: '#fff', fontSize: 15, marginTop: 6 }}>
          {auth.currentUser?.email}
        </p>
      </div>

      {/* Change password */}
      <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: 24,
        border: '1px solid var(--border)' }}>
        <p style={{ color: '#fff', fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
          🔒 Change Password
        </p>
        <form onSubmit={handleChangePassword} className={s.form}>
          <p className={s.label}>Current Password</p>
          <input className={s.input} type="password" value={currentPw}
            onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password" />

          <p className={s.label}>New Password</p>
          <input className={s.input} type="password" value={newPw}
            onChange={e => setNewPw(e.target.value)} placeholder="Enter new password" />

          <p className={s.label}>Confirm New Password</p>
          <input className={s.input} type="password" value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm new password" />

          {err && <p className={s.errorMsg}>{err}</p>}
          {msg && <p style={{ color: 'var(--accent3)', fontSize: 13, marginTop: 4 }}>{msg}</p>}

          <button className={s.btnPrimary} type="submit" disabled={saving || !currentPw || !newPw || !confirmPw}>
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* App info */}
      <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: 24,
        border: '1px solid var(--border)', marginTop: 20 }}>
        <p style={{ color: '#fff', fontSize: 17, fontWeight: 700, marginBottom: 12 }}>
          ℹ️ About
        </p>
        <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.8 }}>
          <strong style={{ color: '#fff' }}>HKBU Buddy</strong><br />
          Version 1.0.0<br />
          Built for BUHack 2026 🎓<br />
          Connecting HKBU students through shared interests.
        </p>
      </div>
    </div>
  )
}
