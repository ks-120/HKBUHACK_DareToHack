import { useState, useRef, useEffect, useCallback } from 'react'
import { auth, db } from '../config/firebaseConfig'
import { doc, getDoc } from 'firebase/firestore'
import s from './AIChatPage.module.css'

// ── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  ts: number
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

// ── Config ───────────────────────────────────────────────────────────────────
const PROXY_URL = import.meta.env.DEV
  ? '/hkbu-api/deployments/gpt-4.1/chat/completions?api-version=2024-12-01-preview'
  : 'https://hkbu-chat-proxy.daretohack.workers.dev'

const SYSTEM_PROMPT = `You are HKBUChat, a friendly and knowledgeable AI assistant for Hong Kong Baptist University (HKBU) students.
You help with:
- Campus life (facilities, canteens, libraries, sports centres, accommodation)
- Academic matters (course registration, GPA, exam schedules, graduation requirements)
- Student services (counselling, financial aid, health centre, visa support for exchange students)
- Campus events, clubs and activities
- Study tips, time management, mental wellness
- General university life advice in Hong Kong

Format your responses clearly. Use bullet points or numbered lists when listing multiple items.
Be warm, concise, and encouraging. Use relevant emojis sparingly to be friendly.
If unsure about specific HKBU details, give the best general university advice and suggest checking the official HKBU website.`

const SUGGESTED_PROMPTS = [
  { emoji: '📚', text: 'Where is the main library and what are its hours?' },
  { emoji: '🎓', text: 'How do I calculate my GPA at HKBU?' },
  { emoji: '🍜', text: 'What canteens are on campus and when do they open?' },
  { emoji: '🤝', text: 'How do I join a student club or society?' },
  { emoji: '💰', text: 'What financial aid or scholarships are available?' },
  { emoji: '🧘', text: 'Where can I get mental health support on campus?' },
  { emoji: '📝', text: 'How do I register for courses next semester?' },
  { emoji: '✈️', text: 'I am an exchange student. What do I need to know?' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
async function callBot(history: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(import.meta.env.DEV ? { 'api-key': import.meta.env.VITE_HKBU_GENAI_API_KEY ?? '' } : {}),
    },
    body: JSON.stringify({
      model: import.meta.env.VITE_HKBU_GENAI_MODEL ?? 'gpt-4.1',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  })
  if (!res.ok) {
    const s = res.status
    if (s === 401) throw new Error('Invalid API key. Please check your configuration.')
    if (s === 429) throw new Error('Rate limit hit. Please wait a moment and try again.')
    throw new Error(`Server error (${s}). Please try again.`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? 'Sorry, I could not generate a response.'
}

function uid4() { return Math.random().toString(36).slice(2, 10) }

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(ts: number) {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-HK', { month: 'short', day: 'numeric' })
}

/** Very simple markdown-like renderer: bold, inline code, line breaks */
function renderText(text: string) {
  const lines = text.split('\n')
  return lines.map((line, li) => {
    // numbered list
    const numMatch = line.match(/^(\d+)\.\s+(.*)/)
    if (numMatch) return <div key={li} className={s.listItem}><span className={s.listNum}>{numMatch[1]}.</span><span>{formatInline(numMatch[2])}</span></div>
    // bullet list
    const bulletMatch = line.match(/^[-•*]\s+(.*)/)
    if (bulletMatch) return <div key={li} className={s.listItem}><span className={s.bullet}>•</span><span>{formatInline(bulletMatch[1])}</span></div>
    // heading
    if (line.startsWith('### ')) return <div key={li} className={s.h3}>{formatInline(line.slice(4))}</div>
    if (line.startsWith('## '))  return <div key={li} className={s.h2}>{formatInline(line.slice(3))}</div>
    // empty line → spacer
    if (line.trim() === '') return <div key={li} className={s.spacer} />
    return <div key={li}>{formatInline(line)}</div>
  })
}

function formatInline(text: string) {
  // bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`'))   return <code key={i} className={s.inlineCode}>{p.slice(1, -1)}</code>
    return p
  })
}

const STORAGE_KEY = 'hkbu_chat_convos'

function loadConvos(): Conversation[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function saveConvos(convos: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, 30))) // keep max 30
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AIChatPage() {
  const [convos, setConvos]           = useState<Conversation[]>(() => loadConvos())
  const [activeId, setActiveId]       = useState<string | null>(() => loadConvos()[0]?.id ?? null)
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [nickname, setNickname]       = useState('')
  const [photoURL, setPhotoURL]       = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const myUid = auth.currentUser?.uid ?? ''

  // load profile
  useEffect(() => {
    if (!myUid) return
    getDoc(doc(db, 'users', myUid)).then(snap => {
      if (snap.exists()) {
        setNickname(snap.data().nickname ?? '')
        setPhotoURL(snap.data().photoURL ?? '')
      }
    })
  }, [myUid])

  // scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [convos, activeId, loading])

  // auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  // persist whenever convos change
  useEffect(() => { saveConvos(convos) }, [convos])

  const activeConvo = convos.find(c => c.id === activeId) ?? null

  const newChat = useCallback(() => {
    const id = uid4()
    const convo: Conversation = { id, title: 'New Chat', messages: [], createdAt: Date.now() }
    setConvos(prev => [convo, ...prev])
    setActiveId(id)
    setInput('')
  }, [])

  const deleteConvo = (id: string) => {
    setConvos(prev => prev.filter(c => c.id !== id))
    if (activeId === id) setActiveId(convos.find(c => c.id !== id)?.id ?? null)
  }

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || loading) return

    // ensure there's an active convo
    let convoId = activeId
    if (!convoId || !convos.find(c => c.id === convoId)) {
      convoId = uid4()
      const newConvo: Conversation = { id: convoId, title: text.slice(0, 40), messages: [], createdAt: Date.now() }
      setConvos(prev => [newConvo, ...prev])
      setActiveId(convoId)
    }

    const userMsg: Message = { id: uid4(), role: 'user', text, ts: Date.now() }

    setConvos(prev => prev.map(c => {
      if (c.id !== convoId) return c
      const updated = { ...c, messages: [...c.messages, userMsg] }
      // auto-title from first message
      if (c.messages.length === 0) updated.title = text.slice(0, 45) + (text.length > 45 ? '…' : '')
      return updated
    }))
    setInput('')
    setLoading(true)

    try {
      const convo = convos.find(c => c.id === convoId)
      const history = [...(convo?.messages ?? []), userMsg].map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }))
      const reply = await callBot(history)
      const botMsg: Message = { id: uid4(), role: 'assistant', text: reply, ts: Date.now() }
      setConvos(prev => prev.map(c =>
        c.id === convoId ? { ...c, messages: [...c.messages, botMsg] } : c
      ))
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const botMsg: Message = { id: uid4(), role: 'assistant', text: `⚠️ ${errMsg}`, ts: Date.now() }
      setConvos(prev => prev.map(c =>
        c.id === convoId ? { ...c, messages: [...c.messages, botMsg] } : c
      ))
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // group convos by date for the sidebar
  const grouped: { label: string; items: Conversation[] }[] = []
  convos.forEach(c => {
    const label = fmtDate(c.createdAt)
    const last = grouped[grouped.length - 1]
    if (last?.label === label) last.items.push(c)
    else grouped.push({ label, items: [c] })
  })

  return (
    <div className={s.shell}>
      {/* ── LEFT HISTORY SIDEBAR ───────────────────────────────────── */}
      <aside className={`${s.histSidebar} ${sidebarOpen ? s.histOpen : s.histClosed}`}>
        <div className={s.histHeader}>
          <button className={s.toggleSidebarBtn} onClick={() => setSidebarOpen(o => !o)} title="Toggle history">
            ☰
          </button>
          {sidebarOpen && (
            <button className={s.newChatBtn} onClick={newChat}>
              ✏️ New Chat
            </button>
          )}
        </div>

        {sidebarOpen && (
          <div className={s.histList}>
            {convos.length === 0 ? (
              <div className={s.histEmpty}>No conversations yet.<br />Start chatting below!</div>
            ) : (
              grouped.map(group => (
                <div key={group.label}>
                  <div className={s.histDateLabel}>{group.label}</div>
                  {group.items.map(c => (
                    <div key={c.id}
                      className={`${s.histItem} ${c.id === activeId ? s.histItemActive : ''}`}
                      onClick={() => setActiveId(c.id)}
                    >
                      <span className={s.histItemIcon}>💬</span>
                      <span className={s.histItemTitle}>{c.title}</span>
                      <button className={s.histDeleteBtn}
                        onClick={e => { e.stopPropagation(); deleteConvo(c.id) }}
                        title="Delete">✕</button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </aside>

      {/* ── MAIN CHAT AREA ─────────────────────────────────────────── */}
      <main className={s.main}>

        {/* Top bar */}
        <div className={s.topBar}>
          <div className={s.topBarLeft}>
            <span className={s.topBarEmoji}>🤖</span>
            <div>
              <div className={s.topBarTitle}>HKBUChat</div>
              <div className={s.topBarSub}>AI assistant for HKBU students</div>
            </div>
          </div>
          {activeConvo && (
            <button className={s.clearBtn} onClick={() => deleteConvo(activeConvo.id)} title="Delete this chat">
              🗑 Delete chat
            </button>
          )}
        </div>

        {/* Messages */}
        <div className={s.messages}>
          {/* Welcome screen */}
          {(!activeConvo || activeConvo.messages.length === 0) && !loading && (
            <div className={s.welcome}>
              <div className={s.welcomeEmoji}>🎓</div>
              <h2 className={s.welcomeTitle}>How can I help you today?</h2>
              <p className={s.welcomeSub}>
                I'm HKBUChat, your AI assistant for all things HKBU.<br />
                Ask me about campus, courses, student life, and more.
              </p>
              <div className={s.promptGrid}>
                {SUGGESTED_PROMPTS.map(p => (
                  <button key={p.text} className={s.promptCard} onClick={() => send(p.text)}>
                    <span className={s.promptEmoji}>{p.emoji}</span>
                    <span className={s.promptText}>{p.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {activeConvo?.messages.map((msg, idx) => {
            const isUser = msg.role === 'user'
            const prevMsg = activeConvo.messages[idx - 1]
            const showAvatar = !prevMsg || prevMsg.role !== msg.role

            return (
              <div key={msg.id} className={isUser ? s.rowUser : s.rowBot}>
                {!isUser && (
                  <div className={s.avatarCol}>
                    {showAvatar
                      ? <div className={s.botAvatarCircle}>🤖</div>
                      : <div className={s.avatarSpacer} />
                    }
                  </div>
                )}

                <div className={s.msgCol}>
                  {showAvatar && (
                    <div className={s.msgMeta}>
                      <span className={s.msgSender}>{isUser ? (nickname || 'You') : 'HKBUChat'}</span>
                      <span className={s.msgTime}>{fmtTime(msg.ts)}</span>
                    </div>
                  )}
                  <div className={isUser ? s.bubbleUser : s.bubbleBot}>
                    <div className={s.bubbleText}>{renderText(msg.text)}</div>
                  </div>
                </div>

                {isUser && (
                  <div className={s.avatarCol}>
                    {showAvatar ? (
                      photoURL
                        ? <img src={photoURL} className={s.userAvatarImg} alt="me" />
                        : <div className={s.userAvatarFallback}>{(nickname || 'U')[0].toUpperCase()}</div>
                    ) : (
                      <div className={s.avatarSpacer} />
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Typing indicator */}
          {loading && (
            <div className={s.rowBot}>
              <div className={s.avatarCol}>
                <div className={s.botAvatarCircle}>🤖</div>
              </div>
              <div className={s.msgCol}>
                <div className={s.msgMeta}>
                  <span className={s.msgSender}>HKBUChat</span>
                </div>
                <div className={s.bubbleBot}>
                  <span className={s.typing}><span /><span /><span /></span>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className={s.inputWrap}>
          <div className={s.inputBox}>
            <textarea
              ref={textareaRef}
              className={s.textarea}
              placeholder="Message HKBUChat…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              rows={1}
            />
            <button
              className={s.sendBtn}
              onClick={() => send()}
              disabled={loading || !input.trim()}
              title="Send (Enter)"
            >
              {loading ? <span className={s.sendSpinner} /> : '↑'}
            </button>
          </div>
          <p className={s.inputHint}>Press Enter to send · Shift+Enter for new line</p>
        </div>
      </main>
    </div>
  )
}
