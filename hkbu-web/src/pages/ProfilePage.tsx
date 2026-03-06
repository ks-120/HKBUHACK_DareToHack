import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import { UserProfile, Interest, StudyStyle, BuddyType, YearOfStudy, Faculty, Gender } from '../types'
import AvatarUpload from '../components/AvatarUpload'
import s from './Page.module.css'

const ALL_INTERESTS: Interest[] = [
  'Sports / Fitness', 'Hiking', 'Language Exchange', 'Music / Singing', 'Gaming / Esports',
  'Study Groups', 'Photography', 'Cooking / Food', 'Travel / Exploring HK',
  'Art & Design', 'Tech & Coding', 'Film / Drama / Anime',
  'Volunteering', 'Debate / Public Speaking', 'Yoga / Martial Arts', 'Religion / Mindfulness',
]

const ALL_STUDY_STYLES: StudyStyle[] = [
  'Quiet solo focus / Library', 'Group discussions / Brainstorming',
  'Explaining / Teaching others', 'Cafe / Relaxed vibe',
  'Late-night cramming', 'Early morning / Daytime only',
]

const ALL_BUDDY_TYPES: BuddyType[] = [
  'Study partner (same/similar major)', 'Casual hangout / Meals friend',
  'Hobby / Activity partner', 'Campus explorer / New to HK',
  'Freshman mentor / Guidance', 'Long-term support friend',
]

const YEARS: YearOfStudy[] = [
  'Year 1','Year 2','Year 3','Year 4','Year 5+',
  'Taught Postgraduate','Research Postgraduate','Exchange','Associate','Other',
]

const FACULTIES: Faculty[] = [
  'Faculty of Arts and Social Sciences','School of Business',
  'School of Chinese Medicine','School of Communication and Film',
  'School of Creative Arts','Faculty of Science',
  'Academy of Visual Arts / Other Academies',
  'School of Continuing Education / CIE','Undeclared / Other',
]

const GENDERS: Gender[] = ['Male', 'Female', 'Non-binary', 'Prefer not to say']

export default function ProfilePage() {
  const [profile, setProfile]         = useState<UserProfile | null>(null)
  const [editing, setEditing]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [missing, setMissing]         = useState(false)

  // editable fields
  const [nickname, setNickname]       = useState('')
  const [bio, setBio]                 = useState('')
  const [icebreaker, setIcebreaker]   = useState('')
  const [interests, setInterests]     = useState<Interest[]>([])
  const [studyStyles, setStudyStyles] = useState<StudyStyle[]>([])
  const [buddyTypes, setBuddyTypes]   = useState<BuddyType[]>([])
  const [photoURL, setPhotoURL]       = useState('')
  const [yearOfStudy, setYearOfStudy] = useState<YearOfStudy | ''>('')
  const [faculty, setFaculty]         = useState<Faculty | ''>('')
  const [major, setMajor]             = useState('')
  const [gender, setGender]           = useState<Gender | ''>('')

  useEffect(() => {
    const user = auth.currentUser
    if (!user) return
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile
        setProfile(data)
        syncStateFromProfile(data)
      } else {
        setMissing(true)
      }
    })
  }, [])

  const syncStateFromProfile = (data: UserProfile) => {
    setNickname(data.nickname)
    setBio(data.bio ?? '')
    setIcebreaker(data.icebreaker ?? '')
    setInterests(data.interests ?? [])
    setStudyStyles(data.studyStyles ?? [])
    setBuddyTypes(data.buddyTypes ?? [])
    setPhotoURL(data.photoURL ?? '')
    setYearOfStudy(data.yearOfStudy ?? '')
    setFaculty(data.faculty ?? '')
    setMajor(data.major ?? '')
    setGender(data.gender ?? '')
  }

  const toggleChip = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, val: T) =>
    setter(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])

  const handleSave = async () => {
    const user = auth.currentUser
    if (!user || !nickname.trim()) return
    setSaving(true)
    const updates: Partial<UserProfile> = {
      nickname:    nickname.trim(),
      bio:         bio.trim(),
      icebreaker:  icebreaker.trim(),
      interests,
      studyStyles,
      buddyTypes,
      photoURL,
      yearOfStudy: yearOfStudy || undefined,
      faculty:     faculty || undefined,
      major:       major.trim() || undefined,
      gender:      gender || undefined,
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

  const cancelEdit = () => {
    if (profile) syncStateFromProfile(profile)
    setEditing(false)
  }

  // ── Section card helper ───────────────────────────────────────────────────
  const Card = ({ children }: { children: React.ReactNode }) => (
    <div style={{ background: 'var(--bg2)', borderRadius: 14, padding: '16px 18px',
      border: '1px solid var(--border)', marginBottom: 12 }}>
      {children}
    </div>
  )

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
                  onClick={() => toggleChip(setInterests, i)}>{i}</button>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16,
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
          {profile.faculty && (
            <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 2 }}>🏫 {profile.faculty}</div>
          )}
          <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 4 }}>
            🗓 Joined {new Date(profile.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* ── READ VIEW ───────────────────────────────────────────────────── */}
      {!editing ? (
        <>
          {profile.bio && (
            <Card>
              <p className={s.label}>Bio</p>
              <p style={{ color: '#fff', fontSize: 14, lineHeight: 1.6, marginTop: 6 }}>{profile.bio}</p>
            </Card>
          )}

          {profile.icebreaker && (
            <Card>
              <p className={s.label}>Icebreaker ❄️</p>
              <p style={{ color: 'var(--accent2)', fontSize: 14, lineHeight: 1.6, marginTop: 6, fontStyle: 'italic' }}>
                "{profile.icebreaker}"
              </p>
            </Card>
          )}

          <Card>
            <p className={s.label}>Basic Info</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {profile.yearOfStudy && <span style={{ color: 'var(--text2)', fontSize: 13 }}>📅 {profile.yearOfStudy}</span>}
              {profile.faculty     && <span style={{ color: 'var(--text2)', fontSize: 13 }}>🏫 {profile.faculty}</span>}
              {profile.major       && <span style={{ color: 'var(--text2)', fontSize: 13 }}>📚 {profile.major}</span>}
              {profile.gender      && <span style={{ color: 'var(--text2)', fontSize: 13 }}>👤 {profile.gender}</span>}
            </div>
          </Card>

          {(profile.studyStyles ?? []).length > 0 && (
            <Card>
              <p className={s.label}>Study Style</p>
              <div className={s.chipGrid} style={{ marginTop: 8 }}>
                {(profile.studyStyles ?? []).map(i => <span key={i} className={s.chipActive}>{i}</span>)}
              </div>
            </Card>
          )}

          {(profile.buddyTypes ?? []).length > 0 && (
            <Card>
              <p className={s.label}>Looking For</p>
              <div className={s.chipGrid} style={{ marginTop: 8 }}>
                {(profile.buddyTypes ?? []).map(i => <span key={i} className={s.chipActive}>{i}</span>)}
              </div>
            </Card>
          )}

          {(profile.interests ?? []).length > 0 && (
            <Card>
              <p className={s.label}>Interests</p>
              <div className={s.chipGrid} style={{ marginTop: 8 }}>
                {(profile.interests ?? []).map(i => <span key={i} className={s.chipActive}>{i}</span>)}
              </div>
            </Card>
          )}

          <button className={s.btnGhost} onClick={() => setEditing(true)} style={{ width: '100%', marginTop: 4 }}>
            ✏️ Edit Profile
          </button>
          {saved && <p style={{ color: 'var(--accent3)', fontSize: 14, marginTop: 8, textAlign: 'center' }}>✅ Profile updated!</p>}
        </>
      ) : (
        /* ── EDIT VIEW ──────────────────────────────────────────────────── */
        <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: 24,
          border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Nickname */}
          <div>
            <p className={s.label}>Nickname</p>
            <input className={s.input} value={nickname}
              onChange={e => setNickname(e.target.value)} placeholder="Your nickname" />
          </div>

          {/* Bio */}
          <div>
            <p className={s.label}>Bio <span style={{ fontWeight: 400, color: 'var(--text2)' }}>(max 150 chars)</span></p>
            <textarea className={s.input} style={{ resize: 'vertical', minHeight: 72 }}
              value={bio} maxLength={150}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell people a little about yourself…" />
            <span style={{ fontSize: 11, color: 'var(--text2)', float: 'right' }}>{150 - bio.length} left</span>
          </div>

          {/* Icebreaker */}
          <div>
            <p className={s.label}>Icebreaker ❄️ <span style={{ fontWeight: 400, color: 'var(--text2)' }}>(optional)</span></p>
            <input className={s.input} value={icebreaker}
              onChange={e => setIcebreaker(e.target.value)}
              placeholder="e.g. Best hidden food spot near HKBU?" />
          </div>

          {/* Year */}
          <div>
            <p className={s.label}>Year of Study</p>
            <select className={s.input} value={yearOfStudy} onChange={e => setYearOfStudy(e.target.value as YearOfStudy)}>
              <option value="">Select year…</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Faculty */}
          <div>
            <p className={s.label}>Faculty / School</p>
            <select className={s.input} value={faculty} onChange={e => setFaculty(e.target.value as Faculty)}>
              <option value="">Select faculty…</option>
              {FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Major */}
          <div>
            <p className={s.label}>Major / Programme</p>
            <input className={s.input} value={major}
              onChange={e => setMajor(e.target.value)}
              placeholder="e.g. Journalism, Computer Science…" />
          </div>

          {/* Gender */}
          <div>
            <p className={s.label}>Gender</p>
            <select className={s.input} value={gender} onChange={e => setGender(e.target.value as Gender)}>
              <option value="">Prefer not to answer</option>
              {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* Study Style */}
          <div>
            <p className={s.label}>Study Style <span style={{ fontWeight: 400, color: 'var(--text2)' }}>(pick up to 3)</span></p>
            <div className={s.chipGrid} style={{ marginTop: 8 }}>
              {ALL_STUDY_STYLES.map(i => {
                const active   = studyStyles.includes(i)
                const atLimit  = !active && studyStyles.length >= 3
                return (
                  <button key={i} type="button"
                    className={active ? s.chipActive : s.chip}
                    style={{ opacity: atLimit ? 0.4 : 1 }}
                    disabled={atLimit}
                    onClick={() => toggleChip(setStudyStyles, i)}>{i}</button>
                )
              })}
            </div>
          </div>

          {/* Looking For */}
          <div>
            <p className={s.label}>Looking For</p>
            <div className={s.chipGrid} style={{ marginTop: 8 }}>
              {ALL_BUDDY_TYPES.map(i => (
                <button key={i} type="button"
                  className={buddyTypes.includes(i) ? s.chipActive : s.chip}
                  onClick={() => toggleChip(setBuddyTypes, i)}>{i}</button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div>
            <p className={s.label}>Interests</p>
            <div className={s.chipGrid} style={{ marginTop: 8 }}>
              {ALL_INTERESTS.map(i => (
                <button key={i} type="button"
                  className={interests.includes(i) ? s.chipActive : s.chip}
                  onClick={() => toggleChip(setInterests, i)}>{i}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className={s.btnPrimary} onClick={handleSave} disabled={saving || !nickname.trim()}>
              {saving ? 'Saving…' : '💾 Save Changes'}
            </button>
            <button className={s.btnGhost} onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
