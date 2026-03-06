import { useState, useRef, useEffect } from 'react'
import s from './HKBUChatBot.module.css'

interface Message {
  role: 'user' | 'bot'
  text: string
}

interface Props {
  /** 'sidebar' renders inline inside the sidebar; default is floating FAB */
  variant?: 'sidebar' | 'floating'
}

const HKBU_MODEL = import.meta.env.VITE_HKBU_GENAI_MODEL ?? 'gpt-4.1'

// Dev → Vite proxy forwards to HKBU (no CORS issue server-side)
// Prod → Cloudflare Worker proxy (free, handles CORS)
const PROXY_URL = import.meta.env.DEV
  ? '/hkbu-api/deployments/gpt-4.1/chat/completions?api-version=2024-12-01-preview'
  : 'https://hkbu-chat-proxy.daretohack.workers.dev'

const SYSTEM_PROMPT = `You are HKBUChat, a friendly and helpful AI assistant for Hong Kong Baptist University (HKBU) students. 
You help students with:
- Campus life questions (facilities, canteens, libraries, sports centres)
- Academic matters (course registration, exam schedules, GPA calculation)
- Student services (counselling, financial aid, health centre)
- Campus events and activities
- General problem solving for university life
Always be concise, warm, and helpful. If you don't know something specific about HKBU, give the best general advice you can.`

async function askBot(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // only needed in dev (Vite proxy forwards this to HKBU directly)
      ...(import.meta.env.DEV ? { 'api-key': import.meta.env.VITE_HKBU_GENAI_API_KEY ?? '' } : {}),
    },
    body: JSON.stringify({
      model: HKBU_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  })

  if (!res.ok) {
    const status = res.status
    if (status === 401) throw new Error('401: Invalid or missing HKBU GenAI API key.')
    if (status === 404) throw new Error('404: Model not found or endpoint changed.')
    if (status === 429) throw new Error('429: Rate limit exceeded – please wait and try again.')
    throw new Error(`API error: ${status}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? 'Sorry, I could not get a response.'
}

const SUGGESTED = [
  'Where is the library?',
  'How do I check my GPA?',
  'Canteen opening hours?',
  'How to join a club?',
]

export default function HKBUChatBot({ variant = 'floating' }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: "Hi! I'm HKBUChat 🎓 Ask me anything about HKBU!" },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = [...messages, userMsg]
        .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text }))
      const reply = await askBot(history)
      setMessages(prev => [...prev, { role: 'bot', text: reply }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages(prev => [...prev, { role: 'bot', text: `⚠️ ${msg}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clearChat = () => {
    setMessages([{ role: 'bot', text: "Hi! I'm HKBUChat 🎓 Ask me anything about HKBU!" }])
  }

  // ── Shared chat body ─────────────────────────────────────────────────────
  const chatBody = (
    <>
      <div className={variant === 'sidebar' ? s.messagesSidebar : s.messages}>
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? s.msgUser : s.msgBot}>
            {msg.role === 'bot' && <span className={s.botAvatar}>🤖</span>}
            <div className={msg.role === 'user' ? s.bubbleUser : s.bubbleBot}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className={s.msgBot}>
            <span className={s.botAvatar}>🤖</span>
            <div className={s.bubbleBot}>
              <span className={s.typing}><span /><span /><span /></span>
            </div>
          </div>
        )}
        {/* Quick suggested prompts — show only when just the greeting is visible */}
        {messages.length === 1 && !loading && (
          <div className={s.suggestRow}>
            {SUGGESTED.map(q => (
              <button key={q} className={s.suggestBtn} onClick={() => send(q)}>{q}</button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={s.inputRow}>
        <textarea
          className={s.textArea}
          rows={1}
          placeholder="Ask me anything about HKBU…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
        />
        <button className={s.sendBtn} onClick={() => send()} disabled={loading || !input.trim()}>
          ➤
        </button>
      </div>
    </>
  )

  // ── SIDEBAR VARIANT ──────────────────────────────────────────────────────
  if (variant === 'sidebar') {
    return (
      <div className={s.sidebarWrapper}>
        {/* Toggle row */}
        <button className={s.sidebarToggle} onClick={() => setOpen(o => !o)}>
          <span className={s.sidebarToggleLeft}>
            <span className={s.sidebarToggleEmoji}>🤖</span>
            <span className={s.sidebarToggleLabel}>AI Assistant</span>
          </span>
          <span className={s.sidebarToggleChevron}>{open ? '▲' : '▼'}</span>
        </button>

        {/* Inline chat panel */}
        {open && (
          <div className={s.sidebarPanel}>
            {/* Mini header */}
            <div className={s.sidebarPanelHeader}>
              <span>🎓 HKBUChat</span>
              <button className={s.clearBtn} onClick={clearChat} title="Clear chat">↺</button>
            </div>
            {chatBody}
          </div>
        )}
      </div>
    )
  }

  // ── FLOATING VARIANT (kept for reference) ────────────────────────────────
  return (
    <>
      <button className={s.fab} onClick={() => setOpen(o => !o)} aria-label="Open HKBUChat">
        {open ? '✕' : '🤖'}
      </button>
      {open && (
        <div className={s.panel}>
          <div className={s.header}>
            <span className={s.headerEmoji}>🎓</span>
            <div>
              <p className={s.headerTitle}>HKBUChat</p>
              <p className={s.headerSub}>AI assistant for HKBU students</p>
            </div>
            <button className={s.clearBtnFloat} onClick={clearChat} title="Clear">↺</button>
          </div>
          {chatBody}
        </div>
      )}
    </>
  )
}
