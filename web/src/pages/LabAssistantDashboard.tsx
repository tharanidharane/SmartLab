/**
 * Lab Assistant Dashboard — 3 plan features:
 * 1. QR code scanner — simulated via URL decode (use mobile app for camera)
 * 2. Real-time usage log feed (polling every 30s)
 * 3. Rejected/Waitlisted history tab
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import RequestCard from '../components/RequestCard';
import BookingStatusBadge from '../components/BookingStatusBadge';
import clsx from 'clsx';

interface Booking {
    bookingId: string;
    userId: string;
    userEmail: string;
    userName?: string;
    equipmentName: string;
    status: string;
    slot?: { date: string; startTime: string; endTime: string };
    purpose?: string;
    createdAt?: string;
    waitlistPosition?: number;
    rejectionReason?: string;
}

interface UsageEvent {
    eventType: string;
    bookingId: string;
    equipmentName: string;
    userName?: string;
    timestamp: string;
    status?: string;
}

type Tab = 'pending' | 'usage' | 'history';

export default function LabAssistantDashboard() {
    const [tab, setTab] = useState<Tab>('pending');
    const [pending, setPending] = useState<Booking[]>([]);
    const [usageLogs, setUsageLogs] = useState<UsageEvent[]>([]);
    const [history, setHistory] = useState<Booking[]>([]);
    const [qrInput, setQrInput] = useState('');
    const [qrResult, setQrResult] = useState<Booking | null>(null);
    const [loading, setLoading] = useState(true);
    const [historyFilter, setHistoryFilter] = useState<'REJECTED' | 'WAITLISTED'>('REJECTED');

    // ── Load pending bookings ──────────────────────────────────────────
    useEffect(() => {
        api.get('/bookings/pending')
            .then(r => setPending(r.data.bookings ?? []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    // ── Load history (rejected + waitlisted) ─────────────────────────
    useEffect(() => {
        if (tab === 'history') {
            api.get(`/bookings/all?status=${historyFilter}&limit=50`)
                .then(r => setHistory(r.data.bookings ?? []))
                .catch(() => { });
        }
    }, [tab, historyFilter]);

    // ── Real-time usage log feed (poll every 30s) ─────────────────────
    const loadUsage = useCallback(async () => {
        try {
            const res = await api.get('/analytics/audit-logs?eventType=BOOKING_STATUS_CHANGED&limit=30');
            setUsageLogs(res.data.logs ?? []);
        } catch { }
    }, []);

    useEffect(() => {
        if (tab !== 'usage') return;
        loadUsage();
        const interval = setInterval(loadUsage, 30_000);
        return () => clearInterval(interval);
    }, [tab, loadUsage]);

    // ── QR Code check-in/check-out ────────────────────────────────────
    // On web: manual booking ID entry (mobile app handles camera scan)
    // QR codes encode: smartlab://check-in?bookingId=XXX or full bookingId
    const handleQrLookup = async () => {
        const bookingId = qrInput.replace(/.*bookingId=/, '').trim();
        if (!bookingId) { toast.error('Enter a booking ID or QR URL.'); return; }
        try {
            const res = await api.get(`/bookings/${bookingId}`);
            setQrResult(res.data.booking ?? res.data);
        } catch { toast.error('Booking not found.'); }
    };

    const handleCheckIn = async () => {
        if (!qrResult) return;
        try {
            await api.put(`/bookings/${qrResult.bookingId}/status`, { status: 'COMPLETED' });
            toast.success('Booking marked as completed (checked in).');
            setQrResult(null); setQrInput('');
        } catch { toast.error('Failed to update booking.'); }
    };

    // ── Decision callback from RequestCard ───────────────────────────
    const handleDecision = (bookingId: string) => {
        setPending(p => p.filter(b => b.bookingId !== bookingId));
    };

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: 'pending', label: 'Pending Requests', count: pending.length },
        { id: 'usage', label: 'Real-time Usage' },
        { id: 'history', label: 'History' },
    ];

    return (
        <div className='space-y-6'>
            <div className='flex items-center justify-between'>
                <h1 className='text-2xl font-bold text-white'>Lab Assistant Dashboard</h1>
                <span className='text-xs text-slate-500'>Approval &amp; monitoring</span>
            </div>

            {/* QR Scanner panel (always visible) */}
            <div className='glass rounded-xl p-5 border border-slate-700/50'>
                <h2 className='text-sm font-semibold text-slate-300 mb-3'>📷 Equipment Check-In / Check-Out</h2>
                <p className='text-xs text-slate-500 mb-3'>
                    Scan QR code via the mobile app, or paste the booking ID or deep-link URL here.
                </p>
                <div className='flex gap-2'>
                    <input value={qrInput} onChange={e => setQrInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleQrLookup()}
                        placeholder='Booking ID or smartlab://check-in?bookingId=…'
                        className='flex-1 px-3 py-2 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600' />
                    <button onClick={handleQrLookup}
                        className='px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-500 transition-all'>
                        Lookup
                    </button>
                </div>
                {qrResult && (
                    <div className='mt-3 bg-green-900/20 border border-green-800/40 rounded-xl p-4'>
                        <div className='flex items-start justify-between'>
                            <div>
                                <p className='text-sm font-semibold text-white'>{qrResult.equipmentName}</p>
                                <p className='text-xs text-slate-400 mt-0.5'>{qrResult.userEmail}</p>
                                {qrResult.slot && <p className='text-xs text-slate-400'>{qrResult.slot.date} · {qrResult.slot.startTime}–{qrResult.slot.endTime}</p>}
                            </div>
                            <BookingStatusBadge status={qrResult.status} />
                        </div>
                        {qrResult.status === 'APPROVED' && (
                            <button onClick={handleCheckIn}
                                className='mt-3 w-full py-2 text-sm font-medium bg-green-700/70 text-green-100 rounded-xl hover:bg-green-700 transition-all'>
                                ✓ Mark Completed (Check-In)
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className='flex gap-1 border-b border-slate-700/50 pb-1'>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={clsx('px-4 py-2 rounded-t-xl text-sm font-medium flex items-center gap-1.5 transition-all', {
                            'bg-slate-800 text-white border-b-2 border-indigo-500': tab === t.id,
                            'text-slate-400 hover:text-white': tab !== t.id,
                        })}>
                        {t.label}
                        {t.count !== undefined && (
                            <span className='text-xs bg-slate-700 text-slate-300 rounded-full px-1.5 py-0.5'>{t.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Pending Requests ──────────────────────────────────────────── */}
            {tab === 'pending' && (
                loading
                    ? <p className='text-slate-400 text-center py-8'>Loading pending requests…</p>
                    : pending.length === 0
                        ? <p className='text-slate-400 text-center py-8'>No pending requests. All caught up! ✓</p>
                        : <div className='grid gap-4 md:grid-cols-2'>
                            {pending.map(b => <RequestCard key={b.bookingId} booking={b} onDecision={handleDecision} />)}
                        </div>
            )}

            {/* ── Real-time Usage Feed ──────────────────────────────────────── */}
            {tab === 'usage' && (
                <div className='space-y-3'>
                    <div className='flex items-center justify-between'>
                        <p className='text-sm text-slate-400'>Live booking status events · refreshes every 30s</p>
                        <button onClick={loadUsage} className='text-xs text-indigo-400 hover:text-indigo-300'>↻ Refresh</button>
                    </div>
                    {usageLogs.length === 0
                        ? <p className='text-slate-400 text-center py-8'>No usage events yet.</p>
                        : usageLogs.map((e, i) => (
                            <div key={i} className='glass rounded-lg px-4 py-3 flex items-start gap-3 border border-slate-700/30'>
                                <span className='text-base'>{e.eventType === 'BOOKING_STATUS_CHANGED' ? '🔄' : '📅'}</span>
                                <div className='flex-1'>
                                    <p className='text-sm text-white'>{e.equipmentName}</p>
                                    <p className='text-xs text-slate-400'>{e.userName ?? e.bookingId}</p>
                                    {e.status && <BookingStatusBadge status={e.status} size='sm' />}
                                </div>
                                <span className='text-xs text-slate-500 shrink-0'>{new Date(e.timestamp).toLocaleTimeString()}</span>
                            </div>
                        ))
                    }
                </div>
            )}

            {/* ── History (Rejected/Waitlisted) ────────────────────────────── */}
            {tab === 'history' && (
                <div className='space-y-4'>
                    <div className='flex gap-2'>
                        {(['REJECTED', 'WAITLISTED'] as const).map(f => (
                            <button key={f} onClick={() => setHistoryFilter(f)}
                                className={clsx('px-4 py-1.5 rounded-xl text-sm font-medium border transition-all', {
                                    'bg-indigo-600/20 border-indigo-500/30 text-indigo-400': historyFilter === f,
                                    'border-slate-700/40 text-slate-400 hover:text-white': historyFilter !== f,
                                })}>
                                {f}
                            </button>
                        ))}
                    </div>
                    {history.length === 0
                        ? <p className='text-slate-400 text-center py-8'>No {historyFilter.toLowerCase()} bookings.</p>
                        : history.map(b => (
                            <div key={b.bookingId} className='glass rounded-xl px-5 py-4 border border-slate-700/50'>
                                <div className='flex items-start justify-between'>
                                    <div>
                                        <p className='font-medium text-white'>{b.equipmentName}</p>
                                        <p className='text-xs text-slate-400'>{b.userEmail}</p>
                                        {b.rejectionReason && <p className='text-xs text-red-400 mt-1'>Reason: {b.rejectionReason}</p>}
                                    </div>
                                    <BookingStatusBadge status={b.status} waitlistPosition={b.waitlistPosition} />
                                </div>
                            </div>
                        ))
                    }
                </div>
            )}
        </div>
    );
}
