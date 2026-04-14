import { useState, useEffect, useRef } from 'react'

// Prompt di avvio flusso suggerimenti
const PROMPT_SUGGERIMENTI =
  'Vorrei che mi suggerissi nuovi libri da leggere basandoti sui miei gusti reali.'

// ─── Parsing quick-reply options da un messaggio AI ──────────────────────────
// Restituisce { text, options } dove options sono le righe "N. Testo"
function parseMessage(content) {
  const lines = content.split('\n')
  const optionRegex = /^\s*(\d+)\.\s+(.+)$/
  const optionLines = []
  const textLines = []

  for (const line of lines) {
    const m = line.match(optionRegex)
    if (m) {
      optionLines.push(m[2].trim())
    } else {
      textLines.push(line)
    }
  }

  // Consideriamo opzioni solo se ci sono 1-6 righe di opzioni brevi (scelte, non liste)
  const areOptions = optionLines.length >= 1 && optionLines.length <= 6 &&
    optionLines.every(o => o.length < 80)

  if (areOptions) {
    return { text: textLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), options: optionLines }
  }
  return { text: content, options: [] }
}

// ─── Bubble messaggio ─────────────────────────────────────────────────────────
function Bubble({ msg, isLast, onQuickReply }) {
  const isUser = msg.role === 'user'
  const { text, options } = (!isUser && isLast) ? parseMessage(msg.content) : { text: msg.content, options: [] }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 text-sm">
          ✨
        </div>
      )}
      <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
            ${isUser
              ? 'bg-brand-500 text-white rounded-tr-sm'
              : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}
        >
          {text}
        </div>

        {/* Quick-reply buttons — solo sull'ultimo messaggio AI */}
        {options.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onQuickReply(opt)}
                className="text-left px-4 py-2 rounded-full border border-brand-300 text-brand-600 text-sm hover:bg-brand-50 active:bg-brand-100 transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ChatWidget ───────────────────────────────────────────────────────────────
export default function ChatWidget() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // Scroll in fondo quando arrivano nuovi messaggi
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open])

  // Focus sull'input quando si apre
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Chiudi con Escape
  useEffect(() => {
    if (!open) return
    const handler = e => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  async function send(content) {
    const text = (content || input).trim()
    if (!text || loading) return
    setError(null)
    setInput('')

    const userMsg = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
      } else {
        setError(data.error || 'Errore sconosciuto')
        setMessages(prev => prev.slice(0, -1))
      }
    } catch (e) {
      setError('Errore di rete. Controlla la connessione.')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function reset() {
    setMessages([])
    setInput('')
    setError(null)
  }

  const isEmpty = messages.length === 0

  return (
    <>
      {/* ── Pulsante header ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Assistente AI"
        className={`ml-2 p-2 rounded-lg transition-colors flex-shrink-0
          ${open
            ? 'bg-brand-500 text-white'
            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
        </svg>
      </button>

      {/* ── Popup ───────────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
            onClick={() => setOpen(false)}
          />

          {/* Pannello: full-screen mobile, floating desktop */}
          <div className="
            fixed z-50
            top-0 inset-x-0 bottom-16
            sm:inset-auto sm:bottom-4 sm:right-4
            sm:w-[420px] sm:h-[620px]
            bg-white sm:rounded-2xl shadow-2xl
            flex flex-col overflow-hidden
          ">

            {/* Header popup */}
            <div className="flex items-center gap-3 px-4 py-3 bg-brand-500 text-white flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-base">✨</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight">Assistente letterario</p>
                <p className="text-xs text-brand-100 leading-tight">Conosce la tua libreria</p>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={reset}
                  className="text-xs text-brand-100 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
                  title="Nuova conversazione"
                >
                  Nuova chat
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Area messaggi */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {isEmpty ? (
                /* Stato vuoto */
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="text-5xl mb-4">✨</div>
                  <p className="font-semibold text-gray-800 mb-1">Ciao Cristina!</p>
                  <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                    Conosco la tua libreria. Chiedimi quello che vuoi, oppure usa il pulsante qui sotto per ricevere suggerimenti personalizzati.
                  </p>
                  <button
                    onClick={() => send(PROMPT_SUGGERIMENTI)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors text-left"
                  >
                    <span className="text-2xl flex-shrink-0">📚</span>
                    <div>
                      <p className="font-medium text-amber-800 text-sm">Suggeriscimi libri</p>
                      <p className="text-xs text-amber-600">Basato sui tuoi voti e preferenze</p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="ml-auto text-amber-400 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <Bubble
                      key={i}
                      msg={msg}
                      isLast={i === messages.length - 1}
                      onQuickReply={send}
                    />
                  ))}
                  {loading && (
                    <div className="flex justify-start mb-3">
                      <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 text-sm">✨</div>
                      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </div>
                    </div>
                  )}
                  {error && (
                    <div className="mx-2 mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
                      {error}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Quick action persistente */}
            {!isEmpty && (
              <div className="px-4 pb-2 flex-shrink-0">
                <button
                  onClick={() => { reset(); setTimeout(() => send(PROMPT_SUGGERIMENTI), 0) }}
                  disabled={loading}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 disabled:opacity-50 transition-colors text-left"
                >
                  <span className="text-base">📚</span>
                  <span className="text-xs font-medium text-amber-800">Suggeriscimi libri</span>
                </button>
              </div>
            )}

            {/* Input */}
            <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-gray-100">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Scrivi un messaggio…"
                  rows={1}
                  disabled={loading}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none disabled:opacity-50"
                  style={{ minHeight: '42px', maxHeight: '120px' }}
                  onInput={e => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  className="flex-shrink-0 w-10 h-10 bg-brand-500 text-white rounded-xl flex items-center justify-center hover:bg-brand-600 disabled:opacity-40 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5 text-center">Invio per inviare · Shift+Invio per andare a capo</p>
            </div>
          </div>
        </>
      )}
    </>
  )
}
