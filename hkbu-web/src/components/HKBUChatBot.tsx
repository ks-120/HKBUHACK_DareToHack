import { useState, useRef, useEffect } from 'react'
import s from './HKBUChatBot.module.css'

interface Message {
  role: 'user' | 'bot'
  text: string
}

// ── HKBU GenAI Platform config ────────────────────────────────────────────────
const HKBU_BASE_URL   = '/hkbu-api'
const HKBU_MODEL      = import.meta.env.VITE_HKBU_GENAI_MODEL ?? 'gpt-4.1'
const HKBU_API_KEY    = import.meta.env.VITE_HKBU_GENAI_API_KEY ?? ''
const HKBU_API_VER    = '2024-12-01-preview'

const SYSTEM_PROMPT = `You are HKBUChat, a friendly and helpful AI assistant for Hong Kong Baptist University (HKBU) students. 
You help students with:
- Campus life questions (facilities, canteens, libraries, sports centres)
- Academic matters (course registration, exam schedules, GPA calculation)
- Student services (counselling, financial aid, health centre)
- Campus events and activities
- General problem solving for university life
Always be concise, warm, and helpful. If you don't know something specific about HKBU, give the best general advice you can.`

async function askBot(messages: { role: string; content: string }[]): Promise<string> {
  const url = `${HKBU_BASE_URL}/deployments/${HKBU_MODEL}/chat/completions?api-version=${HKBU_API_VER}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': HKBU_API_KEY,
    },
    body: JSON.stringify({
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
      stream: false,
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

export default function HKBUChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: "Hi! I'm HKBUChat 🎓 How can I help you today?" },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = [...messages, userMsg]
        .filter(m => m.role === 'user' || m.role === 'bot')
        .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text }))

      const reply = await askBot(history)
      setMessages(prev => [...prev, { role: 'bot', text: reply }])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'bot', text: '⚠️ Sorry, I ran into an error. Please try again later.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button className={s.fab} onClick={() => setOpen(o => !o)} aria-label="Open HKBUChat">
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className={s.panel}>
          {/* Header */}
          <div className={s.header}>
            <span className={s.headerEmoji}>🎓</span>
            <div>
              <p className={s.headerTitle}>HKBUChat</p>
              <p className={s.headerSub}>AI assistant for HKBU students</p>
            </div>
          </div>

          {/* Messages */}
          <div className={s.messages}>
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
                  <span className={s.typing}>
                    <span /><span /><span />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
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
            <button className={s.sendBtn} onClick={send} disabled={loading || !input.trim()}>
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  )
}
