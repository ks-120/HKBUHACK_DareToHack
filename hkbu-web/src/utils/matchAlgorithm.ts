import type {
  UserProfile, MatchResult, MatchScoreBreakdown,
  Interest, StudyStyle, BuddyType,
} from '../types'

// ─── Weights (must sum to 1) ───────────────────────────────────────────────
//  personality & buddyGoals intentionally raised vs. old algorithm
const W = {
  interests:   0.35,
  studyStyle:  0.20,
  personality: 0.25,   // ↑ was 0.15
  buddyGoals:  0.20,   // ↑ was 0.15
} as const

// ══════════════════════════════════════════════════════════════════════════
//  MATRIX HELPERS
//  Each feature set is encoded as a binary row-vector (one-hot / multi-hot).
//  Similarity is computed as cosine similarity between those vectors.
// ══════════════════════════════════════════════════════════════════════════

/** Build a multi-hot vector over a fixed vocabulary */
function multiHot(items: string[], vocab: readonly string[]): number[] {
  return vocab.map(v => (items.includes(v) ? 1 : 0))
}

/** Cosine similarity between two equal-length vectors */
function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 && normB === 0) return 0.5  // both empty → neutral
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function intersection<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b)
  return a.filter(v => setB.has(v))
}

// ─── Vocabularies (derived from the union of all possible enum values) ────
const INTEREST_VOCAB: Interest[] = [
  'Sports / Fitness', 'Hiking', 'Language Exchange', 'Music / Singing',
  'Gaming / Esports', 'Study Groups', 'Photography', 'Cooking / Food',
  'Travel / Exploring HK', 'Art & Design', 'Tech & Coding', 'Film / Drama / Anime',
  'Volunteering', 'Debate / Public Speaking', 'Yoga / Martial Arts', 'Religion / Mindfulness',
]

const STUDY_VOCAB: StudyStyle[] = [
  'Quiet solo focus / Library', 'Group discussions / Brainstorming',
  'Explaining / Teaching others', 'Cafe / Relaxed vibe',
  'Late-night cramming', 'Early morning / Daytime only',
]

const BUDDY_VOCAB: BuddyType[] = [
  'Study partner (same/similar major)', 'Casual hangout / Meals friend',
  'Hobby / Activity partner', 'Campus explorer / New to HK',
  'Freshman mentor / Guidance', 'Long-term support friend',
]

// ──────────────────────────────────────────────────────────────────────────
//  DIMENSION SCORERS
// ──────────────────────────────────────────────────────────────────────────

/** Interests: multi-hot cosine */
function interestSim(a: UserProfile, b: UserProfile): number {
  return cosine(
    multiHot(a.interests ?? [], INTEREST_VOCAB),
    multiHot(b.interests ?? [], INTEREST_VOCAB),
  )
}

/** Study style: multi-hot cosine */
function studyStyleSim(a: UserProfile, b: UserProfile): number {
  return cosine(
    multiHot(a.studyStyles ?? [], STUDY_VOCAB),
    multiHot(b.studyStyles ?? [], STUDY_VOCAB),
  )
}

/** Buddy goals: multi-hot cosine */
function buddyGoalSim(a: UserProfile, b: UserProfile): number {
  return cosine(
    multiHot(a.buddyTypes ?? [], BUDDY_VOCAB),
    multiHot(b.buddyTypes ?? [], BUDDY_VOCAB),
  )
}

/**
 * Personality: 4-trait vector (each trait 1–5, mean-centred then normalised).
 * Uses cosine similarity of the centred vectors so direction matters more
 * than raw magnitude — two calm introverts match even if both score low.
 */
function personalitySim(a: UserProfile, b: UserProfile): number {
  const traitsA = [
    a.personalityIntrovert  ?? 3,
    a.personalityPlanned    ?? 3,
    a.personalityDeepTalks  ?? 3,
    a.personalityOptimistic ?? 3,
  ]
  const traitsB = [
    b.personalityIntrovert  ?? 3,
    b.personalityPlanned    ?? 3,
    b.personalityDeepTalks  ?? 3,
    b.personalityOptimistic ?? 3,
  ]

  // Mean-centre each vector
  const meanA = traitsA.reduce((s, v) => s + v, 0) / traitsA.length
  const meanB = traitsB.reduce((s, v) => s + v, 0) / traitsB.length
  const centA = traitsA.map(v => v - meanA)
  const centB = traitsB.map(v => v - meanB)

  // cosine of centred vectors; if flat (all same value) fall back to MAD
  const sim = cosine(centA, centB)
  if (!isFinite(sim)) {
    // Both flat: compare raw MAD distance
    const mad = traitsA.reduce((s, v, i) => s + Math.abs(v - traitsB[i]), 0) / (4 * 4)
    return 1 - mad
  }
  // cosine ∈ [-1, 1] → rescale to [0, 1]
  return (sim + 1) / 2
}

// ══════════════════════════════════════════════════════════════════════════
//  USER–ITEM MATRIX  (all users × all feature dimensions)
//
//  Used by the collaborative-filtering re-ranker.
//  Each row = one user's combined feature vector (concatenation of all
//  multi-hot / normalised personality vectors).
//  The CF step finds users whose *overall* feature vector is nearest to
//  the query user, re-ranks candidates using those neighbour similarities,
//  and blends it with the content score.
// ══════════════════════════════════════════════════════════════════════════

function buildFeatureVector(u: UserProfile): number[] {
  // Interests (16 dims)
  const intVec = multiHot(u.interests ?? [], INTEREST_VOCAB)
  // Study style (6 dims)
  const studyVec = multiHot(u.studyStyles ?? [], STUDY_VOCAB)
  // Buddy goals (6 dims)
  const buddyVec = multiHot(u.buddyTypes ?? [], BUDDY_VOCAB)
  // Personality (4 dims, normalised to [0,1])
  const persVec = [
    ((u.personalityIntrovert  ?? 3) - 1) / 4,
    ((u.personalityPlanned    ?? 3) - 1) / 4,
    ((u.personalityDeepTalks  ?? 3) - 1) / 4,
    ((u.personalityOptimistic ?? 3) - 1) / 4,
  ]
  return [...intVec, ...studyVec, ...buddyVec, ...persVec]
}

/**
 * Min-max normalise an array of scores to [0, 1].
 * If all values are identical, returns 0.5 for every entry.
 */
function minMaxNorm(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 0.5)
  return values.map(v => (v - min) / (max - min))
}

// ══════════════════════════════════════════════════════════════════════════
//  MUST-HAVE MULTIPLIER  (soft filter, ×0.6 – ×1.15)
// ══════════════════════════════════════════════════════════════════════════
function mustHaveMultiplier(mine: UserProfile, other: UserProfile): number {
  const must = mine.mustHaves ?? []
  if (!must.length) return 1

  let satisfied = 0
  for (const m of must) {
    switch (m) {
      case 'Similar major / courses':
        if (mine.faculty && other.faculty && mine.faculty === other.faculty) satisfied++
        break
      case 'Same year / Living nearby':
        if (other.yearOfStudy === mine.yearOfStudy) satisfied++
        else if (other.livingSituation === mine.livingSituation) satisfied += 0.5
        break
      case 'Shared hobbies / interests':
        if (interestSim(mine, other) > 0.3) satisfied++
        break
      case 'Similar personality / energy':
        if (personalitySim(mine, other) > 0.65) satisfied++
        break
      case 'Reliable / Good communicator':
      case 'Fun / Positive vibe':
        satisfied += 0.5
        break
    }
  }
  const ratio = satisfied / must.length
  return 0.6 + 0.55 * ratio   // range [0.6, 1.15]
}

// ══════════════════════════════════════════════════════════════════════════
//  CONTENT-BASED SCORE  (per pair)
// ══════════════════════════════════════════════════════════════════════════
export function scoreMatch(me: UserProfile, other: UserProfile): MatchScoreBreakdown {
  const interests   = interestSim(me, other)
  const studyStyle  = studyStyleSim(me, other)
  const personality = personalitySim(me, other)
  const buddyGoals  = buddyGoalSim(me, other)

  const rawTotal =
    interests   * W.interests  +
    studyStyle  * W.studyStyle +
    personality * W.personality +
    buddyGoals  * W.buddyGoals

  const multiplier = mustHaveMultiplier(me, other)
  const total = Math.min(1, Math.max(0, rawTotal * multiplier))

  return { interests, studyStyle, personality, buddyGoals, total }
}

// ══════════════════════════════════════════════════════════════════════════
//  COLLABORATIVE-FILTERING RE-RANKER
//
//  Steps:
//  1. Build the N×D feature matrix for all users (me + candidates).
//  2. Compute cosine similarity between me and every other user in that
//     full feature space (this is the "CF score").
//  3. For each candidate, blend:
//        finalScore = 0.70 × contentScore + 0.30 × cfScore
//  4. Min-max normalise the final scores across all candidates so the
//     output distribution always spans [0, 1].
// ══════════════════════════════════════════════════════════════════════════
export function computeMatches(
  me: UserProfile,
  candidates: UserProfile[],
  minScore = 0.30,
): MatchResult[] {

  const meVec = buildFeatureVector(me)

  // Step 1 & 2: CF cosine similarity for every candidate
  const cfScores = candidates
    .filter(c => c.uid !== me.uid)
    .map(c => ({ uid: c.uid, cf: cosine(meVec, buildFeatureVector(c)) }))

  // Normalise CF scores to [0,1]
  const cfNorm = minMaxNorm(cfScores.map(x => x.cf))
  const cfMap: Record<string, number> = {}
  cfScores.forEach((x, i) => { cfMap[x.uid] = cfNorm[i] })

  // Step 3: content score + CF blend for each candidate
  const raw: Array<{ profile: UserProfile; breakdown: MatchScoreBreakdown; blended: number }> = []

  for (const other of candidates) {
    if (other.uid === me.uid) continue
    const breakdown = scoreMatch(me, other)
    const cf = cfMap[other.uid] ?? 0
    const blended = 0.70 * breakdown.total + 0.30 * cf
    raw.push({ profile: other, breakdown, blended })
  }

  // Step 4: min-max normalise blended scores across all candidates
  const normScores = minMaxNorm(raw.map(r => r.blended))

  const results: MatchResult[] = []

  raw.forEach((r, i) => {
    const normTotal = normScores[i]
    if (normTotal < minScore) return

    results.push({
      uid:               r.profile.uid,
      nickname:          r.profile.nickname,
      photoURL:          r.profile.photoURL,
      sharedInterests:   intersection(me.interests  ?? [], r.profile.interests  ?? []) as Interest[],
      sharedStudyStyles: intersection(me.studyStyles ?? [], r.profile.studyStyles ?? []) as StudyStyle[],
      sharedBuddyTypes:  intersection(me.buddyTypes  ?? [], r.profile.buddyTypes  ?? []) as BuddyType[],
      score: { ...r.breakdown, total: normTotal },
      overlapScore: normTotal,
    })
  })

  // Sort by normalised total ↓, then shared interests count ↓
  results.sort((a, b) =>
    b.score.total - a.score.total ||
    b.sharedInterests.length - a.sharedInterests.length
  )

  return results
}

// ──────────────────────────────────────────────────────────────────────────
//  UI HELPERS
// ──────────────────────────────────────────────────────────────────────────
export function matchLabel(total: number): string {
  if (total >= 0.80) return 'Perfect Match 🌟'
  if (total >= 0.65) return 'Great Match 🔥'
  if (total >= 0.50) return 'Good Match 👍'
  return 'Potential Match 🤝'
}

export function matchColor(total: number): string {
  if (total >= 0.80) return '#16a34a'
  if (total >= 0.65) return '#f5a623'
  if (total >= 0.50) return '#1a3a8f'
  return '#888'
}
