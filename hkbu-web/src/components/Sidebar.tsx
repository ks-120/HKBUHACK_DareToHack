import { useNavigate, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import { UserProfile } from '../types'
import s from './Sidebar.module.css'

const NAV_ITEMS = [
  { emoji: '🏠', label: 'Home',      path: '/main' },
  { emoji: '🤝', label: 'Match',     path: '/match' },
  { emoji: '🎉', label: 'Events',    path: '/events' },
  { emoji: '💬', label: 'Messages',  path: '/inbox' },
  { emoji: '🌐', label: 'Community', path: '/feed' },
  { emoji: '👤', label: 'Profile',   path: '/profile' },
  { emoji: '⚙️', label: 'Settings',  path: '/settings' },
]

interface Props { profile: UserProfile | null }

export default function Sidebar({ profile }: Props) {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [totalUnread, setTotalUnread] = useState(0)

  const uid = auth.currentUser?.uid ?? ''

  // live unread count across all chats
  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', uid))
    return onSnapshot(q, snap => {
      let sum = 0
      snap.docs.forEach(d => { sum += (d.data()[`unread_${uid}`] as number) ?? 0 })
      setTotalUnread(sum)
    })
  }, [uid])

  const handleSignOut = async () => { await signOut(auth); nav('/') }

  return (
    <aside className={s.sidebar}>
      <div className={s.logo}>
        <span className={s.logoEmoji}>🎓</span>
        <span className={s.logoText}>HKBU<br /><span>Buddy</span></span>
      </div>

      <div className={s.userCard}>
        {profile?.photoURL
          ? <img src={profile.photoURL} alt="avatar" className={s.userAvatarImg} />
          : <div className={s.userAvatar}>{profile?.nickname?.[0].toUpperCase() ?? '?'}</div>
        }
        <div className={s.userInfo}>
          <div className={s.userName}>{profile?.nickname ?? '…'}</div>
          <div className={s.userEmail}>{profile?.email ?? ''}</div>
        </div>
      </div>

      <nav className={s.nav}>
        {NAV_ITEMS.map(item => {
          const isInbox = item.path === '/inbox'
          return (
            <button
              key={item.path}
              className={`${s.navItem} ${pathname.startsWith(item.path) ? s.navActive : ''}`}
              onClick={() => nav(item.path)}
            >
              <span className={s.navEmoji}>{item.emoji}</span>
              <span className={s.navLabel}>{item.label}</span>
              {isInbox && totalUnread > 0 && (
                <span className={s.unreadBadge}>{totalUnread > 99 ? '99+' : totalUnread}</span>
              )}
            </button>
          )
        })}
      </nav>

      <button className={s.signOutBtn} onClick={handleSignOut}>
        <span>🚪</span><span>Sign Out</span>
      </button>
    </aside>
  )
}
