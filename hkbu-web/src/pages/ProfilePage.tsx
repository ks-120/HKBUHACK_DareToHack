import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import { UserProfile, Interest } from '../types'
import AvatarUpload from '../components/AvatarUpload'
import s from './Page.module.css'

const ALL_INTERESTS: Interest[] = [
  'Sports / Fitness', 'Hiking', 'Language Exchange', 'Music / Singing', 'Gaming / Esports',
  'Study Groups', 'Photography', 'Cooking / Food', 'Travel / Exploring HK',
  'Art & Design', 'Tech & Coding', 'Film / Drama / Anime',
  'Volunteering', 'Debate / Public Speaking', 'Yoga / Martial Arts', 'Religion / Mindfulness',
]

export default function ProfilePage() {
  const [profile, setProfile]     = useState<UserProfile | null>(null)
  const [editing, setEditing]     = useState(false)
  const [nickname, setNickname]   = useState('')
  const [bio, setBio]             = useState('')
  const [interests, setInterests] = useState<Interest[]>([])
  const [photoURL, setPhotoURL]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [missing, setMissing]     = useState(false)

  useEffect(() => {
    const user = auth.currentUser
    if (!user) return
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile
        setProfile(data)
        setNickname(data.nickname)
        setBio(data.bio ?? '')
        setInterests(data.interests ?? [])
        setPhotoURL(data.photoURL ?? '')
      } else {
        setMissing(true)
      }
    })
  }, [])

  const toggleInterest = (i: Interest) =>
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])

  const handleSave = async () => {
    const user = auth.currentUser
    if (!user || !nickname.trim()) return
    setSaving(true)
    // merge: true preserves ALL other fields (studyStyles, buddyTypes, etc.)
    // we only update the fields exposed in this edit form
    const updates: Partial<UserProfile> = {
      nickname: nickname.trim(),
      bio:      bio.trim(),
      interests,
      photoURL,
    }
    await setDoc(doc(db, 'users', user.uid), updates, { merge: true })
    setProfile(p => p ? { ...p, ...updates } : p)
    setMissing(false)
    setSaving(false)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handlePhotoChange = async (url: string) => {
    setPhotoURL(url)
    const user = auth.currentUser
    if (!user) return
    await setDoc(doc(db, 'users', user.uid), { photoURL: url }, { merge: true })
    setProfile(p => p ? { ...p, photoURL: url } : p)
  }

  if (missing) {
    return (
      <div className={s.pageWrap}>
        <h2 className={s.pageTitle}>Complete Your Profile 👤</h2>
        <p className={s.pageSub}>Your account exists but your profile isn't set up yet.</p>
        <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: 24,
          border: '1px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <AvatarUpload uid={auth.currentUser!.uid} currentURL={photoURL} nickname={nickname || '?'}
            onUploaded={url => setPhotoURL(url)} />
          <div style={{ width: '100%' }}>
            <p className={s.label}>Nickname</p>
            <input className={s.input} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="e.g. BuddyKing" />
          </div>
          <div style={{ width: '100%' }}>
            <p className={s.label}>Interests (select at least one)</p>
            <div className={s.chipGrid} style={{ marginTop: 8 }}>
              {ALL_INTERESTS.map(i => (
                <button key={i} type="button"
                  className={interests.includes(i) ? s.chipActive : s.chip}
                  onClick={() => toggleInterest(i)}>{i}</button>
              ))}
            </div>
          </div>
          <button className={s.btnPrimary} style={{ width: '100%' }} onClick={handleSave}
            disabled={saving || !nickname.trim() || interests.length === 0}>
            {saving ? 'Saving…' : 'Save Profile 🎉'}
          </button>
        </div>
      </div>
    )
  }

  if (!profile) return <div className={s.loader}>Loading profile…</div>

  return (
    <div className={s.pageWrap}>
      <h2 className={s.pageTitle}>My Profile 👤</h2>
      <p className={s.pageSub}>Your HKBU Buddy account details</p>

      {/* Avatar + info card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24,
        background: 'var(--bg2)', borderRadius: 16, padding: 24, border: '1px solid var(--border)' }}>
        <AvatarUpload uid={profile.uid} currentURL={photoURL}
          nickname={profile.nickname} onUploaded={handlePhotoChange} />
        <div style={{ overflow: 'hidden' }}>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{profile.nickname}</div>
          <div style={{ color: 'var(--text2)', fontSize: 14, marginTop: 4 }}>{profile.email}</div>
          {profile.major && (
            <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>
              📚 {profile.major}{profile.yearOfStudy ? ` · ${profile.yearOfStudy}` : ''}
            </div>
          )}
          <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 4 }}>
            🗓 Joined {new Date(profile.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Read-only summary cards */}
      {!editing && (
        <>
          {profile.bio && (
            <div style={{ background: 'var(--bg2)', borderRadius: 14, padding: '14px 16px',
              border: '1px solid var(--border)', marginBottom: 12 }}>
              <p className={s.label}>Bio</p>
              <p style={{ color: '#fff', fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>{profile.bio}</p>
            </div>
          )}

          {(profile.studyStyles ?? []).length > 0 && (
            <div style={{ background: 'var(--bg2)', borderRadius: 14, padding: '14px 16px',
              border: '1px solid var(--border)', marginBottom: 12 }}>
              <p className={s.label}>Study Style</p>
              <div className={s.chipGrid} style={{ marginTop: 8 }}>
                {(profile.studyStyles ?? []).map(i => <span key={i} className={s.chipActive}>{i}</span>)}
              </div>
            </div>
          )}

          {(profile.buddyTypes ?? []).length > 0 && (
            <div style={{ background: 'var(--bg2)', borderRadius: 14, padding: '14px 16px',
              border: '1px solid var(--border)', marginBottom: 12 }}>
              <p className={s.label}>Looking For</p>
              <div className={s.chipGrid} style={{ marginTop: 8 }}>
                {(profile.buddyTypes ?? []).map(i => <span key={i} className={s.chipActive}>{i}</span>)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Interests + edit */}
      {editing ? (
        <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: 24,
          border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p className={s.label}>Nickname</p>
            <input className={s.input} value={nickname}
              onChange={e => setNickname(e.target.value)} placeholder="Your nickname" />
          </div>
          <div>
            <p className={s.label}>Bio <span style={{ fontWeight: 400, color: 'var(--text2)' }}>(optional)</span></p>
            <textarea className={s.input} style={{ resize: 'vertical', minHeight: 72 }}
              value={bio} maxLength={150}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell people a little about yourself…" />
          </div>
          <div>
            <p className={s.label}>Interests</p>
            <div className={s.chipGrid} style={{ marginTop: 8 }}>
              {ALL_INTERESTS.map(i => (
                <button key={i} type="button"
                  className={interests.includes(i) ? s.chipActive : s.chip}
                  onClick={() => toggleInterest(i)}>{i}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={s.btnPrimary} onClick={handleSave}
              disabled={saving || !nickname.trim()}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button className={s.btnGhost} onClick={() => {
              setNickname(profile.nickname)
              setBio(profile.bio ?? '')
              setInterests(profile.interests ?? [])
              setEditing(false)
            }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: 24,
          border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p className={s.label}>Interests</p>
            <div className={s.chipGrid} style={{ marginTop: 10 }}>
              {(profile.interests ?? []).length > 0
                ? (profile.interests ?? []).map(i => <span key={i} className={s.chipActive}>{i}</span>)
                : <span style={{ color: 'var(--text2)', fontSize: 14 }}>No interests set yet.</span>}
            </div>
          </div>
          <button className={s.btnGhost} onClick={() => setEditing(true)}>✏️ Edit Profile</button>
          {saved && <p style={{ color: 'var(--accent3)', fontSize: 14 }}>✅ Profile updated!</p>}
        </div>
      )}
    </div>
  )
}
