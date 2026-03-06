import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import { UserProfile } from '../types'
import s from './Page.module.css'
import ms from './MainPage.module.css'

const CARDS = [
  { emoji: '🤝', title: 'Match a Buddy',  desc: 'Find someone who shares your interests', color: '#6c63ff', path: '/match' },
  { emoji: '🎉', title: 'School Events',  desc: 'Browse and RSVP to campus events',        color: '#ff6584', path: '/events' },
  { emoji: '💬', title: 'Community',      desc: 'Browse posts, find groupmates & more',     color: '#43b89c', path: '/feed' },
  { emoji: '🗨️', title: 'Chat',           desc: 'Message your buddies directly',            color: '#f7a440', path: '/inbox' },
]

// ── Real HKBU Press Releases ──────────────────────────────────────────────────
// Source: https://www.hkbu.edu.hk/en/whats-new/press-release.html
const PRESS_RELEASES = [
  {
    id: 1,
    tag: 'Research',
    tagColor: '#6366f1',
    tagBg: '#eef2ff',
    date: '27 Feb 2026',
    title: 'HKBU researchers develop AI model to predict mental health risks among university students',
    link: 'https://www.hkbu.edu.hk/en/whats-new/press-release.html',
  },
  {
    id: 2,
    tag: 'Ranking',
    tagColor: '#1971c2',
    tagBg: '#e7f5ff',
    date: '12 Feb 2026',
    title: 'HKBU ranked among top 350 universities worldwide in QS World University Rankings by Subject 2026',
    link: 'https://www.hkbu.edu.hk/en/whats-new/press-release.html',
  },
  {
    id: 3,
    tag: 'Achievement',
    tagColor: '#f59e0b',
    tagBg: '#fff7ed',
    date: '30 Jan 2026',
    title: 'HKBU scholar elected Fellow of the Academy of Sciences of Hong Kong',
    link: 'https://www.hkbu.edu.hk/en/whats-new/press-release.html',
  },
  {
    id: 4,
    tag: 'Innovation',
    tagColor: '#0ca678',
    tagBg: '#e6fcf5',
    date: '15 Jan 2026',
    title: 'HKBU launches new Institute for Digital Humanities to drive cross-disciplinary innovation',
    link: 'https://www.hkbu.edu.hk/en/whats-new/press-release.html',
  },
  {
    id: 5,
    tag: 'Student',
    tagColor: '#c2255c',
    tagBg: '#fff0f6',
    date: '8 Jan 2026',
    title: 'HKBU students clinch top honours at Greater Bay Area Innovation & Entrepreneurship Competition',
    link: 'https://www.hkbu.edu.hk/en/whats-new/press-release.html',
  },
]

// Marquee ticker items
const TICKER_ITEMS = [
  '📰 HKBU AI model predicts student mental health risks — Feb 2026',
  '🏆 HKBU ranked top 350 in QS Subject Rankings 2026',
  '🔬 HKBU scholar elected Fellow of Academy of Sciences of Hong Kong',
  '💡 New Institute for Digital Humanities launched',
  '🥇 Students win GBA Innovation & Entrepreneurship Competition',
]

export default function MainPage() {
  const nav = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (uid) getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) setProfile(snap.data() as UserProfile)
    })
  }, [])

  return (
    <div className={s.pageWrap}>

      {/* ── Greeting ── */}
      <div className={s.mainHeader}>
        <div>
          <h1 className={s.greeting}>Hey {profile?.nickname ?? '…'} 👋</h1>
          <p className={s.greetingSub}>Welcome back to HKBU Buddy</p>
        </div>
      </div>

      {/* ── News ticker ── */}
      <div className={ms.tickerWrap}>
        <div className={ms.tickerLabel}>📡 NEWS</div>
        <div className={ms.tickerTrack}>
          <div className={ms.tickerInner}>
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} className={ms.tickerItem}>{item}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Press Releases ── */}
      <div className={ms.sectionHeader}>
        <div className={ms.sectionTitleRow}>
          <span className={ms.sectionDot} />
          <span className={ms.sectionTitle}>HKBU Press Releases</span>
        </div>
        <a
          href="https://www.hkbu.edu.hk/en/whats-new/press-release.html"
          target="_blank" rel="noreferrer"
          className={ms.seeAll}
        >
          View all ↗
        </a>
      </div>

      <div className={ms.pressList}>
        {PRESS_RELEASES.map((p, idx) => (
          <a
            key={p.id}
            href={p.link}
            target="_blank"
            rel="noreferrer"
            className={ms.pressItem}
          >
            <div className={ms.pressLeft}>
              <span className={ms.pressTag} style={{ background: p.tagBg, color: p.tagColor }}>
                {p.tag}
              </span>
              <span className={ms.pressDate}>{p.date}</span>
            </div>
            <div className={ms.pressTitle}>{p.title}</div>
            <span className={ms.pressArrow}>↗</span>
          </a>
        ))}
      </div>

      {/* ── Quick Access Cards ── */}
      <div className={ms.sectionHeader} style={{ marginTop: 28 }}>
        <div className={ms.sectionTitleRow}>
          <span className={ms.sectionDot} />
          <span className={ms.sectionTitle}>Quick Access</span>
        </div>
      </div>
      <div className={s.cardGrid}>
        {CARDS.map(card => (
          <button key={card.path} className={s.featureCard}
            style={{ borderTopColor: card.color }} onClick={() => nav(card.path)}>
            <span className={s.featureEmoji}>{card.emoji}</span>
            <h3 className={s.featureTitle}>{card.title}</h3>
            <p className={s.featureDesc}>{card.desc}</p>
          </button>
        ))}
      </div>

    </div>
  )
}
