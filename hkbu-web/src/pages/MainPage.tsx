import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import { UserProfile } from '../types'
import s from './Page.module.css'

const CARDS = [
  { emoji: '🤝', title: 'Match a Buddy', desc: 'Find someone who shares your interests', color: '#6c63ff', path: '/match' },
  { emoji: '🎉', title: 'School Events', desc: 'Browse and RSVP to campus events', color: '#ff6584', path: '/events' },
  { emoji: '💬', title: 'Community', desc: 'Browse posts, find groupmates & more', color: '#43b89c', path: '/feed' },
  { emoji: '🗨️', title: 'Chat', desc: 'Message your buddies directly', color: '#f7a440', path: '/inbox' },
]

export default function MainPage() {
  const nav = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (uid) getDoc(doc(db, 'users', uid)).then(s => { if (s.exists()) setProfile(s.data() as UserProfile) })
  }, [])

  return (
    <div className={s.pageWrap}>
      <div className={s.mainHeader}>
        <div>
          <h1 className={s.greeting}>Hey {profile?.nickname ?? '…'} 👋</h1>
          <p className={s.greetingSub}>What would you like to do today?</p>
        </div>
      </div>

      <div className={s.cardGrid}>
        {CARDS.map(card => (
          <button key={card.path} className={s.featureCard} style={{ borderTopColor: card.color }} onClick={() => nav(card.path)}>
            <span className={s.featureEmoji}>{card.emoji}</span>
            <h3 className={s.featureTitle}>{card.title}</h3>
            <p className={s.featureDesc}>{card.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
