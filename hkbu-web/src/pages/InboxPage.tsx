import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import { ChatMeta } from '../types'
import s from './Page.module.css'

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  if (diff < 60_000)    return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function InboxPage() {
  const nav = useNavigate()
  const uid = auth.currentUser?.uid ?? ''
  const [chats, setChats] = useState<ChatMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', uid)
    )
    return onSnapshot(q, snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ChatMeta))
        .filter(c => c.lastAt)                          // skip empty threads
        .sort((a, b) => b.lastAt - a.lastAt)
      setChats(list)
      setLoading(false)
    })
  }, [uid])

  const openChat = (c: ChatMeta) => {
    const otherUid = c.participants.find(p => p !== uid) ?? ''
    const otherName = c.participantNames?.[otherUid] ?? 'Unknown'
    nav(`/chat/${c.id}/${encodeURIComponent(otherName)}/${otherUid}`)
  }

  return (
    <div className={s.pageWrap}>
      <button className={s.backBtn} onClick={() => nav('/main')}>← Back</button>
      <h2 className={s.pageTitle}>Messages 💬</h2>
      <p className={s.pageSub}>Your conversations with matched buddies</p>

      {loading ? (
        <div className={s.loader}>Loading…</div>
      ) : chats.length === 0 ? (
        <div className={s.empty}>
          <span>💬</span>
          <p>No conversations yet.<br />Match with someone and start chatting!</p>
          <button className={s.btnAccent2} style={{ marginTop: 8 }} onClick={() => nav('/match')}>
            Find a Buddy →
          </button>
        </div>
      ) : (
        <div className={s.inboxList}>
          {chats.map(c => {
            const otherUid   = c.participants.find(p => p !== uid) ?? ''
            const otherName  = c.participantNames?.[otherUid] ?? 'Unknown'
            const otherPhoto = c.participantPhotos?.[otherUid] ?? ''
            const unread     = (c[`unread_${uid}`] as number) ?? 0

            return (
              <button key={c.id} className={s.inboxRow} onClick={() => openChat(c)}>
                <div className={s.inboxAvatar}>
                  {otherPhoto
                    ? <img src={otherPhoto} alt={otherName} className={s.inboxAvatarImg} />
                    : <div className={s.inboxAvatarFallback}>{otherName[0]?.toUpperCase()}</div>
                  }
                  {unread > 0 && <span className={s.unreadDot}>{unread}</span>}
                </div>
                <div className={s.inboxInfo}>
                  <div className={s.inboxName}>{otherName}</div>
                  <div className={s.inboxPreview}>{c.lastMessage || '…'}</div>
                </div>
                <div className={s.inboxTime}>{c.lastAt ? timeAgo(c.lastAt) : ''}</div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
