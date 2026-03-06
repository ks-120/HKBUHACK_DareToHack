import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  collection, onSnapshot, query, orderBy, addDoc,
  doc, getDoc, updateDoc, arrayUnion, arrayRemove, increment
} from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import { Community, CommunityMessage } from '../types'
import s from './Page.module.css'
import cs from './CommunityRoomPage.module.css'

export default function CommunityRoomPage() {
  const nav = useNavigate()
  const { communityId } = useParams<{ communityId: string }>()
  const [community, setCommunity]   = useState<Community | null>(null)
  const [messages, setMessages]     = useState<CommunityMessage[]>([])
  const [text, setText]             = useState('')
  const [myNickname, setMyNickname] = useState('')
  const [myPhoto, setMyPhoto]       = useState('')
  const [sending, setSending]       = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const myUid = auth.currentUser?.uid ?? ''

  // ── load my profile ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!myUid) return
    getDoc(doc(db, 'users', myUid)).then(snap => {
      if (snap.exists()) {
        setMyNickname(snap.data().nickname ?? '')
        setMyPhoto(snap.data().photoURL ?? '')
      }
    })
  }, [myUid])

  // ── load community meta ───────────────────────────────────────────────────
  useEffect(() => {
    if (!communityId) return
    return onSnapshot(doc(db, 'communities', communityId), snap => {
      if (snap.exists()) setCommunity({ id: snap.id, ...snap.data() } as Community)
    })
  }, [communityId])

  // ── listen to messages ────────────────────────────────────────────────────
  useEffect(() => {
    if (!communityId) return
    const q = query(
      collection(db, 'communities', communityId, 'messages'),
      orderBy('createdAt', 'asc')
    )
    return onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityMessage)))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    })
  }, [communityId])

  // ── join on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!communityId || !myUid || !community) return
    if (!community.members?.includes(myUid)) {
      updateDoc(doc(db, 'communities', communityId), {
        members: arrayUnion(myUid),
        memberCount: increment(1),
      })
    }
  }, [community, communityId, myUid])

  // ── send message ──────────────────────────────────────────────────────────
  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !myUid || !communityId) return
    setSending(true)
    setText('')
    await addDoc(collection(db, 'communities', communityId, 'messages'), {
      senderUid:      myUid,
      senderNickname: myNickname || 'Anonymous',
      senderPhoto:    myPhoto,
      text:           trimmed,
      createdAt:      Date.now(),
    } satisfies Omit<CommunityMessage, 'id'>)
    setSending(false)
  }

  // ── leave community ───────────────────────────────────────────────────────
  const leave = async () => {
    if (!communityId || !myUid) return
    await updateDoc(doc(db, 'communities', communityId), {
      members:     arrayRemove(myUid),
      memberCount: increment(-1),
    })
    nav('/feed')
  }

  const fmt = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-HK', { weekday: 'short', month: 'short', day: 'numeric' })

  // group messages by date
  const grouped: { date: string; msgs: CommunityMessage[] }[] = []
  messages.forEach(m => {
    const dateStr = fmtDate(m.createdAt)
    const last = grouped[grouped.length - 1]
    if (last && last.date === dateStr) last.msgs.push(m)
    else grouped.push({ date: dateStr, msgs: [m] })
  })

  const CAT_COLORS: Record<string, string> = {
    Study: '#3b5bdb', Hobby: '#e67700', Faculty: '#0ca678',
    'Buddy Hunt': '#c2255c', Wellness: '#6741d9', Other: '#495057',
  }
  const catColor = community ? (CAT_COLORS[community.category] ?? '#0d2760') : '#0d2760'

  return (
    <div className={cs.wrap}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className={cs.header} style={{ borderBottom: `3px solid ${catColor}` }}>
        <button className={s.backBtn} style={{ margin: 0 }} onClick={() => nav('/feed')}>←</button>

        <div className={cs.headerEmoji}>{community?.emoji ?? '💬'}</div>
        <div className={cs.headerInfo}>
          <div className={cs.headerName}>
            {community?.name ?? '…'}
            {community?.isOfficial && <span className={cs.officialBadge}>✦ Official</span>}
          </div>
          <div className={cs.headerMeta}>
            <span style={{ color: catColor, fontWeight: 700, fontSize: 11 }}>
              {community?.category}
            </span>
            <span className={cs.dot}>·</span>
            <span>👥 {community?.memberCount ?? 0} members</span>
            <span className={cs.dot}>·</span>
            <span>💬 {messages.length} messages</span>
          </div>
          {community?.description && (
            <div className={cs.headerDesc}>{community.description}</div>
          )}
        </div>

        <button className={cs.leaveBtn} onClick={leave} title="Leave community">
          🚪 Leave
        </button>
      </div>

      {/* ── Messages ───────────────────────────────────────────────── */}
      <div className={cs.messages}>
        {messages.length === 0 ? (
          <div className={cs.emptyRoom}>
            <div style={{ fontSize: 48 }}>{community?.emoji ?? '💬'}</div>
            <p>No messages yet.<br />Say hi and break the ice! 👋</p>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.date}>
              <div className={cs.dateDivider}><span>{group.date}</span></div>
              {group.msgs.map((m, idx) => {
                const isMe = m.senderUid === myUid
                const prevMsg = group.msgs[idx - 1]
                const showAvatar = !prevMsg || prevMsg.senderUid !== m.senderUid

                return (
                  <div key={m.id} className={isMe ? cs.rowMe : cs.rowThem}>
                    {/* Avatar — only show when sender changes */}
                    {!isMe && (
                      <div className={cs.avatarCol}>
                        {showAvatar ? (
                          m.senderPhoto
                            ? <img src={m.senderPhoto} className={cs.avatarImg} alt={m.senderNickname} />
                            : <div className={cs.avatarFallback}>{m.senderNickname?.[0]?.toUpperCase()}</div>
                        ) : (
                          <div className={cs.avatarSpacer} />
                        )}
                      </div>
                    )}

                    <div className={cs.bubbleCol}>
                      {showAvatar && !isMe && (
                        <div className={cs.senderName}>{m.senderNickname}</div>
                      )}
                      <div className={isMe ? cs.bubbleMe : cs.bubbleThem}>
                        <span className={cs.bubbleText}>{m.text}</span>
                        <span className={cs.bubbleTime}>{fmt(m.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────────── */}
      <form className={cs.inputRow} onSubmit={send}>
        <div className={cs.inputAvatar}>
          {myPhoto
            ? <img src={myPhoto} className={cs.inputAvatarImg} alt="me" />
            : <div className={cs.inputAvatarFallback}>{myNickname?.[0]?.toUpperCase()}</div>
          }
        </div>
        <input
          className={cs.input}
          placeholder={`Message ${community?.name ?? 'community'}…`}
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
        />
        <button className={cs.sendBtn} type="submit" disabled={!text.trim() || sending}
          style={{ background: catColor }}>
          ➤
        </button>
      </form>
    </div>
  )
}
