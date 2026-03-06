import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../config/firebaseConfig'
import s from './Page.module.css'

const FRIENDLY: Record<string, string> = {
  'auth/user-not-found':         'No account found with that email.',
  'auth/wrong-password':         'Incorrect password. Please try again.',
  'auth/invalid-credential':     'Email or password is incorrect.',
  'auth/invalid-email':          'Please enter a valid email address.',
  'auth/too-many-requests':      'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection.',
}

export default function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      nav('/main')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setError(FRIENDLY[code] ?? 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={s.authWrap}>
      <div className={s.authCard}>
        <button className={s.backBtn} onClick={() => nav('/')}>← Back</button>
        <h2 className={s.authTitle}>Welcome Back 👋</h2>
        <p className={s.authSub}>Log in to your HKBU Buddy account</p>
        <form onSubmit={handleLogin} className={s.form}>
          <label className={s.label}>Email</label>
          <input className={s.input} type="email" placeholder="xxx@life.hkbu.edu.hk"
            value={email} onChange={e => setEmail(e.target.value)} required />
          <label className={s.label}>Password</label>
          <input className={s.input} type="password" placeholder="Your password"
            value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className={s.errorMsg}>{error}</p>}
          <button className={s.btnPrimary} type="submit" disabled={loading}>
            {loading ? 'Logging in…' : 'Log In'}
          </button>
        </form>
        <p className={s.switchLink}>Don't have an account?{' '}
          <span onClick={() => nav('/signup')}>Sign up</span>
        </p>
      </div>
    </div>
  )
}
