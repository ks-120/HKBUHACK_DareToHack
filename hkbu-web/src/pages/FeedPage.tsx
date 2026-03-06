import { useEffect, useState, useRef } from 'react'
import { collection, onSnapshot, query, orderBy, addDoc, doc, getDoc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import { Post, Comment } from '../types'
import s from './FeedPage.module.css'

const TAGS = ['#Study', '#Event', '#Groupmates', '#Housing', '#Sport', '#Food', '#Misc']
const SORT_OPTIONS = [
  { key: 'hot',      label: '🔥 Hot',        title: 'Popular recently' },
  { key: 'new',      label: '✨ New',         title: 'Most recent first' },
  { key: 'top',      label: '🏆 Top',         title: 'Most liked of all time' },
  { key: 'comments', label: '💬 Most Active', title: 'Most commented' },
]

const photoCache: Record<string, string> = {}

// ── Per-post comment sub-component ───────────────────────────────────────────
function CommentSection({ post, uid, myNickname, avatars }: {
  post: Post; uid: string; myNickname: string; avatars: Record<string, string>
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const q = query(
      collection(db, 'posts', post.id, 'comments'),
      orderBy('createdAt', 'asc')
    )
    return onSnapshot(q, snap =>
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)))
    )
  }, [post.id])

  const timeAgo = (ts: number) => {
    const d = Date.now() - ts
    if (d < 60000)    return 'just now'
    if (d < 3600000)  return `${Math.floor(d / 60000)}m ago`
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
    // keep commentCount in sync on the parent post
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
        <input
          className={s.commentInput}
          placeholder="Write a comment…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        />
        <button className={s.commentSubmit} onClick={submit}
          disabled={submitting || !text.trim()}>
          Reply
        </button>
      </div>
    </div>
  )
}

// ── Top-3 Pinned Cards ────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPostBadge(p: Post, allPosts: Post[]): { label: string; cls: string } | null {
  const net = (p.upvotes ?? 0) - (p.downvotes ?? 0)
  const maxNet = Math.max(...allPosts.map(x => (x.upvotes ?? 0) - (x.downvotes ?? 0)))
  const maxComments = Math.max(...allPosts.map(x => x.commentCount ?? 0))

  if (net === maxNet && net > 0)                          return { label: '🏆 Top',      cls: s.badgeTop }
  if ((p.commentCount ?? 0) === maxComments && maxComments > 0) return { label: '💬 Hot Topic', cls: s.badgeHot }
  const ageHours = (Date.now() - p.createdAt) / 3_600_000
  if (ageHours < 2 && (p.upvotes ?? 0) > 0)             return { label: '✨ New',       cls: s.badgeNew }
  return null
}

// ── Main FeedPage ─────────────────────────────────────────────────────────────
export default function FeedPage() {
  const [posts, setPosts]               = useState<Post[]>([])
  const [avatars, setAvatars]           = useState<Record<string, string>>({})
  const [myAvatar, setMyAvatar]         = useState('')
  const [myNickname, setMyNickname]     = useState('')
  const [content, setContent]           = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filter, setFilter]             = useState('All')
  const [sort, setSort]                 = useState('hot')
  const [loading, setLoading]           = useState(true)
  const [posting, setPosting]           = useState(false)
  const [showModal, setShowModal]       = useState(false)
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
  const [toast, setToast]               = useState('')
  const toastTimer                      = useRef<ReturnType<typeof setTimeout> | null>(null)

  const uid = auth.currentUser?.uid ?? ''

  useEffect(() => {
    if (uid) {
      getDoc(doc(db, 'users', uid)).then(snap => {
        if (snap.exists()) {
          setMyAvatar(snap.data().photoURL ?? '')
          setMyNickname(snap.data().nickname ?? '')
        }
      })
    }
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, async snap => {
      const newPosts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post))
      setPosts(newPosts)
      setLoading(false)
      const unknownUids = [...new Set(newPosts.map(p => p.authorUid))].filter(u => !(u in photoCache))
      await Promise.all(unknownUids.map(async u => {
        const s = await getDoc(doc(db, 'users', u))
        photoCache[u] = s.exists() ? (s.data().photoURL ?? '') : ''
      }))
      setAvatars({ ...photoCache })
    })
    return unsub
  }, [uid])

  const handlePost = async () => {
    if (!content.trim() || !uid) return
    setPosting(true)
    const snap = await getDoc(doc(db, 'users', uid))
    const nickname = snap.exists() ? snap.data().nickname : 'Anonymous'
    await addDoc(collection(db, 'posts'), {
      authorUid: uid, authorNickname: nickname,
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
    const hasUp   = post.upvotedBy?.includes(uid)
    const hasDown = post.downvotedBy?.includes(uid)
    if (dir === 'up') {
      if (hasUp)        await updateDoc(ref, { upvotes: increment(-1), upvotedBy: arrayRemove(uid) })
      else if (hasDown) await updateDoc(ref, { upvotes: increment(1), upvotedBy: arrayUnion(uid), downvotes: increment(-1), downvotedBy: arrayRemove(uid) })
      else              await updateDoc(ref, { upvotes: increment(1), upvotedBy: arrayUnion(uid) })
    } else {
      if (hasDown)     await updateDoc(ref, { downvotes: increment(-1), downvotedBy: arrayRemove(uid) })
      else if (hasUp)  await updateDoc(ref, { downvotes: increment(1), downvotedBy: arrayUnion(uid), upvotes: increment(-1), upvotedBy: arrayRemove(uid) })
      else             await updateDoc(ref, { downvotes: increment(1), downvotedBy: arrayUnion(uid) })
    }
  }

  // 🔗 Share — copy per-post URL & show toast
  const handleShare = (postId: string) => {
    const url = `${window.location.origin}/feed#${postId}`
    navigator.clipboard.writeText(url)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast('🔗 Link copied!')
    toastTimer.current = setTimeout(() => setToast(''), 1800)
  }

  // 🚩 Report — flag in Firestore, one report per user
  const handleReport = async (post: Post) => {
    if (!uid) return
    if (post.reportedBy?.includes(uid)) return
    if (!window.confirm('Report this post as inappropriate?')) return
    await updateDoc(doc(db, 'posts', post.id), { reportedBy: arrayUnion(uid) })
  }

  // 💬 Toggle comments open/closed
  const toggleComments = (postId: string) =>
    setOpenComments(prev => ({ ...prev, [postId]: !prev[postId] }))

  const timeAgo = (ts: number) => {
    const d = Date.now() - ts
    if (d < 60000)    return 'just now'
    if (d < 3600000)  return `${Math.floor(d / 60000)}m ago`
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
    <div className={s.wrap}>
      {/* Share toast */}
      {toast && <div className={s.toast}>{toast}</div>}

      {/* Header */}
      <div className={s.header}>
        <div className={s.headerTop}>
          <div className={s.subredditIcon}>💬</div>
          <div>
            <div className={s.title}>r/HKBUCampus</div>
            <div className={s.sub}>The HKBU student community · {posts.length} posts</div>
          </div>
        </div>
      </div>

      {/* Top 3 pinned */}
      {!loading && <PinnedSection posts={posts} avatars={avatars} />}

      {/* Compose trigger */}
      <div className={s.composeBox} onClick={() => setShowModal(true)}>
        <div className={s.composeAvatar}>
          {myAvatar ? <img src={myAvatar} alt="me" /> : '👤'}
        </div>
        <div className={s.composePlaceholder}>Create a post…</div>
      </div>

      {/* Post modal */}
      {showModal && (
        <div className={s.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className={s.modal}>
            <div className={s.modalTitle}>Create a Post</div>
            <textarea
              className={s.modalTextarea}
              placeholder="Looking for groupmates? Sharing news? Post it here…"
              value={content} onChange={e => setContent(e.target.value)}
              autoFocus rows={5}
            />
            <div className={s.tagRow}>
              {TAGS.map(t => (
                <button key={t} type="button"
                  className={selectedTags.includes(t) ? s.tagActive : s.tag}
                  onClick={() => setSelectedTags(prev =>
                    prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                  )}>
                  {t}
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

      {/* Sort + filter toolbar */}
      <div className={s.toolbar}>
        <div className={s.sortTabs}>
          {SORT_OPTIONS.map(o => (
            <button key={o.key} title={o.title}
              className={`${s.sortTab} ${sort === o.key ? s.sortTabActive : ''} ${s[`sortTab_${o.key}`]}`}
              onClick={() => setSort(o.key)}>
              {o.label}
            </button>
          ))}
        </div>
        <div className={s.divider} />
        <div className={s.filterTags}>
          <button className={filter === 'All' ? s.filterTagActive : s.filterTag}
            onClick={() => setFilter('All')}>All</button>
          {TAGS.map(t => (
            <button key={t}
              className={filter === t ? s.filterTagActive : s.filterTag}
              onClick={() => setFilter(t)}>{t}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      {loading ? (
        <div className={s.loader}>Loading posts…</div>
      ) : sorted.length === 0 ? (
        <div className={s.empty}>
          <span>📭</span>
          <p>No posts yet.<br />Be the first to post!</p>
        </div>
      ) : sorted.map(p => {
        const hasUp       = p.upvotedBy?.includes(uid)
        const hasDown     = p.downvotedBy?.includes(uid)
        const hasReported = p.reportedBy?.includes(uid)
        const badge       = getPostBadge(p, posts)
        const commentsOpen = !!openComments[p.id]

        return (
          <div key={p.id} id={p.id} className={s.postCard}>
            {/* Like / Dislike column */}
            <div className={s.voteSide}>
              <button
                className={`${s.likeBtn} ${hasUp ? s.likeBtnActive : ''}`}
                onClick={() => handleVote(p, 'up')}
                title="Like"
              >
                👍
                <span className={s.likeCount}>{p.upvotes ?? 0}</span>
              </button>
              <button
                className={`${s.dislikeBtn} ${hasDown ? s.dislikeBtnActive : ''}`}
                onClick={() => handleVote(p, 'down')}
                title="Dislike"
              >
                👎
                <span className={s.dislikeCount}>{p.downvotes ?? 0}</span>
              </button>
            </div>

            {/* Post content */}
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
                  {p.tags.map(t => <span key={t} className={s.postTag}>{t}</span>)}
                </div>
              )}

              <div className={s.postFooter}>
                {/* 💬 Comments — toggles inline thread */}
                <button className={s.footerBtn} onClick={() => toggleComments(p.id)}>
                  💬 {p.commentCount ?? 0} {commentsOpen ? 'Hide' : 'Comments'}
                </button>

                {/* 🔗 Share — copies per-post URL */}
                <button className={s.footerBtn} onClick={() => handleShare(p.id)}>
                  🔗 Share
                </button>

                {/* 🚩 Report — flags in Firestore */}
                {hasReported
                  ? <span className={s.footerBtnReported}>🚩 Reported</span>
                  : <button className={s.footerBtn} onClick={() => handleReport(p)}>
                      🚩 Report
                    </button>
                }
              </div>

              {/* Inline comment thread */}
              {commentsOpen && (
                <CommentSection
                  post={p} uid={uid}
                  myNickname={myNickname}
                  avatars={avatars}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
