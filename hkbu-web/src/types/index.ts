export type Interest =
  | 'Sports / Fitness' | 'Hiking' | 'Language Exchange' | 'Music / Singing'
  | 'Gaming / Esports' | 'Study Groups' | 'Photography' | 'Cooking / Food'
  | 'Travel / Exploring HK' | 'Art & Design' | 'Tech & Coding' | 'Film / Drama / Anime'
  | 'Volunteering' | 'Debate / Public Speaking' | 'Yoga / Martial Arts'
  | 'Religion / Mindfulness'

export type YearOfStudy =
  | 'Year 1' | 'Year 2' | 'Year 3' | 'Year 4' | 'Year 5+'
  | 'Taught Postgraduate' | 'Research Postgraduate'
  | 'Exchange' | 'Associate' | 'Other'

export type Faculty =
  | 'Faculty of Arts and Social Sciences'
  | 'School of Business'
  | 'School of Chinese Medicine'
  | 'School of Communication and Film'
  | 'School of Creative Arts'
  | 'Faculty of Science'
  | 'Academy of Visual Arts / Other Academies'
  | 'School of Continuing Education / CIE'
  | 'Undeclared / Other'

export type Gender = 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say'

export type StudyStyle =
  | 'Quiet solo focus / Library'
  | 'Group discussions / Brainstorming'
  | 'Explaining / Teaching others'
  | 'Cafe / Relaxed vibe'
  | 'Late-night cramming'
  | 'Early morning / Daytime only'

export type SubjectStrength =
  | 'Languages (EN/Cantonese/Putonghua)'
  | 'Business / Finance / Accounting'
  | 'Science (Bio/Chem/Physics/CS)'
  | 'Social Sciences / Psychology / History'
  | 'Media / Communication / Film'
  | 'Chinese Medicine / Health'
  | 'Arts / Design / Music'
  | 'Other'

export type HelpNeeded =
  | 'Course content understanding'
  | 'Exam / Assignment prep'
  | 'Time management / Motivation'
  | 'Group project coordination'
  | 'Finding notes / Resources'
  | 'Mostly social / friends'

export type Club =
  | 'Academic Society'
  | 'Interest Club (Dance/Drama/Photo/Hiking)'
  | 'Sports Club'
  | 'Cultural / Language Club'
  | 'Faith-based / Christian Fellowship'
  | 'Service (Rotaract / Volunteering)'
  | 'International Students Club'
  | 'Others'

export type BuddyType =
  | 'Study partner (same/similar major)'
  | 'Casual hangout / Meals friend'
  | 'Hobby / Activity partner'
  | 'Campus explorer / New to HK'
  | 'Freshman mentor / Guidance'
  | 'Long-term support friend'

export type MustHave =
  | 'Similar major / courses'
  | 'Shared hobbies / interests'
  | 'Similar personality / energy'
  | 'Reliable / Good communicator'
  | 'Fun / Positive vibe'

export interface UserProfile {
  uid: string
  nickname: string
  email: string
  photoURL?: string
  privacyConsent: boolean
  createdAt: number

  // Basic profile
  yearOfStudy?: YearOfStudy
  showYear?: boolean
  faculty?: Faculty
  showFaculty?: boolean
  major?: string
  gender?: Gender
  showGender?: boolean

  // Personality (1–5 scale)
  personalityIntrovert?: number       // 1=extrovert … 5=introvert
  personalityPlanned?: number         // 1=spontaneous … 5=planned
  personalityDeepTalks?: number       // 1=chit-chat … 5=deep talks
  personalityOptimistic?: number      // 1=reserved … 5=energetic

  // Academic
  studyStyles?: StudyStyle[]
  subjectStrengths?: SubjectStrength[]
  helpNeeded?: HelpNeeded[]

  // Interests
  interests?: Interest[]
  clubs?: Club[]

  // Matching goals
  buddyTypes?: BuddyType[]
  mustHaves?: MustHave[]

  // Fun extras
  bio?: string
  icebreaker?: string
  points?: number
}

export interface Post {
  id: string
  authorUid: string
  authorNickname: string
  content: string
  tags: string[]
  createdAt: number
  upvotes: number
  upvotedBy: string[]
  downvotes: number
  downvotedBy: string[]
  commentCount: number
  reportedBy: string[]
}

export interface Comment {
  id: string
  authorUid: string
  authorNickname: string
  content: string
  createdAt: number
}

export interface Message {
  id: string
  text: string
  senderUid: string
  senderNickname: string
  createdAt: number
}

export interface MatchScoreBreakdown {
  /** 0–1: cosine similarity on one-hot interest vector (weight 35%) */
  interests: number
  /** 0–1: cosine similarity on one-hot study-style vector (weight 20%) */
  studyStyle: number
  /** 0–1: normalised personality vector closeness (weight 25%) */
  personality: number
  /** 0–1: cosine similarity on one-hot buddy-goal vector (weight 20%) */
  buddyGoals: number
  /** 0–1: weighted total after recommender re-ranking */
  total: number
}

export interface MatchResult {
  uid: string
  nickname: string
  photoURL?: string
  sharedInterests: Interest[]
  sharedStudyStyles: StudyStyle[]
  sharedBuddyTypes: BuddyType[]
  score: MatchScoreBreakdown
  /** @deprecated use score.total */
  overlapScore: number
}

export interface Event {
  id: string
  title: string
  description: string
  date: string
  time?: string
  location: string
  emoji: string
  rsvpCount: number
  rsvpedBy: string[]
  imageUrl?: string
  detailUrl?: string
  category?: string
  source?: string
  createdByUid?: string
  createdByNickname?: string
  createdAt?: number
}

export interface ChatMeta {
  id: string
  participants: string[]
  participantNames: Record<string, string>
  participantPhotos: Record<string, string>
  lastMessage: string
  lastAt: number
  [key: string]: unknown
}

export interface StudySession {
  id: string
  chatId: string
  proposedBy: string
  proposedByNickname: string
  withUid: string
  withNickname: string
  date: string
  time: string
  location: string
  subject: string
  status: 'pending' | 'accepted' | 'declined' | 'done'
  createdAt: number
}

export interface HelpPost {
  id: string
  uid: string
  nickname: string
  photoURL?: string
  type: 'need' | 'offer'
  subject: SubjectStrength
  detail: string
  resolved: boolean
  createdAt: number
}

export interface Community {
  id: string
  name: string
  description: string
  emoji: string
  category: 'Study' | 'Hobby' | 'Faculty' | 'Buddy Hunt' | 'Wellness' | 'Other'
  createdBy: string
  createdByNickname: string
  memberCount: number
  members: string[]
  createdAt: number
  isOfficial?: boolean
}

export interface CommunityMessage {
  id: string
  senderUid: string
  senderNickname: string
  senderPhoto?: string
  text: string
  createdAt: number
}
