import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../config/firebaseConfig'
import s from './Page.module.css'

export default function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      nav('/main')
    } catch (err: any) {
      setError(err.message)
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
          <input className={s.input} type="email" placeholder="xxx@student.hkbu.edu.hk"
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
