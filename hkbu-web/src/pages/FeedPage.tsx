import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, onSnapshot, query, orderBy, addDoc, doc, getDoc,
  updateDoc, arrayUnion, arrayRemove, increment, setDoc, deleteField
} from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import { Post, Comment, Community, HelpPost, SubjectStrength } from '../types'
import s from './FeedPage.module.css'

// ── Constants ────────────────────────────────────────────────────────────────
const TAGS = [
  { label: '#Study',      emoji: '📚', color: '#3b5bdb', bg: '#eef2ff', border: '#bac8ff' },
  { label: '#Event',      emoji: '🎉', color: '#e67700', bg: '#fff9db', border: '#ffe066' },
  { label: '#Groupmates', emoji: '🤝', color: '#0ca678', bg: '#e6fcf5', border: '#96f2d7' },
  { label: '#Housing',    emoji: '🏠', color: '#c2255c', bg: '#fff0f6', border: '#faa2c1' },
  { label: '#Sport',      emoji: '🏃', color: '#1971c2', bg: '#e7f5ff', border: '#a5d8ff' },
  { label: '#Food',       emoji: '🍜', color: '#d9480f', bg: '#fff4e6', border: '#ffc078' },
  { label: '#Misc',       emoji: '💬', color: '#6741d9', bg: '#f3f0ff', border: '#b197fc' },
]
const SORT_OPTIONS = [
  { key: 'hot',      label: '🔥 Hot',        title: 'Popular recently' },
  { key: 'new',      label: '✨ New',         title: 'Most recent first' },
  { key: 'top',      label: '🏆 Top',         title: 'Most liked of all time' },
  { key: 'comments', label: '💬 Most Active', title: 'Most commented' },
]
const COMMUNITY_CATEGORIES = ['Study', 'Hobby', 'Faculty', 'Buddy Hunt', 'Wellness', 'Other'] as const
const COMMUNITY_EMOJIS = ['📚','🎮','🏃','🎨','🎵','🍜','☕','🌿','💻','🤝','🧘','🌏','🎭','📸','✈️','🏠']
const HELP_SUBJECTS: SubjectStrength[] = [
  'Languages (EN/Cantonese/Putonghua)',
  'Business / Finance / Accounting',
  'Science (Bio/Chem/Physics/CS)',
  'Social Sciences / Psychology / History',
  'Media / Communication / Film',
  'Chinese Medicine / Health',
  'Arts / Design / Music',
  'Other',
]

// ── Default communities seeded on first load ─────────────────────────────────
const DEFAULT_COMMUNITIES: Omit<Community, 'id'>[] = [
  { name: 'CS & Tech Hub', description: 'Coding help, tech news, hackathon teams', emoji: '💻', category: 'Study', createdBy: 'system', createdByNickname: 'HKBU Buddy', memberCount: 0, members: [], createdAt: Date.now(), isOfficial: true },
  { name: 'Business & Finance', description: 'Case studies, internship tips, finance talk', emoji: '📊', category: 'Study', createdBy: 'system', createdByNickname: 'HKBU Buddy', memberCount: 0, members: [], createdAt: Date.now(), isOfficial: true },
  { name: 'Gym & Fitness', description: 'Workout partners, campus sports, healthy habits', emoji: '🏃', category: 'Hobby', createdBy: 'system', createdByNickname: 'HKBU Buddy', memberCount: 0, members: [], createdAt: Date.now(), isOfficial: true },
  { name: 'Language Exchange', description: 'Cantonese, Putonghua, English — practice together!', emoji: '🌏', category: 'Buddy Hunt', createdBy: 'system', createdByNickname: 'HKBU Buddy', memberCount: 0, members: [], createdAt: Date.now(), isOfficial: true },
  { name: 'Mental Wellness', description: 'A safe space to share, vent, and support each other', emoji: '🧘', category: 'Wellness', createdBy: 'system', createdByNickname: 'HKBU Buddy', memberCount: 0, members: [], createdAt: Date.now(), isOfficial: true },
  { name: 'Exchange Students', description: 'Welcome to HK! Tips, meetups, travel buddies', emoji: '✈️', category: 'Buddy Hunt', createdBy: 'system', createdByNickname: 'HKBU Buddy', memberCount: 0, members: [], createdAt: Date.now(), isOfficial: true },
]

const photoCache: Record<string, string> = {}

// ── CommentSection ────────────────────────────────────────────────────────────
function CommentSection({ post, uid, myNickname, avatars }: {
  post: Post; uid: string; myNickname: string; avatars: Record<string, string>
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap =>
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)))
    )
  }, [post.id])

  const timeAgo = (ts: number) => {
    const d = Date.now() - ts
    if (d < 60000) return 'just now'
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`
    return `${Math.floor(d / 86400000)}d ago`
  }

  const submit = async () => {
    if (!text.trim() || !uid) return
    setSubmitting(true)
    await addDoc(collection(db, 'posts', post.id, 'comments'), {
      authorUid: uid, authorNickname: myNickname,
      content: text.trim(), createdAt: Date.now(),
    })
    await updateDoc(doc(db, 'posts', post.id), { commentCount: increment(1) })
    setText('')
    setSubmitting(false)
  }

  return (
    <div className={s.commentsSection}>
      {comments.map(c => (
        <div key={c.id} className={s.commentItem}>
          {avatars[c.authorUid]
            ? <img src={avatars[c.authorUid]} className={s.commentAvatarImg} alt={c.authorNickname} />
            : <div className={s.commentAvatarFallback}>{c.authorNickname?.[0]?.toUpperCase()}</div>
          }
          <div className={s.commentBubble}>
            <div className={s.commentMeta}>
              <span className={s.commentAuthor}>u/{c.authorNickname}</span>
              <span className={s.commentTime}>· {timeAgo(c.createdAt)}</span>
            </div>
            <div className={s.commentText}>{c.content}</div>
          </div>
        </div>
      ))}
      <div className={s.commentInputRow}>
        <input className={s.commentInput} placeholder="Write a comment…"
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }} />
        <button className={s.commentSubmit} onClick={submit} disabled={submitting || !text.trim()}>Reply</button>
      </div>
    </div>
  )
}

// ── PinnedSection ─────────────────────────────────────────────────────────────
function PinnedSection({ posts, avatars }: { posts: Post[]; avatars: Record<string, string> }) {
  const top3 = [...posts].sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0)).slice(0, 3)
  if (top3.length === 0) return null
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className={s.pinnedSection}>
      <div className={s.pinnedTitle}>🏆 Top Posts This Week</div>
      <div className={s.pinnedGrid}>
        {top3.map((p, i) => (
          <div key={p.id} className={s.pinnedCard}>
            <div className={s.pinnedMedal}>{medals[i]}</div>
            <div className={s.pinnedAuthorRow}>
              {avatars[p.authorUid]
                ? <img src={avatars[p.authorUid]} className={s.pinnedAvatar} alt={p.authorNickname} />
                : <div className={s.pinnedAvatarFallback}>{p.authorNickname?.[0]?.toUpperCase()}</div>
              }
              <span className={s.pinnedAuthor}>u/{p.authorNickname}</span>
            </div>
            <p className={s.pinnedContent}>{p.content.slice(0, 80)}{p.content.length > 80 ? '…' : ''}</p>
            <div className={s.pinnedStats}>
              <span>👍 {p.upvotes ?? 0}</span>
              <span>💬 {p.commentCount ?? 0}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function getPostBadge(p: Post, allPosts: Post[]): { label: string; cls: string } | null {
  const net = (p.upvotes ?? 0) - (p.downvotes ?? 0)
  const maxNet = Math.max(...allPosts.map(x => (x.upvotes ?? 0) - (x.downvotes ?? 0)))
  const maxComments = Math.max(...allPosts.map(x => x.commentCount ?? 0))
  if (net === maxNet && net > 0) return { label: '🏆 Top', cls: s.badgeTop }
  if ((p.commentCount ?? 0) === maxComments && maxComments > 0) return { label: '💬 Hot Topic', cls: s.badgeHot }
  const ageHours = (Date.now() - p.createdAt) / 3_600_000
  if (ageHours < 2 && (p.upvotes ?? 0) > 0) return { label: '✨ New', cls: s.badgeNew }
  return null
}

// ── FEED TAB ─────────────────────────────────────────────────────────────────
function FeedTab({ uid, myNickname, myAvatar }: { uid: string; myNickname: string; myAvatar: string }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [avatars, setAvatars] = useState<Record<string, string>>({})
  const [content, setContent] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('hot')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, async snap => {
      const newPosts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post))
      setPosts(newPosts)
      setLoading(false)
      const unknownUids = [...new Set(newPosts.map(p => p.authorUid))].filter(u => !(u in photoCache))
      await Promise.all(unknownUids.map(async u => {
        const snap2 = await getDoc(doc(db, 'users', u))
        photoCache[u] = snap2.exists() ? (snap2.data().photoURL ?? '') : ''
      }))
      setAvatars({ ...photoCache })
    })
  }, [])

  const handlePost = async () => {
    if (!content.trim() || !uid) return
    setPosting(true)
    await addDoc(collection(db, 'posts'), {
      authorUid: uid, authorNickname: myNickname,
      content: content.trim(), tags: selectedTags,
      createdAt: Date.now(),
      upvotes: 1, upvotedBy: [uid],
      downvotes: 0, downvotedBy: [],
      commentCount: 0, reportedBy: [],
    })
    setContent(''); setSelectedTags([]); setPosting(false); setShowModal(false)
  }

  const handleVote = async (post: Post, dir: 'up' | 'down') => {
    if (!uid) return
    const ref = doc(db, 'posts', post.id)
    const hasUp = post.upvotedBy?.includes(uid)
    const hasDown = post.downvotedBy?.includes(uid)
    if (dir === 'up') {
      if (hasUp) await updateDoc(ref, { upvotes: increment(-1), upvotedBy: arrayRemove(uid) })
      else if (hasDown) await updateDoc(ref, { upvotes: increment(1), upvotedBy: arrayUnion(uid), downvotes: increment(-1), downvotedBy: arrayRemove(uid) })
      else await updateDoc(ref, { upvotes: increment(1), upvotedBy: arrayUnion(uid) })
    } else {
      if (hasDown) await updateDoc(ref, { downvotes: increment(-1), downvotedBy: arrayRemove(uid) })
      else if (hasUp) await updateDoc(ref, { downvotes: increment(1), downvotedBy: arrayUnion(uid), upvotes: increment(-1), upvotedBy: arrayRemove(uid) })
      else await updateDoc(ref, { downvotes: increment(1), downvotedBy: arrayUnion(uid) })
    }
  }

  const handleShare = (postId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${postId}`
    navigator.clipboard.writeText(url)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast('🔗 Link copied!')
    toastTimer.current = setTimeout(() => setToast(''), 1800)
  }

  const handleReport = async (post: Post) => {
    if (!uid || post.reportedBy?.includes(uid)) return
    if (!window.confirm('Report this post as inappropriate?')) return
    await updateDoc(doc(db, 'posts', post.id), { reportedBy: arrayUnion(uid) })
  }

  const toggleComments = (postId: string) =>
    setOpenComments(prev => ({ ...prev, [postId]: !prev[postId] }))

  const timeAgo = (ts: number) => {
    const d = Date.now() - ts
    if (d < 60000) return 'just now'
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`
    return `${Math.floor(d / 86400000)}d ago`
  }

  const netVotes = (p: Post) => (p.upvotes ?? 0) - (p.downvotes ?? 0)
  const filtered = filter === 'All' ? posts : posts.filter(p => p.tags?.includes(filter))
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'new') return b.createdAt - a.createdAt
    if (sort === 'top') return netVotes(b) - netVotes(a)
    if (sort === 'comments') return (b.commentCount ?? 0) - (a.commentCount ?? 0)
    const score = (p: Post) => netVotes(p) / Math.pow((Date.now() - p.createdAt) / 3600000 + 2, 1.5)
    return score(b) - score(a)
  })

  return (
    <>
      {toast && <div className={s.toast}>{toast}</div>}
      {!loading && <PinnedSection posts={posts} avatars={avatars} />}

      <div className={s.composeBox} onClick={() => setShowModal(true)}>
        <div className={s.composeAvatar}>
          {myAvatar ? <img src={myAvatar} alt="me" /> : '👤'}
        </div>
        <div className={s.composePlaceholder}>Create a post…</div>
      </div>

      {showModal && (
        <div className={s.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className={s.modal}>
            <div className={s.modalTitle}>Create a Post</div>
            <textarea className={s.modalTextarea}
              placeholder="Looking for groupmates? Sharing news? Post it here…"
              value={content} onChange={e => setContent(e.target.value)} autoFocus rows={5} />
            <div className={s.tagRow}>
              {TAGS.map(t => (
                <button key={t.label} type="button"
                  className={selectedTags.includes(t.label) ? s.tagActive : s.tag}
                  style={selectedTags.includes(t.label) ? { background: t.bg, color: t.color, borderColor: t.border } : {}}
                  onClick={() => setSelectedTags(prev =>
                    prev.includes(t.label) ? prev.filter(x => x !== t.label) : [...prev, t.label]
                  )}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
            <div className={s.modalActions}>
              <button className={s.btnCancel} onClick={() => setShowModal(false)}>Cancel</button>
              <button className={s.btnSubmit} onClick={handlePost} disabled={posting || !content.trim()}>
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={s.toolbar}>
        <div className={s.sortTabs}>
          {SORT_OPTIONS.map(o => (
            <button key={o.key} title={o.title}
              className={`${s.sortTab} ${sort === o.key ? s.sortTabActive : ''} ${s[`sortTab_${o.key}`] ?? ''}`}
              onClick={() => setSort(o.key)}>{o.label}</button>
          ))}
        </div>
        <div className={s.divider} />
        <div className={s.filterTags}>
          <button className={filter === 'All' ? s.filterTagActive : s.filterTag}
            style={filter === 'All' ? { background: '#0d2760', color: '#fff', borderColor: '#0d2760' } : {}}
            onClick={() => setFilter('All')}>🗂 All</button>
          {TAGS.map(t => {
            const active = filter === t.label
            return (
              <button key={t.label}
                className={active ? s.filterTagActive : s.filterTag}
                style={active ? { background: t.bg, color: t.color, borderColor: t.border } : {}}
                onClick={() => setFilter(t.label)}>
                {t.emoji} {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? <div className={s.loader}>Loading posts…</div>
        : sorted.length === 0 ? (
          <div className={s.empty}><span>📭</span><p>No posts yet.<br />Be the first to post!</p></div>
        ) : sorted.map(p => {
          const hasUp = p.upvotedBy?.includes(uid)
          const hasDown = p.downvotedBy?.includes(uid)
          const hasReported = p.reportedBy?.includes(uid)
          const badge = getPostBadge(p, posts)
          const commentsOpen = !!openComments[p.id]
          return (
            <div key={p.id} id={p.id} className={s.postCard}>
              <div className={s.voteSide}>
                <button className={`${s.likeBtn} ${hasUp ? s.likeBtnActive : ''}`} onClick={() => handleVote(p, 'up')} title="Like">
                  👍<span className={s.likeCount}>{p.upvotes ?? 0}</span>
                </button>
                <button className={`${s.dislikeBtn} ${hasDown ? s.dislikeBtnActive : ''}`} onClick={() => handleVote(p, 'down')} title="Dislike">
                  👎<span className={s.dislikeCount}>{p.downvotes ?? 0}</span>
                </button>
              </div>
              <div className={s.postBody}>
                <div className={s.postMeta}>
                  {avatars[p.authorUid]
                    ? <img src={avatars[p.authorUid]} className={s.postMetaAvatar} alt={p.authorNickname} />
                    : <div className={s.postMetaAvatarFallback}>{p.authorNickname?.[0]?.toUpperCase()}</div>
                  }
                  <span className={s.postAuthor}>u/{p.authorNickname}</span>
                  <span className={s.postDot}>·</span>
                  <span className={s.postTime}>{timeAgo(p.createdAt)}</span>
                  {badge && <span className={`${s.postBadge} ${badge.cls}`}>{badge.label}</span>}
                </div>
                <p className={s.postContent}>{p.content}</p>
                {p.tags?.length > 0 && (
                  <div className={s.postTags}>
                    {p.tags.map(t => <span key={t} className={s.postTag} data-tag={t}>{
                      (() => { const found = TAGS.find(x => x.label === t); return found ? `${found.emoji} ${t}` : t })()
                    }</span>)}
                  </div>
                )}
                <div className={s.postFooter}>
                  <button className={s.footerBtn} onClick={() => toggleComments(p.id)}>
                    💬 {p.commentCount ?? 0} {commentsOpen ? 'Hide' : 'Comments'}
                  </button>
                  <button className={s.footerBtn} onClick={() => handleShare(p.id)}>🔗 Share</button>
                  {hasReported
                    ? <span className={s.footerBtnReported}>🚩 Reported</span>
                    : <button className={s.footerBtn} onClick={() => handleReport(p)}>🚩 Report</button>
                  }
                </div>
                {commentsOpen && <CommentSection post={p} uid={uid} myNickname={myNickname} avatars={avatars} />}
              </div>
            </div>
          )
        })
      }
    </>
  )
}

// ── COMMUNITIES TAB ───────────────────────────────────────────────────────────
function CommunitiesTab({ uid, myNickname }: { uid: string; myNickname: string }) {
  const nav = useNavigate()
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [catFilter, setCatFilter] = useState<string>('All')
  // create form
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newEmoji, setNewEmoji] = useState('📚')
  const [newCat, setNewCat] = useState<Community['category']>('Study')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'communities'), orderBy('memberCount', 'desc'))
    const unsub = onSnapshot(q, async snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Community))
      // seed defaults if none exist
      if (data.length === 0) {
        await Promise.all(DEFAULT_COMMUNITIES.map(c => addDoc(collection(db, 'communities'), c)))
      } else {
        setCommunities(data)
        setLoading(false)
      }
    })
    return unsub
  }, [])

  const joinLeave = async (c: Community) => {
    if (!uid) return
    const ref = doc(db, 'communities', c.id)
    const isMember = c.members?.includes(uid)
    await updateDoc(ref, {
      members: isMember ? arrayRemove(uid) : arrayUnion(uid),
      memberCount: increment(isMember ? -1 : 1),
    })
  }

  const createCommunity = async () => {
    if (!newName.trim() || !uid) return
    setCreating(true)
    await addDoc(collection(db, 'communities'), {
      name: newName.trim(), description: newDesc.trim(),
      emoji: newEmoji, category: newCat,
      createdBy: uid, createdByNickname: myNickname,
      memberCount: 1, members: [uid],
      createdAt: Date.now(), isOfficial: false,
    } satisfies Omit<Community, 'id'>)
    setNewName(''); setNewDesc(''); setNewEmoji('📚'); setNewCat('Study')
    setCreating(false); setShowCreate(false)
  }

  const cats = ['All', ...COMMUNITY_CATEGORIES]
  const filtered = catFilter === 'All' ? communities : communities.filter(c => c.category === catFilter)
  const mine = filtered.filter(c => c.members?.includes(uid))
  const others = filtered.filter(c => !c.members?.includes(uid))

  return (
    <>
      {/* Category filter */}
      <div className={s.catFilterRow}>
        {cats.map(cat => (
          <button key={cat}
            className={catFilter === cat ? s.catPillActive : s.catPill}
            onClick={() => setCatFilter(cat)}>{cat}</button>
        ))}
      </div>

      {/* Create button */}
      <button className={s.createCommunityBtn} onClick={() => setShowCreate(true)}>
        ➕ Create a Community
      </button>

      {/* Create modal */}
      {showCreate && (
        <div className={s.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className={s.modal}>
            <div className={s.modalTitle}>🏘️ Create a Community</div>
            <div className={s.emojiPickerRow}>
              {COMMUNITY_EMOJIS.map(e => (
                <button key={e} onClick={() => setNewEmoji(e)}
                  className={newEmoji === e ? s.emojiActive : s.emojiBtn}>{e}</button>
              ))}
            </div>
            <input className={s.modalInput} placeholder="Community name (e.g. Late Night Studiers)"
              value={newName} onChange={e => setNewName(e.target.value)} maxLength={40} />
            <textarea className={s.modalTextarea} style={{ minHeight: 70 }}
              placeholder="What's this community about? (optional)"
              value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} />
            <select className={s.modalInput} value={newCat}
              onChange={e => setNewCat(e.target.value as Community['category'])}>
              {COMMUNITY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className={s.modalActions}>
              <button className={s.btnCancel} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className={s.btnSubmit} onClick={createCommunity}
                disabled={creating || !newName.trim()}>
                {creating ? 'Creating…' : '🚀 Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className={s.loader}>Loading communities…</div> : (
        <>
          {mine.length > 0 && (
            <>
              <div className={s.sectionLabel}>📌 Your Communities</div>
              <div className={s.communityGrid}>
                {mine.map(c => <CommunityCard key={c.id} c={c} uid={uid} onJoinLeave={joinLeave} onOpen={() => nav(`/community/${c.id}`)} />)}
              </div>
            </>
          )}
          <div className={s.sectionLabel}>{mine.length > 0 ? '🌐 Discover More' : '🌐 All Communities'}</div>
          {others.length === 0
            ? <div className={s.empty}><span>🏘️</span><p>No communities found.<br />Create the first one!</p></div>
            : <div className={s.communityGrid}>
                {others.map(c => <CommunityCard key={c.id} c={c} uid={uid} onJoinLeave={joinLeave} onOpen={() => nav(`/community/${c.id}`)} />)}
              </div>
          }
        </>
      )}
    </>
  )
}

function CommunityCard({ c, uid, onJoinLeave, onOpen }: {
  c: Community; uid: string; onJoinLeave: (c: Community) => void; onOpen: () => void
}) {
  const isMember = c.members?.includes(uid)
  const CAT_COLORS: Record<string, string> = {
    Study: '#3b5bdb', Hobby: '#e67700', Faculty: '#0ca678',
    'Buddy Hunt': '#c2255c', Wellness: '#6741d9', Other: '#495057',
  }
  return (
    <div className={s.communityCard}>
      <div className={s.communityEmoji}>{c.emoji}</div>
      <div className={s.communityInfo}>
        <div className={s.communityName}>
          {c.name}
          {c.isOfficial && <span className={s.officialBadge}>✦ Official</span>}
        </div>
        <div className={s.communityDesc}>{c.description}</div>
        <div className={s.communityMeta}>
          <span className={s.catTag} style={{ background: CAT_COLORS[c.category] + '22', color: CAT_COLORS[c.category], borderColor: CAT_COLORS[c.category] + '55' }}>
            {c.category}
          </span>
          <span className={s.memberCount}>👥 {c.memberCount}</span>
        </div>
      </div>
      <div className={s.communityActions}>
        <button className={s.openBtn} onClick={onOpen}>💬 Open</button>
        <button
          className={isMember ? s.leaveBtn : s.joinBtn}
          onClick={e => { e.stopPropagation(); onJoinLeave(c) }}>
          {isMember ? 'Leave' : 'Join'}
        </button>
      </div>
    </div>
  )
}

// ── HELP BOARD TAB ────────────────────────────────────────────────────────────
function HelpBoardTab({ uid, myNickname, myAvatar }: { uid: string; myNickname: string; myAvatar: string }) {
  const [posts, setPosts] = useState<HelpPost[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | 'need' | 'offer'>('all')
  const [subjectFilter, setSubjectFilter] = useState<string>('All')
  const [showForm, setShowForm] = useState(false)
  // form
  const [type, setType] = useState<'need' | 'offer'>('need')
  const [subject, setSubject] = useState<SubjectStrength | ''>('')
  const [detail, setDetail] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'helpBoard'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpPost)))
      setLoading(false)
    })
  }, [])

  const postHelp = async () => {
    if (!uid || !subject || !detail.trim()) return
    setPosting(true)
    await addDoc(collection(db, 'helpBoard'), {
      uid, nickname: myNickname, photoURL: myAvatar,
      type, subject, detail: detail.trim(),
      resolved: false, createdAt: Date.now(),
    } satisfies Omit<HelpPost, 'id'>)
    setDetail(''); setSubject(''); setPosting(false); setShowForm(false)
  }

  const toggleResolved = async (p: HelpPost) => {
    if (p.uid !== uid) return
    await updateDoc(doc(db, 'helpBoard', p.id), { resolved: !p.resolved })
  }

  const timeAgo = (ts: number) => {
    const d = Date.now() - ts
    if (d < 60000) return 'just now'
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`
    return `${Math.floor(d / 86400000)}d ago`
  }

  const filtered = posts
    .filter(p => typeFilter === 'all' || p.type === typeFilter)
    .filter(p => subjectFilter === 'All' || p.subject === subjectFilter)

  return (
    <>
      {/* Type filter */}
      <div className={s.helpFilterRow}>
        {(['all', 'need', 'offer'] as const).map(f => (
          <button key={f}
            className={typeFilter === f ? s.helpPillActive : s.helpPill}
            onClick={() => setTypeFilter(f)}>
            {f === 'all' ? '📋 All' : f === 'need' ? '🙋 Need Help' : '🤓 Offering Help'}
          </button>
        ))}
      </div>

      {/* Subject filter */}
      <div className={s.filterTags} style={{ marginBottom: 12 }}>
        <button className={subjectFilter === 'All' ? s.filterTagActive : s.filterTag}
          style={subjectFilter === 'All' ? { background: '#0d2760', color: '#fff', borderColor: '#0d2760' } : {}}
          onClick={() => setSubjectFilter('All')}>All Subjects</button>
        {HELP_SUBJECTS.map(sub => (
          <button key={sub}
            className={subjectFilter === sub ? s.filterTagActive : s.filterTag}
            style={subjectFilter === sub ? { background: '#eef2ff', color: '#3b5bdb', borderColor: '#bac8ff' } : {}}
            onClick={() => setSubjectFilter(sub)}>
            {sub.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Post button */}
      <button className={s.createCommunityBtn} onClick={() => setShowForm(v => !v)}>
        {showForm ? '✕ Cancel' : '✏️ Post a Help Request / Offer'}
      </button>

      {/* Post form */}
      {showForm && (
        <div className={s.helpForm}>
          <div className={s.helpTypeToggle}>
            {(['need', 'offer'] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={type === t ? s.helpTypeActive : s.helpTypeBtn}>
                {t === 'need' ? '🙋 I Need Help' : '🤓 I Can Help'}
              </button>
            ))}
          </div>
          <select className={s.modalInput} value={subject}
            onChange={e => setSubject(e.target.value as SubjectStrength)}>
            <option value="">Select subject…</option>
            {HELP_SUBJECTS.map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>
          <textarea className={s.modalTextarea} style={{ minHeight: 80 }}
            value={detail} onChange={e => setDetail(e.target.value)}
            placeholder="Add details: topic, urgency, availability, what you need…" />
          <button className={s.btnSubmit} style={{ borderRadius: 10, padding: '10px' }}
            onClick={postHelp} disabled={posting || !subject || !detail.trim()}>
            {posting ? 'Posting…' : '📌 Post to Help Board'}
          </button>
        </div>
      )}

      {/* Posts */}
      {loading ? <div className={s.loader}>Loading…</div>
        : filtered.length === 0
          ? <div className={s.empty}><span>🙋</span><p>No posts yet.<br />Be the first to ask or offer help!</p></div>
          : filtered.map(p => (
            <div key={p.id} className={s.helpCard} style={{ opacity: p.resolved ? 0.6 : 1 }}>
              <div className={s.helpCardTop}>
                <span className={p.type === 'need' ? s.helpNeedBadge : s.helpOfferBadge}>
                  {p.type === 'need' ? '🙋 Needs Help' : '🤓 Offering Help'}
                </span>
                {p.resolved && <span className={s.resolvedBadge}>✅ Resolved</span>}
                <span className={s.helpTime}>{timeAgo(p.createdAt)}</span>
              </div>
              <div className={s.helpSubject}>{p.subject}</div>
              <p className={s.helpDetail}>{p.detail}</p>
              <div className={s.helpCardFooter}>
                <div className={s.helpAuthorRow}>
                  {p.photoURL
                    ? <img src={p.photoURL} className={s.helpAvatar} alt={p.nickname} />
                    : <div className={s.helpAvatarFallback}>{p.nickname?.[0]?.toUpperCase()}</div>
                  }
                  <span className={s.helpNickname}>u/{p.nickname}</span>
                </div>
                {p.uid === uid && (
                  <button className={s.resolveBtn} onClick={() => toggleResolved(p)}>
                    {p.resolved ? '↩ Reopen' : '✅ Mark Resolved'}
                  </button>
                )}
              </div>
            </div>
          ))
      }
    </>
  )
}

// ── MAIN FeedPage ─────────────────────────────────────────────────────────────
export default function FeedPage() {
  const [tab, setTab] = useState<'feed' | 'communities' | 'help'>('feed')
  const [myAvatar, setMyAvatar] = useState('')
  const [myNickname, setMyNickname] = useState('')
  const uid = auth.currentUser?.uid ?? ''

  useEffect(() => {
    if (!uid) return
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) {
        setMyAvatar(snap.data().photoURL ?? '')
        setMyNickname(snap.data().nickname ?? '')
      }
    })
  }, [uid])

  const TABS = [
    { key: 'feed',        label: '🌐 Feed' },
    { key: 'communities', label: '🏘️ Communities' },
    { key: 'help',        label: '🙋 Help Board' },
  ] as const

  return (
    <div className={s.wrap}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.headerTop}>
          <div className={s.subredditIcon}>💬</div>
          <div>
            <div className={s.title}>r/HKBUCampus</div>
            <div className={s.sub}>The HKBU student community</div>
          </div>
        </div>
      </div>

      {/* Main tab switcher */}
      <div className={s.mainTabs}>
        {TABS.map(t => (
          <button key={t.key}
            className={tab === t.key ? s.mainTabActive : s.mainTab}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'feed'        && <FeedTab uid={uid} myNickname={myNickname} myAvatar={myAvatar} />}
      {tab === 'communities' && <CommunitiesTab uid={uid} myNickname={myNickname} />}
      {tab === 'help'        && <HelpBoardTab uid={uid} myNickname={myNickname} myAvatar={myAvatar} />}
    </div>
  )
}
