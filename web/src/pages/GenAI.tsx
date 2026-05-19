import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import api from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

interface UsageSummary {
    used: number;
    limit: number;
    percentUsed: number;
    resetsAt: string;
}

export default function GenAIPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [usage, setUsage] = useState<UsageSummary | null>(null);
    const sessionId = useRef(uuidv4());  // Tab-isolated session
    const bottomRef = useRef<HTMLDivElement>(null);

    // Load usage on mount
    useEffect(() => {
        api.get('/genai/usage')
            .then(r => setUsage(r.data))
            .catch(() => { });
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        const msg = input.trim();
        if (!msg || sending) return;

        const userMsg: Message = { role: 'user', content: msg, timestamp: new Date().toISOString() };
        setMessages(m => [...m, userMsg]);
        setInput('');
        setSending(true);

        try {
            const res = await api.post('/genai/chat', { message: msg, sessionId: sessionId.current });
            const assistantMsg: Message = {
                role: 'assistant',
                content: res.data.reply,
                timestamp: new Date().toISOString(),
            };
            setMessages(m => [...m, assistantMsg]);
            if (res.data.usage) {
                setUsage(u => u ? { ...u, used: res.data.usage.used, percentUsed: Math.round((res.data.usage.used / u.limit) * 100) } : u);
            }
        } catch (err: unknown) {
            const axiosErr = err as { response?: { status?: number; data?: { message?: string; resetsAt?: string } } };
            if (axiosErr.response?.status === 429) {
                const retryMsg = axiosErr.response?.data?.message ?? 'Monthly AI assistant limit reached.';
                toast.error(retryMsg, { duration: 8000 });
                setMessages(m => m.slice(0, -1)); // remove user's message
                setInput(msg);
            } else {
                toast.error('AI assistant is temporarily unavailable.');
                setMessages(m => m.slice(0, -1));
                setInput(msg);
            }
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className='flex flex-col h-full max-w-3xl mx-auto'>
            <div className='flex items-center justify-between mb-6'>
                <div>
                    <h1 className='text-2xl font-bold gradient-text'>AI Lab Assistant</h1>
                    <p className='text-slate-400 text-sm mt-1'>Ask about equipment, bookings & lab insights</p>
                </div>
                {usage && (
                    <div className='text-right'>
                        <div className='text-xs text-slate-400'>{usage.used.toLocaleString()} / {usage.limit.toLocaleString()} tokens</div>
                        <div className='w-32 h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden'>
                            <div
                                className={clsx('h-full rounded-full transition-all', {
                                    'bg-green-500': usage.percentUsed < 70,
                                    'bg-yellow-500': usage.percentUsed >= 70 && usage.percentUsed < 90,
                                    'bg-red-500': usage.percentUsed >= 90,
                                })}
                                style={{ width: `${usage.percentUsed}%` }}
                            />
                        </div>
                        <div className='text-xs text-slate-500 mt-0.5'>Resets {usage.resetsAt}</div>
                    </div>
                )}
            </div>

            {/* Chat messages */}
            <div className='flex-1 glass rounded-2xl p-4 space-y-4 overflow-y-auto mb-4 min-h-0' style={{ maxHeight: 'calc(100vh - 330px)' }}>
                {messages.length === 0 && (
                    <div className='h-full flex flex-col items-center justify-center text-slate-500'>
                        <span className='text-4xl mb-3'>✨</span>
                        <p className='text-sm'>Ask me anything about your lab, equipment, or bookings.</p>
                        <div className='flex flex-wrap gap-2 mt-4 justify-center'>
                            {['What equipment is available today?', 'Show me underutilised equipment', 'How do I book the microscope?'].map(q => (
                                <button key={q} onClick={() => setInput(q)}
                                    className='text-xs px-3 py-1.5 bg-slate-700/60 text-slate-300 rounded-full hover:bg-slate-700 transition-all'>
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                        <div className={clsx('max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed', {
                            'bg-indigo-600/80 text-white rounded-br-sm': m.role === 'user',
                            'bg-slate-700/60 text-slate-100 rounded-bl-sm': m.role === 'assistant',
                        })}>
                            <p className='whitespace-pre-wrap'>{m.content}</p>
                            <p className={clsx('text-xs mt-1 opacity-60', m.role === 'user' ? 'text-right' : '')}>
                                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                ))}
                {sending && (
                    <div className='flex justify-start'>
                        <div className='bg-slate-700/60 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1'>
                            <span className='w-2 h-2 bg-slate-400 rounded-full animate-bounce' style={{ animationDelay: '0ms' }} />
                            <span className='w-2 h-2 bg-slate-400 rounded-full animate-bounce' style={{ animationDelay: '150ms' }} />
                            <span className='w-2 h-2 bg-slate-400 rounded-full animate-bounce' style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className='flex gap-3'>
                <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder='Ask SmartLab Assistant… (Enter to send, Shift+Enter for new line)'
                    rows={2}
                    className='flex-1 px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm resize-none'
                />
                <button
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    className='px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 self-end'>
                    {sending ? '…' : '↑'}
                </button>
            </div>
        </div>
    );
}
