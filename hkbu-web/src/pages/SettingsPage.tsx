import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth'
import { doc, deleteDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import s from './Page.module.css'

export default function SettingsPage() {
  const nav = useNavigate()
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  // Danger zone
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePw, setDeletePw] = useState('')
  const [deleteErr, setDeleteErr] = useState('')
  const [deleting, setDeleting] = useState(false)

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

  const handleDeleteAccount = async () => {
    setDeleteErr('')
    const user = auth.currentUser
    if (!user || !user.email) return
    if (!deletePw) return setDeleteErr('Please enter your password to confirm.')
    setDeleting(true)
    try {
      const cred = EmailAuthProvider.credential(user.email, deletePw)
      await reauthenticateWithCredential(user, cred)
      await deleteDoc(doc(db, 'users', user.uid))
      await deleteUser(user)
      nav('/', { replace: true })
    } catch {
      setDeleteErr('❌ Incorrect password. Account not deleted.')
    }
    setDeleting(false)
  }

  return (
    <div className={s.pageWrap}>
      <h2 className={s.pageTitle}>Settings ⚙️</h2>
      <p className={s.pageSub}>Manage your account preferences</p>

      {/* Account info */}
      <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: 24,
        border: '1px solid var(--border)', marginBottom: 20 }}>
        <p className={s.label}>Logged in as</p>
        <p style={{ color: 'var(--accent)', fontSize: 15, marginTop: 6, fontWeight: 600 }}>
          {auth.currentUser?.email}
        </p>
      </div>

      {/* Change password */}
      <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: 24,
        border: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--accent)', fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
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
          {msg && <p style={{ color: '#0ca678', fontSize: 13, marginTop: 4, fontWeight: 600 }}>{msg}</p>}

          <button className={s.btnPrimary} type="submit" disabled={saving || !currentPw || !newPw || !confirmPw}>
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* App info */}
      <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: 24,
        border: '1px solid var(--border)', marginTop: 20 }}>
        <p style={{ color: 'var(--accent)', fontSize: 17, fontWeight: 700, marginBottom: 12 }}>
          ℹ️ About
        </p>
        <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.8 }}>
          <strong style={{ color: 'var(--accent)' }}>HKBU Buddy</strong><br />
          Version 1.0.0<br />
          Built for BUHack 2026 🎓<br />
          Connecting HKBU students through shared interests.
        </p>
      </div>

      {/* ── Danger Zone ── */}
      <div style={{
        background: '#fff5f5', borderRadius: 16, padding: 24,
        border: '1.5px solid #fca5a5', marginTop: 20,
      }}>
        <p style={{ color: '#dc2626', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
          🚨 Danger Zone
        </p>
        <p style={{ color: '#7f1d1d', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
          Deleting your account is <strong>permanent</strong> and cannot be undone.
          Your profile, posts, and match data will be removed.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              background: 'none', border: '1.5px solid #dc2626', color: '#dc2626',
              borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#dc2626'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#dc2626' }}
          >
            🗑️ Delete My Account
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ color: '#7f1d1d', fontSize: 13, fontWeight: 600 }}>
              Enter your password to confirm account deletion:
            </p>
            <input
              className={s.input}
              type="password"
              value={deletePw}
              onChange={e => setDeletePw(e.target.value)}
              placeholder="Your current password"
              style={{ borderColor: '#fca5a5' }}
            />
            {deleteErr && <p className={s.errorMsg}>{deleteErr}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || !deletePw}
                style={{
                  background: '#dc2626', color: '#fff', border: 'none',
                  borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', opacity: (deleting || !deletePw) ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {deleting ? 'Deleting…' : '⚠️ Yes, Delete Forever'}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletePw(''); setDeleteErr('') }}
                style={{
                  background: 'none', border: '1.5px solid var(--border)', color: 'var(--text2)',
                  borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
