// ChatWidget — floating button that expands to a full chat panel
import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import api from '../lib/api';
import ChatUsageMeter from './ChatUsageMeter';
import clsx from 'clsx';

interface Message { role: 'user' | 'assistant'; content: string; }

interface Props {
    context?: string;   // optional prefilled context e.g. "about equipment Microscope A"
}

export default function ChatWidget({ context }: Props) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [usage, setUsage] = useState<{ used: number; limit: number; resetsAt?: string } | null>(null);
    const sessionId = useRef(uuidv4());
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open && !usage) {
            api.get('/genai/usage').then(r => setUsage(r.data)).catch(() => { });
        }
    }, [open, usage]);

    useEffect(() => {
        if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, open]);

    const send = async () => {
        const msg = input.trim();
        if (!msg || sending) return;
        setInput('');
        setSending(true);
        const contextedMsg = context ? `[Context: ${context}]\n${msg}` : msg;
        setMessages(m => [...m, { role: 'user', content: msg }]);
        try {
            const res = await api.post('/genai/chat', { message: contextedMsg, sessionId: sessionId.current });
            setMessages(m => [...m, { role: 'assistant', content: res.data.reply }]);
            if (res.data.usage && usage) {
                setUsage(u => u ? { ...u, used: res.data.usage.used } : u);
            }
        } catch {
            setMessages(m => [...m, { role: 'assistant', content: '⚠️ AI assistant temporarily unavailable.' }]);
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setOpen(o => !o)}
                className={clsx(
                    'fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all z-50',
                    open
                        ? 'bg-slate-700 text-slate-300'
                        : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white hover:scale-110'
                )}
                title='AI Lab Assistant'>
                {open ? '✕' : '✨'}
            </button>

            {/* Chat panel */}
            {open && (
                <div className='fixed bottom-24 right-6 w-80 h-[480px] glass border border-slate-600/50 rounded-2xl shadow-2xl flex flex-col z-50'>
                    {/* Header */}
                    <div className='px-4 py-3 border-b border-slate-700/50 flex items-center justify-between'>
                        <div>
                            <p className='text-sm font-semibold text-white'>AI Lab Assistant</p>
                            {usage && (
                                <div className='mt-1 w-36'>
                                    <ChatUsageMeter used={usage.used} limit={usage.limit} compact />
                                </div>
                            )}
                        </div>
                        <button onClick={() => setOpen(false)} className='text-slate-400 hover:text-white text-lg'>✕</button>
                    </div>

                    {/* Messages */}
                    <div className='flex-1 overflow-y-auto p-3 space-y-3'>
                        {messages.length === 0 && (
                            <p className='text-xs text-slate-500 text-center mt-4'>Ask me about lab equipment, bookings, or analytics.</p>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                                <div className={clsx('max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed', {
                                    'bg-indigo-600/80 text-white rounded-br-sm': m.role === 'user',
                                    'bg-slate-700/60 text-slate-100 rounded-bl-sm': m.role === 'assistant',
                                })}>
                                    {m.content}
                                </div>
                            </div>
                        ))}
                        {sending && (
                            <div className='flex gap-1 px-3 py-2 bg-slate-700/60 rounded-xl w-12'>
                                {[0, 150, 300].map(d => <span key={d} className='w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce' style={{ animationDelay: `${d}ms` }} />)}
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div className='p-3 border-t border-slate-700/50 flex gap-2'>
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                            placeholder='Ask anything…'
                            className='flex-1 px-3 py-2 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs'
                        />
                        <button onClick={send} disabled={sending || !input.trim()}
                            className='w-8 h-8 bg-indigo-600 rounded-xl text-white flex items-center justify-center disabled:opacity-40 text-sm'>
                            ↑
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
