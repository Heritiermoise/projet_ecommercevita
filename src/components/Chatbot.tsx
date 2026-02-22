import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, X, Bot, User, Loader2 } from 'lucide-react'
import { apiPost } from '../lib/api'

type Message = {
  role: 'user' | 'ai'
  content: string
  timestamp: Date
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content: 'Bonjour ! Je suis votre assistant virtuel Maisha Shop. Comment puis-je vous aider aujourd\'hui ?',
      timestamp: new Date(),
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMsg: Message = { role: 'user', content: input, timestamp: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const response = await apiPost<{ reply: string }>('/api/chatbot', { message: input })
      const aiMsg: Message = { role: 'ai', content: response.reply, timestamp: new Date() }
      setMessages((prev) => [...prev, aiMsg])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: 'Désolé, j\'ai un petit problème technique. Réessayez plus tard !', timestamp: new Date() },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end">
      {/* Fenêtre de chat */}
      {isOpen && (
        <div className="mb-4 flex h-[500px] w-[350px] flex-col overflow-hidden rounded-3xl border bg-white shadow-2xl transition-all animate-in slide-in-from-bottom-4 sm:w-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between bg-slate-900 p-4 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700">
                <Bot size={18} />
              </div>
              <div>
                <div className="text-sm font-bold">Assistant Maisha</div>
                <div className="flex items-center gap-1 text-[10px] opacity-80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  En ligne
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="rounded-full p-1 hover:bg-white/10">
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${
                  msg.role === 'user' ? 'bg-slate-900' : 'bg-slate-700'
                }`}>
                  {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white">
                  <Bot size={12} />
                </div>
                <div className="bg-white rounded-2xl px-3 py-2 text-sm shadow-sm border border-slate-100 rounded-tl-none flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-slate-500" />
                  L'IA réfléchit...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="border-t p-3 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Posez votre question..."
                className="flex-1 rounded-xl bg-slate-100 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bouton flottant */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all active:scale-95 ${
          isOpen ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white'
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>
    </div>
  )
}
