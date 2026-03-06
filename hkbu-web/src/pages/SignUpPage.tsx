import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebaseConfig'
import AvatarUpload from '../components/AvatarUpload'
import s from './SignUpPage.module.css'
import type {
  YearOfStudy, Faculty, Gender,
  StudyStyle, SubjectStrength, HelpNeeded,
  Interest, Club, BuddyType, MustHave,
} from '../types'

// ── Constants ──────────────────────────────────────────────────────────────
const HKBU_REGEX = /^[^\s@]+@life\.hkbu\.edu\.hk$/i

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
const GENDERS: Gender[] = ['Male','Female','Non-binary','Prefer not to say']
const STUDY_STYLES: StudyStyle[] = [
  'Quiet solo focus / Library','Group discussions / Brainstorming',
  'Explaining / Teaching others','Cafe / Relaxed vibe',
  'Late-night cramming','Early morning / Daytime only',
]
const SUBJECT_STRENGTHS: SubjectStrength[] = [
  'Languages (EN/Cantonese/Putonghua)','Business / Finance / Accounting',
  'Science (Bio/Chem/Physics/CS)','Social Sciences / Psychology / History',
  'Media / Communication / Film','Chinese Medicine / Health',
  'Arts / Design / Music','Other',
]
const HELP_NEEDED: HelpNeeded[] = [
  'Course content understanding','Exam / Assignment prep',
  'Time management / Motivation','Group project coordination',
  'Finding notes / Resources','Mostly social / friends',
]
const INTERESTS: Interest[] = [
  'Sports / Fitness','Hiking','Language Exchange','Music / Singing',
  'Gaming / Esports','Study Groups','Photography','Cooking / Food',
  'Travel / Exploring HK','Art & Design','Tech & Coding',
  'Film / Drama / Anime','Volunteering','Debate / Public Speaking',
  'Yoga / Martial Arts','Religion / Mindfulness',
]
const CLUBS: Club[] = [
  'Academic Society','Interest Club (Dance/Drama/Photo/Hiking)',
  'Sports Club','Cultural / Language Club',
  'Faith-based / Christian Fellowship',
  'Service (Rotaract / Volunteering)','International Students Club',
  'Others',
]
const BUDDY_TYPES: BuddyType[] = [
  'Study partner (same/similar major)','Casual hangout / Meals friend',
  'Hobby / Activity partner','Campus explorer / New to HK',
  'Freshman mentor / Guidance','Long-term support friend',
]
const MUST_HAVES: MustHave[] = [
  'Similar major / courses',
  'Shared hobbies / interests','Similar personality / energy',
  'Reliable / Good communicator','Fun / Positive vibe',
]

const PERSONALITY_SCALES: { key: keyof PersonalityState; lo: string; hi: string; emoLo: string; emoHi: string }[] = [
  { key: 'introvert',   lo: 'Very Extroverted',    hi: 'Very Introverted',  emoLo: '🎉', emoHi: '📚' },
  { key: 'planned',     lo: 'Spontaneous',          hi: 'Super Planned',     emoLo: '🎲', emoHi: '📅' },
  { key: 'deepTalks',   lo: 'Casual Chit-chat',     hi: 'Deep Talks',        emoLo: '💬', emoHi: '🧠' },
  { key: 'optimistic',  lo: 'Calm / Reserved',      hi: 'Energetic / Upbeat',emoLo: '😌', emoHi: '⚡' },
]

// ── Step metadata ──────────────────────────────────────────────────────────
const STEPS = [
  { id: 0, label: 'Welcome',      emoji: '👋' },
  { id: 1, label: 'Account',      emoji: '🔑' },
  { id: 2, label: 'Profile',      emoji: '🎓' },
  { id: 3, label: 'Personality',  emoji: '🧬' },
  { id: 4, label: 'Academic',     emoji: '📖' },
  { id: 5, label: 'Interests',    emoji: '🎯' },
  { id: 6, label: 'Matching',     emoji: '🤝' },
  { id: 7, label: 'Extra',        emoji: '✨' },
  { id: 8, label: 'Review',       emoji: '✅' },
]

// ── Local types ────────────────────────────────────────────────────────────
interface PersonalityState { introvert: number; planned: number; deepTalks: number; optimistic: number }

// ── Helpers ────────────────────────────────────────────────────────────────
function VisToggle({ label, on, onToggle }: { label: string; on: boolean; onToggle(): void }) {
  return (
    <div className={s.visRow} onClick={onToggle}>
      <div className={`${s.visToggle} ${on ? s.visToggleOn : ''}`}>
        <div className={`${s.visToggleKnob} ${on ? s.visToggleKnobOn : ''}`} />
      </div>
      {label}
    </div>
  )
}

function ChipGrid<T extends string>({
  options, selected, onToggle, limit,
}: { options: T[]; selected: T[]; onToggle(v: T): void; limit?: number }) {
  return (
    <div className={s.chipGrid}>
      {options.map(o => {
        const active = selected.includes(o)
        const atLimit = !active && limit !== undefined && selected.length >= limit
        return (
          <button
            type="button"
            key={o}
            className={`${active ? s.chipActive : s.chip} ${atLimit ? s.chipLimit : ''}`}
            onClick={() => !atLimit && onToggle(o)}
          >{o}</button>
        )
      })}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────
export default function SignUpPage() {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [animKey, setAnimKey] = useState(0)

  // Step 1 – account
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  // Step 2 – basic profile
  const [nickname, setNickname] = useState('')
  const [photoURL, setPhotoURL] = useState('')
  const [tempUid] = useState(() => crypto.randomUUID())
  const [yearOfStudy, setYearOfStudy] = useState<YearOfStudy | ''>('')
  const [showYear, setShowYear] = useState(true)
  const [faculty, setFaculty] = useState<Faculty | ''>('')
  const [showFaculty, setShowFaculty] = useState(true)
  const [major, setMajor] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [showGender, setShowGender] = useState(true)

  // Step 3 – personality
  const [personality, setPersonality] = useState<PersonalityState>({
    introvert: 3, planned: 3, deepTalks: 3, optimistic: 3,
  })

  // Step 4 – academic
  const [studyStyles, setStudyStyles] = useState<StudyStyle[]>([])
  const [subjectStrengths, setSubjectStrengths] = useState<SubjectStrength[]>([])
  const [helpNeeded, setHelpNeeded] = useState<HelpNeeded[]>([])

  // Step 5 – interests
  const [interests, setInterests] = useState<Interest[]>([])
  const [clubs, setClubs] = useState<Club[]>([])

  // Step 6 – matching
  const [buddyTypes, setBuddyTypes] = useState<BuddyType[]>([])
  const [mustHaves, setMustHaves] = useState<MustHave[]>([])

  // Step 7 – fun extras
  const [bio, setBio] = useState('')
  const [icebreaker, setIcebreaker] = useState('')

  // Step 8 – consent
  const [consent, setConsent] = useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // ── Navigation ───────────────────────────────────────────────────────────
  const goTo = useCallback((next: number) => {
    setError('')
    setStep(next)
    setAnimKey(k => k + 1)
    // Scroll card top
    document.querySelector('[data-card]')?.scrollTo({ top: 0 })
  }, [])

  const next = () => goTo(step + 1)
  const back = () => goTo(step - 1)

  // ── Toggle helpers ───────────────────────────────────────────────────────
  const toggleArr = <T,>(arr: T[], val: T) =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]

  // ── Validation per step ──────────────────────────────────────────────────
  const canProceed = (): boolean => {
    switch (step) {
      case 0: return true
      case 1:
        if (!HKBU_REGEX.test(email)) return false
        if (password.length < 6) return false
        if (password !== confirm) return false
        return true
      case 2:
        return nickname.trim().length > 0 && !!yearOfStudy && !!faculty && major.trim().length > 0
      case 3: return true
      case 4: return studyStyles.length > 0
      case 5: return interests.length >= 1
      case 6: return buddyTypes.length > 0 && mustHaves.length >= 1
      case 7: return true
      case 8: return consent
      default: return true
    }
  }

  const validateAndNext = () => {
    setError('')
    if (step === 1) {
      if (!HKBU_REGEX.test(email))   { setError('Use your HKBU email (@life.hkbu.edu.hk)'); return }
      if (password.length < 6)        { setError('Password must be at least 6 characters'); return }
      if (password !== confirm)        { setError('Passwords do not match'); return }
    }
    if (step === 2 && !yearOfStudy)   { setError('Please select your year of study'); return }
    if (step === 2 && !faculty)       { setError('Please select your faculty'); return }
    if (step === 2 && !major.trim())  { setError('Please enter your major / programme'); return }
    if (step === 4 && studyStyles.length === 0) { setError('Select at least one study style'); return }
    if (step === 5 && interests.length === 0)   { setError('Select at least one interest'); return }
    if (step === 6 && buddyTypes.length === 0)  { setError('Select at least one buddy type'); return }
    if (step === 6 && mustHaves.length === 0)   { setError('Select at least one must-have'); return }
    next()
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!consent) { setError('Please accept the privacy policy to continue'); return }
    setLoading(true)
    setError('')
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        nickname: nickname.trim(),
        email: email.toLowerCase(),
        photoURL: photoURL || '',
        privacyConsent: true,
        createdAt: Date.now(),
        yearOfStudy: yearOfStudy || null,
        showYear,
        faculty: faculty || null,
        showFaculty,
        major: major.trim(),
        gender: gender || null,
        showGender,
        personalityIntrovert:  personality.introvert,
        personalityPlanned:    personality.planned,
        personalityDeepTalks:  personality.deepTalks,
        personalityOptimistic: personality.optimistic,
        studyStyles,
        subjectStrengths,
        helpNeeded,
        interests,
        clubs,
        buddyTypes,
        mustHaves,
        bio: bio.trim(),
        icebreaker: icebreaker.trim(),
      })
      nav('/main')
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Sections ─────────────────────────────────────────────────────────────
  const progressPct = (step / (STEPS.length - 1)) * 100

  const renderStep = () => {
    switch (step) {

      // ── 0: Welcome ────────────────────────────────────────────────────
      case 0:
        return (
          <div className={s.welcomeBody}>
            <div className={s.welcomeEmoji}>🎓</div>
            <div className={s.welcomeTitle}>Find Your<br/>HKBU Buddy</div>
            <div className={s.welcomeSub}>
              Connect with study partners, hangout friends, and activity
              buddies right here on campus. Answer a few quick questions and
              we'll find your perfect match! 🤩
            </div>
            <div className={s.welcomeFeatures}>
              {[
                { emoji: '📚', title: 'Study Partners',  sub: 'Find people in your courses' },
                { emoji: '🍜', title: 'Hangout Buddies', sub: 'Meals, cafes & campus life' },
                { emoji: '🏸', title: 'Activity Pals',   sub: 'Clubs, sports & hobbies' },
                { emoji: '🌏', title: 'New Friends',     sub: 'Local & exchange students' },
              ].map(f => (
                <div className={s.featureBox} key={f.title}>
                  <div className={s.featureBoxEmoji}>{f.emoji}</div>
                  <div className={s.featureBoxTitle}>{f.title}</div>
                  <div className={s.featureBoxSub}>{f.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )

      // ── 1: Account ────────────────────────────────────────────────────
      case 1:
        return (
          <div className={s.sectionBody} key={animKey} data-card>
            <div className={s.sectionEmoji}>🔑</div>
            <div className={s.sectionTitle}>Create Your Account</div>
            <div className={s.sectionSub}>Only @life.hkbu.edu.hk emails are accepted — keeping HKBU Buddy students-only!</div>

            <div className={s.qBlock}>
              <label className={s.qLabel}>HKBU Email <span>required</span></label>
              <input className={s.qInput} type="email"
                placeholder="yourname@life.hkbu.edu.hk"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            <div className={s.qBlock}>
              <label className={s.qLabel}>Password <span>min. 6 characters</span></label>
              <input className={s.qInput} type="password"
                placeholder="Choose a strong password"
                value={password} onChange={e => setPassword(e.target.value)} />
            </div>

            <div className={s.qBlock}>
              <label className={s.qLabel}>Confirm Password</label>
              <input className={s.qInput} type="password"
                placeholder="Repeat your password"
                value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>

            {error && <div className={s.errMsg}>⚠️ {error}</div>}
          </div>
        )

      // ── 2: Basic Profile ──────────────────────────────────────────────
      case 2:
        return (
          <div className={s.sectionBody} key={animKey} data-card>
            <div className={s.sectionEmoji}>🎓</div>
            <div className={s.sectionTitle}>Basic Profile</div>
            <div className={s.sectionSub}>Help others recognise you. Toggle the 👁️ icon to hide any field from your public profile.</div>

            {/* Avatar */}
            <div className={s.avatarCenter}>
              <AvatarUpload uid={tempUid} currentURL={photoURL}
                nickname={nickname || '?'} onUploaded={url => setPhotoURL(url)} />
            </div>

            {/* Nickname */}
            <div className={s.qBlock}>
              <label className={s.qLabel}>Display Name <span>required</span></label>
              <input className={s.qInput} placeholder="e.g. Alex or HKBU_King"
                value={nickname} onChange={e => setNickname(e.target.value)} />
            </div>

            {/* Year */}
            <div className={s.qBlock}>
              <label className={s.qLabel}>Year of Study <span>required</span></label>
              <select className={s.qSelect} value={yearOfStudy}
                onChange={e => setYearOfStudy(e.target.value as YearOfStudy)}>
                <option value="">Select year…</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <VisToggle label={showYear ? '👁️ Visible on profile' : '🙈 Hidden from profile'}
                on={showYear} onToggle={() => setShowYear(v => !v)} />
            </div>

            {/* Faculty */}
            <div className={s.qBlock}>
              <label className={s.qLabel}>Faculty / School <span>required</span></label>
              <select className={s.qSelect} value={faculty}
                onChange={e => setFaculty(e.target.value as Faculty)}>
                <option value="">Select faculty…</option>
                {FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <VisToggle label={showFaculty ? '👁️ Visible on profile' : '🙈 Hidden from profile'}
                on={showFaculty} onToggle={() => setShowFaculty(v => !v)} />
            </div>

            {/* Major */}
            <div className={s.qBlock}>
              <label className={s.qLabel}>Major / Programme <span>required</span></label>
              <input className={s.qInput}
                placeholder="e.g. Journalism, Accounting, Computer Science…"
                value={major} onChange={e => setMajor(e.target.value)} />
            </div>

            {/* Gender */}
            <div className={s.qBlock}>
              <label className={s.qLabel}>Gender <span>optional</span></label>
              <select className={s.qSelect} value={gender}
                onChange={e => setGender(e.target.value as Gender)}>
                <option value="">Prefer not to answer</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <VisToggle label={showGender ? '👁️ Visible on profile' : '🙈 Hidden from profile'}
                on={showGender} onToggle={() => setShowGender(v => !v)} />
            </div>

            {error && <div className={s.errMsg}>⚠️ {error}</div>}
          </div>
        )

      // ── 3: Personality ────────────────────────────────────────────────
      case 3:
        return (
          <div className={s.sectionBody} key={animKey} data-card>
            <div className={s.sectionEmoji}>🧬</div>
            <div className={s.sectionTitle}>Personality & Lifestyle</div>
            <div className={s.sectionSub}>Drag each slider to describe yourself.</div>

            <div className={s.sliderBlock}>
              {PERSONALITY_SCALES.map(({ key, lo, hi, emoLo, emoHi }) => (
                <div className={s.sliderRow} key={key}>
                  <div className={s.sliderLabels}><span>{lo}</span><span>{hi}</span></div>
                  <div className={s.sliderEmojis}><span>{emoLo}</span><span>{emoHi}</span></div>
                  <input type="range" min={1} max={5} step={1}
                    className={s.slider}
                    value={personality[key]}
                    onChange={e => setPersonality(p => ({ ...p, [key]: +e.target.value }))} />
                  <div className={s.sliderValue}>
                    {['😶','🙂','😊','😄','🤩'][personality[key] - 1]} {personality[key]} / 5
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      // ── 4: Academic ───────────────────────────────────────────────────
      case 4:
        return (
          <div className={s.sectionBody} key={animKey} data-card>
            <div className={s.sectionEmoji}>📖</div>
            <div className={s.sectionTitle}>Academic & Study Vibes</div>
            <div className={s.sectionSub}>Tell us how you study — this is the core of our study-buddy matching!</div>

            <div className={s.qBlock}>
              <label className={s.qLabel}>Preferred Study Style <span>pick up to 3 · required</span></label>
              <div className={s.qHint}>How do you work best?</div>
              <ChipGrid options={STUDY_STYLES} selected={studyStyles} limit={3}
                onToggle={v => setStudyStyles(a => toggleArr(a, v))} />
            </div>

            <div className={s.qBlock}>
              <label className={s.qLabel}>Subjects I Can Help With <span>optional</span></label>
              <div className={s.qHint}>What are your strengths?</div>
              <ChipGrid options={SUBJECT_STRENGTHS} selected={subjectStrengths}
                onToggle={v => setSubjectStrengths(a => toggleArr(a, v))} />
            </div>

            <div className={s.qBlock}>
              <label className={s.qLabel}>What I Need Help With <span>optional</span></label>
              <div className={s.qHint}>Be honest — it helps find the right buddy!</div>
              <ChipGrid options={HELP_NEEDED} selected={helpNeeded}
                onToggle={v => setHelpNeeded(a => toggleArr(a, v))} />
            </div>

            {error && <div className={s.errMsg}>⚠️ {error}</div>}
          </div>
        )

      // ── 5: Interests ──────────────────────────────────────────────────
      case 5:
        return (
          <div className={s.sectionBody} key={animKey} data-card>
            <div className={s.sectionEmoji}>🎯</div>
            <div className={s.sectionTitle}>Interests & Hobbies</div>
            <div className={s.sectionSub}>Pick up to 10 interests.</div>

            <div className={s.qBlock}>
              <label className={s.qLabel}>Top Interests <span>1–10 · required</span></label>
              <ChipGrid options={INTERESTS} selected={interests} limit={10}
                onToggle={v => setInterests(a => toggleArr(a, v))} />
            </div>

            <div className={s.qBlock}>
              <label className={s.qLabel}>Clubs / Societies <span>optional · already in or interested in joining</span></label>
              <ChipGrid options={CLUBS} selected={clubs}
                onToggle={v => setClubs(a => toggleArr(a, v))} />
            </div>

            {error && <div className={s.errMsg}>⚠️ {error}</div>}
          </div>
        )

      // ── 6: Matching Goals ─────────────────────────────────────────────
      case 6:
        return (
          <div className={s.sectionBody} key={animKey} data-card>
            <div className={s.sectionEmoji}>🤝</div>
            <div className={s.sectionTitle}>Matching Goals</div>
            <div className={s.sectionSub}>Tell us what kind of buddy you're looking for so we can prioritise your matches.</div>

            <div className={s.qBlock}>
              <label className={s.qLabel}>What Kind of Buddy? <span>multi-select · required</span></label>
              <ChipGrid options={BUDDY_TYPES} selected={buddyTypes}
                onToggle={v => setBuddyTypes(a => toggleArr(a, v))} />
            </div>

            <div className={s.qBlock}>
              <label className={s.qLabel}>Top 3 Must-Haves in a Buddy <span>pick up to 3 · required</span></label>
              <div className={s.rankGrid}>
                {MUST_HAVES.map(m => {
                  const idx = mustHaves.indexOf(m)
                  const active = idx !== -1
                  const atLimit = !active && mustHaves.length >= 3
                  return (
                    <div
                      key={m}
                      className={`${s.rankItem} ${active ? s.rankItemActive : ''} ${atLimit ? s.chipLimit : ''}`}
                      onClick={() => !atLimit && setMustHaves(a => toggleArr(a, m))}
                    >
                      {active
                        ? <div className={s.rankBadge}>#{idx + 1}</div>
                        : <div className={s.rankBadgeGhost} />}
                      {m}
                    </div>
                  )
                })}
              </div>
            </div>

            {error && <div className={s.errMsg}>⚠️ {error}</div>}
          </div>
        )

      // ── 7: Fun Extras ─────────────────────────────────────────────────
      case 7:
        return (
          <div className={s.sectionBody} key={animKey} data-card>
            <div className={s.sectionEmoji}>✨</div>
            <div className={s.sectionTitle}>Personal Touch</div>
            <div className={s.sectionSub}>Optional — but these details make your profile stand out and spark great first conversations!</div>

            <div className={s.qBlock}>
              <label className={s.qLabel}>Short Bio <span>optional · max 150 chars</span></label>
              <div className={s.qHint}>e.g. "Year 2 JOUR major who loves late-night dim sum & K-pop!"</div>
              <textarea className={s.qTextarea}
                placeholder="Tell potential buddies a little about you…"
                maxLength={150}
                value={bio} onChange={e => setBio(e.target.value)} />
              <div className={s.charCount}>{bio.length} / 150</div>
            </div>

            <div className={s.qBlock}>
              <label className={s.qLabel}>Icebreaker Question <span>optional</span></label>
              <div className={s.qHint}>e.g. "Best hidden food spot near HKBU?" or "Favourite campus chill spot?"</div>
              <input className={s.qInput}
                placeholder="Write a fun question for your matches…"
                value={icebreaker} onChange={e => setIcebreaker(e.target.value)} />
            </div>
          </div>
        )

      // ── 8: Review & Consent ───────────────────────────────────────────
      case 8:
        return (
          <div className={s.sectionBody} key={animKey} data-card>
            <div className={s.sectionEmoji}>✅</div>
            <div className={s.sectionTitle}>Review & Complete</div>
            <div className={s.sectionSub}>Double-check your profile before we find your matches!</div>

            <div className={s.reviewGrid}>
              {/* Account */}
              <div className={s.reviewCard}>
                <div className={s.reviewCardTitle}>🔑 Account</div>
                <div className={s.reviewRow}>
                  <div className={s.reviewKey}>Email</div>
                  <div className={s.reviewVal}>{email}</div>
                </div>
              </div>

              {/* Profile */}
              <div className={s.reviewCard}>
                <div className={s.reviewCardTitle}>🎓 Profile</div>
                {[
                  { k: 'Display Name', v: nickname },
                  { k: 'Year', v: yearOfStudy || '—' },
                  { k: 'Faculty', v: faculty || '—' },
                  { k: 'Major', v: major || '—' },
                  { k: 'Gender', v: gender || '—' },
                ].map(r => (
                  <div className={s.reviewRow} key={r.k}>
                    <div className={s.reviewKey}>{r.k}</div>
                    <div className={s.reviewVal}>{r.v}</div>
                  </div>
                ))}
              </div>

              {/* Personality */}
              <div className={s.reviewCard}>
                <div className={s.reviewCardTitle}>🧬 Personality</div>
                {PERSONALITY_SCALES.map(({ key, lo, hi }) => (
                  <div className={s.reviewRow} key={key}>
                    <div className={s.reviewKey}>{lo} → {hi}</div>
                    <div className={s.reviewVal}>{'★'.repeat(personality[key])}{'☆'.repeat(5 - personality[key])}</div>
                  </div>
                ))}
              </div>

              {/* Academic */}
              <div className={s.reviewCard}>
                <div className={s.reviewCardTitle}>📖 Academic</div>
                <div className={s.reviewRow}>
                  <div className={s.reviewKey}>Study Style</div>
                  <div className={s.reviewChips}>{studyStyles.map(x => <span className={s.reviewChip} key={x}>{x}</span>)}</div>
                </div>
                {subjectStrengths.length > 0 && (
                  <div className={s.reviewRow}>
                    <div className={s.reviewKey}>Strengths</div>
                    <div className={s.reviewChips}>{subjectStrengths.map(x => <span className={s.reviewChip} key={x}>{x}</span>)}</div>
                  </div>
                )}
                {helpNeeded.length > 0 && (
                  <div className={s.reviewRow}>
                    <div className={s.reviewKey}>Need Help With</div>
                    <div className={s.reviewChips}>{helpNeeded.map(x => <span className={s.reviewChip} key={x}>{x}</span>)}</div>
                  </div>
                )}
              </div>

              {/* Interests */}
              <div className={s.reviewCard}>
                <div className={s.reviewCardTitle}>🎯 Interests & Clubs</div>
                <div className={s.reviewRow}>
                  <div className={s.reviewKey}>Interests</div>
                  <div className={s.reviewChips}>{interests.map(x => <span className={s.reviewChip} key={x}>{x}</span>)}</div>
                </div>
                {clubs.length > 0 && (
                  <div className={s.reviewRow}>
                    <div className={s.reviewKey}>Clubs</div>
                    <div className={s.reviewChips}>{clubs.map(x => <span className={s.reviewChip} key={x}>{x}</span>)}</div>
                  </div>
                )}
              </div>

              {/* Matching */}
              <div className={s.reviewCard}>
                <div className={s.reviewCardTitle}>🤝 Matching Goals</div>
                <div className={s.reviewRow}>
                  <div className={s.reviewKey}>Buddy Types</div>
                  <div className={s.reviewChips}>{buddyTypes.map(x => <span className={s.reviewChip} key={x}>{x}</span>)}</div>
                </div>
                <div className={s.reviewRow}>
                  <div className={s.reviewKey}>Must-Haves</div>
                  <div className={s.reviewChips}>{mustHaves.map((x, i) => <span className={s.reviewChip} key={x}>#{i+1} {x}</span>)}</div>
                </div>
              </div>

              {/* Bio */}
              {(bio || icebreaker) && (
                <div className={s.reviewCard}>
                  <div className={s.reviewCardTitle}>✨ Personal Touch</div>
                  {bio && <div className={s.reviewRow}><div className={s.reviewKey}>Bio</div><div className={s.reviewVal}>{bio}</div></div>}
                  {icebreaker && <div className={s.reviewRow}><div className={s.reviewKey}>Icebreaker</div><div className={s.reviewVal}>{icebreaker}</div></div>}
                </div>
              )}
            </div>

            {/* Privacy consent */}
            <div className={s.consentBox}>
              <ul className={s.consentList}>
                <li>Your real name is never shown — only your display name.</li>
                <li>Your email is used for authentication only.</li>
                <li>Your profile data is used solely for matching within HKBU.</li>
                <li>You can delete your account and all data at any time.</li>
                <li>We do not sell or share your data with third parties.</li>
              </ul>
              <label className={s.consentRow}>
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
                I agree to the Privacy Policy & Terms of Use
              </label>
            </div>

            {error && <div className={s.errMsg}>⚠️ {error}</div>}
          </div>
        )

      default: return null
    }
  }

  // ── Footer buttons per step ───────────────────────────────────────────────
  const renderFooter = () => {
    if (step === 0) return (
      <div className={s.wizardFooter}>
        <button className={s.btnBack} onClick={() => nav('/')}>← Back</button>
        <button className={s.btnNext} onClick={next}>
          Get Started 🚀
        </button>
      </div>
    )

    if (step === 8) return (
      <div className={s.wizardFooter}>
        <button className={s.btnBack} onClick={back}>← Back</button>
        <button className={s.btnNext} onClick={handleSubmit}
          disabled={!consent || loading}>
          {loading ? 'Creating account…' : 'Complete & Start Matching! 🎉'}
        </button>
      </div>
    )

    // Optional steps (7 = fun extras) can be skipped
    const isOptional = step === 7
    return (
      <div className={s.wizardFooter}>
        <button className={s.btnBack} onClick={back}>← Back</button>
        {isOptional && (
          <button className={s.btnSkip} onClick={next}>Skip</button>
        )}
        <button className={s.btnNext} onClick={validateAndNext} disabled={!canProceed()}>
          Continue →
        </button>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={s.wizardWrap}>
      <div className={s.wizardCard}>
        {/* Progress bar */}
        <div className={s.progressBar}>
          <div className={s.progressFill} style={{ width: `${progressPct}%` }} />
        </div>

        {/* Step pills */}
        {step > 0 && (
          <div className={s.stepRow}>
            {STEPS.slice(1).map((st, i) => {
              const realIdx = i + 1
              const isDone = step > realIdx
              const isActive = step === realIdx
              return (
                <>
                  {i > 0 && <div key={`div-${st.id}`} className={s.stepDivider} />}
                  <div
                    key={st.id}
                    className={`${s.stepPill} ${isActive ? s.stepPillActive : ''} ${isDone ? s.stepPillDone : ''}`}
                  >
                    {isDone ? '✓' : st.emoji} {st.label}
                  </div>
                </>
              )
            })}
          </div>
        )}

        {/* Section content */}
        <div className={s.slideIn} key={`slide-${step}`}>
          {renderStep()}
        </div>

        {/* Footer nav */}
        {renderFooter()}
      </div>
    </div>
  )
}
