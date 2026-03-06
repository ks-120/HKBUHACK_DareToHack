import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, getDoc, setDoc, updateDoc
} from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import { Message } from '../types'
import s from './Page.module.css'

export default function ChatPage() {
  const nav = useNavigate()
  const { matchId, matchNickname, otherUid } = useParams<{ matchId: string; matchNickname: string; otherUid: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [myNickname, setMyNickname] = useState('')
  const [myPhoto, setMyPhoto] = useState('')
  const [otherPhotoURL, setOtherPhotoURL] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const myUid = auth.currentUser?.uid ?? ''

  // ── load profiles & clear unread on open ─────────────────────────────────
  useEffect(() => {
    if (!myUid) return

    getDoc(doc(db, 'users', myUid)).then(snap => {
      if (snap.exists()) {
        setMyNickname(snap.data().nickname)
        setMyPhoto(snap.data().photoURL ?? '')
      }
    })

    if (otherUid) {
      getDoc(doc(db, 'users', otherUid)).then(snap => {
        if (snap.exists()) setOtherPhotoURL(snap.data().photoURL ?? '')
      })
    }

    // clear my unread count when I open the chat
    if (matchId) {
      setDoc(doc(db, 'chats', matchId), { [`unread_${myUid}`]: 0 }, { merge: true })
    }
  }, [myUid, otherUid, matchId])

  // ── listen to messages ───────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'chats', matchId!, 'messages'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)))
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      // also clear unread whenever new messages arrive while page is open
      if (matchId && myUid) {
        setDoc(doc(db, 'chats', matchId), { [`unread_${myUid}`]: 0 }, { merge: true })
      }
    })
  }, [matchId])

  // ── send ─────────────────────────────────────────────────────────────────
  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !myUid || !matchId || !otherUid) return
    setText('')

    // write message
    await addDoc(collection(db, 'chats', matchId, 'messages'), {
      text: trimmed,
      senderUid: myUid,
      senderNickname: myNickname || 'Me',
      createdAt: Date.now(),
    })

    const decodedName = decodeURIComponent(matchNickname ?? '')

    // update chat metadata — ensure doc exists with participant info
    await setDoc(doc(db, 'chats', matchId), {
      participants: [myUid, otherUid].sort(),
      participantNames:  { [myUid]: myNickname || 'Me', [otherUid]: decodedName },
      participantPhotos: { [myUid]: myPhoto, [otherUid]: otherPhotoURL },
      lastMessage: trimmed.length > 60 ? trimmed.slice(0, 60) + '…' : trimmed,
      lastAt: Date.now(),
      [`unread_${myUid}`]: 0,          // I sent it — I've read it
      [`unread_${otherUid}`]: 1,       // notify the other person
    }, { merge: true })

    // increment receiver's unread (don't reset to 1, actually accumulate)
    try {
      const chatSnap = await getDoc(doc(db, 'chats', matchId))
      if (chatSnap.exists()) {
        const current = (chatSnap.data()[`unread_${otherUid}`] as number) ?? 0
        await updateDoc(doc(db, 'chats', matchId), {
          [`unread_${otherUid}`]: current + 1,
        })
      }
    } catch { /* non-critical */ }
  }

  const fmt = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const decodedName = decodeURIComponent(matchNickname ?? '')

  return (
    <div className={s.chatWrap}>
      <div className={s.chatHeader}>
        <button className={s.backBtn} onClick={() => nav('/inbox')}>← Back</button>
        <div className={s.chatHeaderInfo}>
          {otherPhotoURL
            ? <img src={otherPhotoURL} alt={decodedName} className={s.avatarImg} />
            : <div className={s.avatar}>{decodedName[0]?.toUpperCase()}</div>
          }
          <span className={s.chatHeaderName}>{decodedName}</span>
        </div>
      </div>

      <div className={s.chatMessages}>
        {loading ? <div className={s.loader}>Loading…</div>
          : messages.length === 0
            ? <div className={s.chatEmpty}>👋 Say hi to {decodedName}!</div>
            : messages.map(m => {
                const isMe = m.senderUid === myUid
                return (
                  <div key={m.id} className={isMe ? s.bubbleRowMe : s.bubbleRowThem}>
                    <div className={isMe ? s.bubbleMe : s.bubbleThem}>
                      {!isMe && <div className={s.bubbleSender}>{m.senderNickname}</div>}
                      <div className={s.bubbleText}>{m.text}</div>
                      <div className={s.bubbleTime}>{fmt(m.createdAt)}</div>
                    </div>
                  </div>
                )
              })
        }
        <div ref={bottomRef} />
      </div>

      <form className={s.chatInputRow} onSubmit={send}>
        <input
          className={s.chatInput} placeholder="Type a message…"
          value={text} onChange={e => setText(e.target.value)} autoFocus
        />
        <button className={s.sendBtn} type="submit" disabled={!text.trim()}>➤</button>
      </form>
    </div>
  )
}
