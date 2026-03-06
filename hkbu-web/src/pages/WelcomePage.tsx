import { useNavigate } from 'react-router-dom'
import s from './Page.module.css'

export default function WelcomePage() {
  const nav = useNavigate()
  return (
    <div className={s.welcomeWrap}>
      <div className={s.hero}>
        <span className={s.heroEmoji}>🎓</span>
        <h1 className={s.heroTitle}>HKBU Buddy</h1>
        <p className={s.heroSub}>Find your campus companion.<br />Connect. Explore. Belong.</p>
      </div>
      <div className={s.heroBtns}>
        <button className={s.btnPrimary} onClick={() => nav('/signup')}>Get Started</button>
        <button className={s.btnGhost} onClick={() => nav('/login')}>I already have an account</button>
      </div>
    </div>
  )
}
