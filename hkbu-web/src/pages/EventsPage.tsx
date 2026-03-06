import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, increment, addDoc, getDoc, deleteDoc
} from 'firebase/firestore'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { auth, db } from '../config/firebaseConfig'
import { Event } from '../types'
import s from './Page.module.css'

const EMOJI_OPTIONS = ['🎉','🎵','🏃','🎨','🍜','📷','🎬','🎮','💻','🧘','🤝','📚','🛠️','🎭','✈️']

function proxyImg(url: string): string {
  if (!url) return ''
  return url.replace('https://sa.hkbu.edu.hk', '/hkbu-img')
}

const BLANK = { title: '', description: '', date: null as Date | null, time: '', location: '', emoji: '🎉' }

// ── reusable modal form ───────────────────────────────────────────────────────
function EventForm({
  title: modalTitle,
  form, setForm, onSubmit, onCancel,
  submitting, formError,
}: {
  title: string
  form: typeof BLANK
  setForm: React.Dispatch<React.SetStateAction<typeof BLANK>>
  onSubmit: () => void
  onCancel: () => void
  submitting: boolean
  formError: string
}) {
  const canSubmit = !submitting && !!form.title.trim() && !!form.date && !!form.location.trim()
  return (
    <div className={s.eventModalOverlay} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className={s.eventModal}>
        <div className={s.eventModalTitle}>{modalTitle}</div>

        <div>
          <p className={s.eventModalLabel}>Title *</p>
          <input className={s.eventModalInput} placeholder="e.g. Friday Board Game Night"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>

        <div>
          <p className={s.eventModalLabel}>Description</p>
          <textarea className={s.eventModalTextarea} rows={3}
            placeholder="What's the event about? Who should join?"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>

        <div className={s.eventModalRow}>
          {/* ── Calendar date picker ── */}
          <div>
            <p className={s.eventModalLabel}>Date *</p>
            <div className={s.datePickerWrapper}>
              <DatePicker
                selected={form.date}
                onChange={(d: Date | null) => setForm(f => ({ ...f, date: d }))}
                minDate={new Date()}
                dateFormat="MMM dd, yyyy"
                placeholderText="Pick a date…"
                className={s.eventModalInput}
                popperPlacement="bottom-start"
              />
            </div>
          </div>
          <div>
            <p className={s.eventModalLabel}>Time</p>
            <input className={s.eventModalInput} placeholder="e.g. 6:00 PM"
              value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
          </div>
        </div>

        <div>
          <p className={s.eventModalLabel}>Location *</p>
          <input className={s.eventModalInput} placeholder="e.g. LT3, Academic Building"
            value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
        </div>

        <div>
          <p className={s.eventModalLabel}>Emoji</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {EMOJI_OPTIONS.map(em => (
              <button key={em} type="button" onClick={() => setForm(f => ({ ...f, emoji: em }))}
                style={{
                  fontSize: 22, padding: '4px 8px', borderRadius: 8, cursor: 'pointer',
                  border: form.emoji === em ? '2px solid var(--accent)' : '2px solid transparent',
                  background: form.emoji === em ? 'var(--bg3)' : 'none',
                }}>{em}</button>
            ))}
          </div>
        </div>

        {formError && <p className={s.errorMsg}>⚠ {formError}</p>}

        <div className={s.eventModalActions}>
          <button className={s.eventModalCancel} onClick={onCancel}>Cancel</button>
          <button className={s.eventModalSubmit} onClick={onSubmit} disabled={!canSubmit}>
            {submitting ? 'Saving…' : 'Save Event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const nav = useNavigate()
  const [events, setEvents]           = useState<Event[]>([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<'official' | 'student'>('official')
  const [showCreate, setShowCreate]   = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [form, setForm]               = useState(BLANK)
  const [editForm, setEditForm]       = useState(BLANK)
  const [submitting, setSubmitting]   = useState(false)
  const [formError, setFormError]     = useState('')

  const uid = auth.currentUser?.uid ?? ''

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Event)))
      setLoading(false)
    })
  }, [])

  // ── format Date → "Mar 15, 2026" string ──────────────────────────────────
  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : ''

  // ── parse stored date string back to Date object for the picker ──────────
  const parseDate = (s: string): Date | null => {
    if (!s) return null
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }

  // ── RSVP ────────────────────────────────────────────────────────────────
  const handleRSVP = async (ev: Event) => {
    if (!uid) return
    if (ev.rsvpedBy?.includes(uid)) return
    await updateDoc(doc(db, 'events', ev.id), {
      rsvpCount: increment(1),
      rsvpedBy: [...(ev.rsvpedBy ?? []), uid],
    })
  }

  // ── Create ───────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setFormError('')
    if (!form.title.trim())    return setFormError('Title is required.')
    if (!form.date)            return setFormError('Date is required.')
    if (!form.location.trim()) return setFormError('Location is required.')
    if (!uid) return
    setSubmitting(true)
    const snap = await getDoc(doc(db, 'users', uid))
    const nickname = snap.exists() ? snap.data().nickname : 'Anonymous'
    await addDoc(collection(db, 'events'), {
      title:             form.title.trim(),
      description:       form.description.trim() || 'A student-organised event.',
      date:              fmtDate(form.date),
      time:              form.time.trim(),
      location:          form.location.trim(),
      emoji:             form.emoji,
      source:            'student',
      createdByUid:      uid,
      createdByNickname: nickname,
      createdAt:         Date.now(),
      rsvpCount:         0,
      rsvpedBy:          [],
    })
    setForm(BLANK)
    setSubmitting(false)
    setShowCreate(false)
    setTab('student')
  }

  // ── Edit ─────────────────────────────────────────────────────────────────
  const openEdit = (ev: Event) => {
    setEditForm({
      title:       ev.title,
      description: ev.description,
      date:        parseDate(ev.date),
      time:        ev.time ?? '',
      location:    ev.location,
      emoji:       ev.emoji,
    })
    setEditingEvent(ev)
    setFormError('')
  }

  const handleEdit = async () => {
    if (!editingEvent) return
    setFormError('')
    if (!editForm.title.trim())    return setFormError('Title is required.')
    if (!editForm.date)            return setFormError('Date is required.')
    if (!editForm.location.trim()) return setFormError('Location is required.')
    setSubmitting(true)
    await updateDoc(doc(db, 'events', editingEvent.id), {
      title:       editForm.title.trim(),
      description: editForm.description.trim() || 'A student-organised event.',
      date:        fmtDate(editForm.date),
      time:        editForm.time.trim(),
      location:    editForm.location.trim(),
      emoji:       editForm.emoji,
    })
    setSubmitting(false)
    setEditingEvent(null)
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (ev: Event) => {
    if (!window.confirm(`Delete "${ev.title}"?`)) return
    await deleteDoc(doc(db, 'events', ev.id))
  }

  const official = events.filter(e => e.source !== 'student')
  const student  = events.filter(e => e.source === 'student')
  const visible  = tab === 'official' ? official : student

  // ── card ─────────────────────────────────────────────────────────────────
  const EventCard = ({ ev }: { ev: Event }) => {
    const going     = ev.rsvpedBy?.includes(uid)
    const isStudent = ev.source === 'student'
    const isOwner   = isStudent && ev.createdByUid === uid

    return (
      <div className={s.eventCard}>
        {ev.imageUrl
          ? <img src={proxyImg(ev.imageUrl)} alt={ev.title} className={s.eventImg} />
          : <div className={s.eventImgFallback}>{ev.emoji ?? '🎉'}</div>
        }
        <div className={s.eventBody}>
          {isStudent && <span className={s.studentBadge}>👤 Student Event</span>}

          <h3 className={s.eventTitle}>{ev.title}</h3>
          <p className={s.eventMeta}>
            📅 {ev.date}
            {ev.time && <>&nbsp;·&nbsp;🕐 {ev.time}</>}
            &nbsp;·&nbsp;📍 {ev.location}
          </p>
          {isStudent && ev.createdByNickname && (
            <p className={s.eventCreator}>
              {isOwner ? '✏️ Your event' : `Posted by ${ev.createdByNickname}`}
            </p>
          )}
          <p className={s.eventDesc}>{ev.description}</p>

          <div className={s.eventFooter}>
            <span className={s.rsvpCount}>👥 {ev.rsvpCount ?? 0} going</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {ev.detailUrl && (
                <a href={ev.detailUrl} target="_blank" rel="noopener noreferrer"
                  className={s.btnGhost}
                  style={{ padding: '8px 14px', fontSize: 13, width: 'auto' }}>
                  Details ↗
                </a>
              )}

              {/* owner: edit + delete. others: RSVP */}
              {isOwner ? (
                <>
                  <button className={s.btnEdit} onClick={() => openEdit(ev)}>✏️ Edit</button>
                  <button className={s.btnDone}
                    style={{ cursor: 'pointer', color: '#e53935', background: '#ffeaea' }}
                    onClick={() => handleDelete(ev)}>
                    🗑 Delete
                  </button>
                </>
              ) : (
                <button
                  className={going ? s.btnDone : s.btnAccent2}
                  onClick={() => handleRSVP(ev)}
                  disabled={!!going}
                >
                  {going ? '✓ Going' : 'RSVP'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={s.pageWrap}>
      <button className={s.backBtn} onClick={() => nav('/main')}>← Back</button>
      <h2 className={s.pageTitle}>Campus Events 🎉</h2>
      <p className={s.pageSub}>Browse official HKBU events or discover student-organised ones</p>

      {/* Tabs */}
      <div className={s.eventTabs}>
        <button className={tab === 'official' ? s.eventTabActive : s.eventTab}
          onClick={() => setTab('official')}>
          🏫 Official ({official.length})
        </button>
        <button className={tab === 'student' ? s.eventTabActive : s.eventTab}
          onClick={() => setTab('student')}>
          👤 Student ({student.length})
        </button>
      </div>

      {/* Create button — student tab only */}
      {tab === 'student' && (
        <button className={s.createEventBtn} onClick={() => { setForm(BLANK); setShowCreate(true) }}>
          ＋ Create a Student Event
        </button>
      )}

      {/* Create modal */}
      {showCreate && (
        <EventForm
          title="Create a Student Event"
          form={form} setForm={setForm}
          onSubmit={handleCreate}
          onCancel={() => { setShowCreate(false); setFormError('') }}
          submitting={submitting} formError={formError}
        />
      )}

      {/* Edit modal */}
      {editingEvent && (
        <EventForm
          title="Edit Event"
          form={editForm} setForm={setEditForm}
          onSubmit={handleEdit}
          onCancel={() => { setEditingEvent(null); setFormError('') }}
          submitting={submitting} formError={formError}
        />
      )}

      {/* List */}
      {loading ? (
        <div className={s.loader}>Loading events…</div>
      ) : visible.length === 0 ? (
        <div className={s.empty}>
          <span>{tab === 'student' ? '🙌' : '📭'}</span>
          <p>{tab === 'student'
            ? 'No student events yet.\nBe the first to create one!'
            : 'No official events found.\nCheck back soon!'}
          </p>
        </div>
      ) : (
        <div className={s.eventList}>
          {visible.map(ev => <EventCard key={ev.id} ev={ev} />)}
        </div>
      )}
    </div>
  )
}
