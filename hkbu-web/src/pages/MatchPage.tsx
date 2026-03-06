import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import { UserProfile, MatchResult } from '../types'
import { computeMatches, matchLabel, matchColor } from '../utils/matchAlgorithm'
import s from './Page.module.css'

// ── Score bar sub-component ───────────────────────────────────────────────
function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>
        <span>{label}</span><span>{pct}%</span>
      </div>
      <div style={{ background: 'var(--bg3)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width .4s ease' }} />
      </div>
    </div>
  )
}

export default function MatchPage() {
  const nav = useNavigate()
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadMatches() }, [])

  const loadMatches = async () => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    const mySnap = await getDoc(doc(db, 'users', uid))
    const me = mySnap.data() as UserProfile
    setMyProfile(me)

    const all = await getDocs(collection(db, 'users'))
    const candidates: UserProfile[] = []
    all.forEach(d => { if (d.id !== uid) candidates.push(d.data() as UserProfile) })

    const results = computeMatches(me, candidates)
    setMatches(results)
    setLoading(false)
  }

  const startChat = async (m: MatchResult) => {
    const myUid = auth.currentUser!.uid
    const matchId = [myUid, m.uid].sort().join('_')
    await setDoc(doc(db, 'chats', matchId), {
      participants: [myUid, m.uid].sort(),
      participantNames: { [myUid]: myProfile?.nickname ?? 'Me', [m.uid]: m.nickname },
      participantPhotos: { [myUid]: myProfile?.photoURL ?? '', [m.uid]: m.photoURL ?? '' },
      [`unread_${myUid}`]: 0,
      [`unread_${m.uid}`]: 0,
    }, { merge: true })
    nav(`/chat/${matchId}/${encodeURIComponent(m.nickname)}/${m.uid}`)
  }

  return (
    <div className={s.pageWrap}>
      <button className={s.backBtn} onClick={() => nav('/main')}>← Back</button>
      <h2 className={s.pageTitle}>Match a Buddy 🤝</h2>
      <p className={s.pageSub}>
        Ranked by interests, study style, personality, goals, location &amp; faculty
      </p>

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>Finding your best matches…</p>
      ) : matches.length === 0 ? (
        <div className={s.empty}>
          <span style={{ fontSize: 48 }}>😕</span>
          <p style={{ color: 'var(--text2)', marginTop: 12 }}>
            No matches yet — complete your profile to get better results!
          </p>
        </div>
      ) : (
        <div className={s.matchGrid}>
          {matches.map(m => {
            const pct = Math.round(m.score.total * 100)
            const color = matchColor(m.score.total)
            const label = matchLabel(m.score.total)
            const isOpen = expanded === m.uid

            return (
              <div key={m.uid} className={s.matchCard}>
                {/* Header */}
                <div className={s.matchTop}>
                  {m.photoURL
                    ? <img src={m.photoURL} alt={m.nickname} className={s.avatarImg} />
                    : <div className={s.avatar}>{m.nickname[0].toUpperCase()}</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div className={s.matchName}>{m.nickname}</div>
                    <div className={s.matchScore} style={{ color }}>
                      {label} · {pct}%
                    </div>
                  </div>
                </div>

                {/* Shared interests chips */}
                {m.sharedInterests.length > 0 && (
                  <div className={s.chipGrid} style={{ marginBottom: 10 }}>
                    {m.sharedInterests.map(i => (
                      <span key={i} className={s.tagChip}>{i}</span>
                    ))}
                  </div>
                )}

                {/* Shared study styles */}
                {m.sharedStudyStyles.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>
                      📚 Study style: {m.sharedStudyStyles.join(', ')}
                    </span>
                  </div>
                )}

                {/* Shared buddy goals */}
                {m.sharedBuddyTypes.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>
                      🎯 Looking for: {m.sharedBuddyTypes.join(', ')}
                    </span>
                  </div>
                )}

                {/* Score breakdown toggle */}
                <button
                  onClick={() => setExpanded(isOpen ? null : m.uid)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--accent)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    marginBottom: isOpen ? 10 : 14, padding: 0,
                  }}
                >
                  {isOpen ? '▲ Hide breakdown' : '▼ Score breakdown'}
                </button>

                {isOpen && (
                  <div style={{ marginBottom: 14 }}>
                    <ScoreBar label="Interests"     value={m.score.interests} />
                    <ScoreBar label="Study Style"   value={m.score.studyStyle} />
                    <ScoreBar label="Personality"   value={m.score.personality} />
                    <ScoreBar label="Buddy Goals"   value={m.score.buddyGoals} />
                    <div style={{
                      marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 12, fontWeight: 700, color,
                    }}>
                      <span>Overall</span><span>{pct}%</span>
                    </div>
                  </div>
                )}

                <button className={s.btnPrimary} onClick={() => startChat(m)}>
                  💬 Start Chat
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
