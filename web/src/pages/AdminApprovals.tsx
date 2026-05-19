import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Booking {
    bookingId: string;
    userId: string;
    userEmail: string;
    equipmentName: string;
    status: string;
    slot?: { date: string; startTime: string; endTime: string };
    purpose?: string;
    createdAt?: string;
}

type ModalType = 'reject' | 'waitlist' | null;

export default function AdminApprovals() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [modalType, setModalType] = useState<ModalType>(null);
    const [modalBooking, setModalBooking] = useState<Booking | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const load = () => {
        setLoading(true);
        api.get('/bookings/pending')
            .then(r => setBookings(r.data.bookings ?? []))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const handleDecision = async (booking: Booking, status: 'APPROVED' | 'REJECTED' | 'WAITLISTED', rejectionReason?: string) => {
        setProcessing(booking.bookingId);
        try {
            await api.put(`/bookings/${booking.bookingId}/status`, { status, rejectionReason });
            setBookings(b => b.filter(bk => bk.bookingId !== booking.bookingId));
            toast.success(`Booking ${status.toLowerCase()}.`);
        } catch (e: any) {
            const msg = e?.response?.data?.message ?? 'Action failed. Please try again.';
            toast.error(msg);
        } finally {
            setProcessing(null);
        }
    };

    const openReject = (b: Booking) => { setRejectReason(''); setModalBooking(b); setModalType('reject'); };
    const openWaitlist = (b: Booking) => { setModalBooking(b); setModalType('waitlist'); };
    const closeModal = () => { setModalType(null); setModalBooking(null); };

    const confirmReject = () => {
        if (!modalBooking) return;
        const b = modalBooking;
        closeModal();
        handleDecision(b, 'REJECTED', rejectReason.trim() || undefined);
    };

    const confirmWaitlist = () => {
        if (!modalBooking) return;
        const b = modalBooking;
        closeModal();
        handleDecision(b, 'WAITLISTED');
    };

    return (
        <div className='space-y-6'>
            {/* Reject Modal */}
            {modalType === 'reject' && modalBooking && (
                <div className='fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4'>
                    <div className='glass rounded-2xl p-6 w-full max-w-md border border-slate-700/50'>
                        <h3 className='text-lg font-semibold text-white mb-1'>Reject Booking</h3>
                        <p className='text-sm text-slate-400 mb-4'>{modalBooking.equipmentName} · {modalBooking.userEmail}</p>
                        <textarea
                            className='w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500 mb-4'
                            rows={3}
                            placeholder='Rejection reason (optional, shown to student)…'
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            autoFocus
                        />
                        <div className='flex gap-3'>
                            <button onClick={closeModal} className='flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-700/50 transition-all'>
                                Cancel
                            </button>
                            <button onClick={confirmReject} className='flex-1 py-2.5 rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 text-sm font-medium hover:bg-red-600/30 transition-all'>
                                ✗ Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Waitlist Modal */}
            {modalType === 'waitlist' && modalBooking && (
                <div className='fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4'>
                    <div className='glass rounded-2xl p-6 w-full max-w-md border border-slate-700/50'>
                        <h3 className='text-lg font-semibold text-white mb-1'>Move to Waitlist</h3>
                        <p className='text-sm text-slate-400 mb-2'>{modalBooking.equipmentName} · {modalBooking.userEmail}</p>
                        <p className='text-sm text-slate-500 mb-6'>The student will be notified and automatically promoted when a slot becomes available.</p>
                        <div className='flex gap-3'>
                            <button onClick={closeModal} className='flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-700/50 transition-all'>
                                Cancel
                            </button>
                            <button onClick={confirmWaitlist} className='flex-1 py-2.5 rounded-xl bg-orange-600/20 border border-orange-500/40 text-orange-400 text-sm font-medium hover:bg-orange-600/30 transition-all'>
                                ⏳ Waitlist
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className='flex items-center justify-between'>
                <h1 className='text-2xl font-bold text-white'>Pending Approvals</h1>
                <button onClick={load} className='text-sm text-indigo-400 hover:text-indigo-300 transition-colors'>↻ Refresh</button>
            </div>

            {loading ? (
                <div className='flex items-center justify-center h-48'>
                    <div className='w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin' />
                </div>
            ) : bookings.length === 0 ? (
                <div className='text-center py-12 text-slate-400'>🎉 No pending approvals. All caught up!</div>
            ) : (
                <div className='space-y-4'>
                    {bookings.map(b => (
                        <div key={b.bookingId} className='glass rounded-xl p-5 border border-blue-800/30'>
                            <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                                <div className='flex-1'>
                                    <h3 className='font-semibold text-white'>{b.equipmentName}</h3>
                                    <p className='text-sm text-slate-400 mt-1'>📅 {b.slot?.date} · {b.slot?.startTime}–{b.slot?.endTime}</p>
                                    <p className='text-sm text-slate-400'>👤 {b.userEmail}</p>
                                    {b.purpose && (
                                        <p className='text-xs text-slate-500 mt-2 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/30'>
                                            Purpose: {b.purpose}
                                        </p>
                                    )}
                                </div>
                                <div className='flex gap-2 shrink-0 flex-wrap'>
                                    <button
                                        onClick={() => handleDecision(b, 'APPROVED')}
                                        disabled={processing === b.bookingId}
                                        className={clsx('px-4 py-2 text-sm font-medium rounded-xl transition-all border status-approved hover:bg-green-600/40',
                                            processing === b.bookingId && 'opacity-50 cursor-not-allowed')}>
                                        ✓ Approve
                                    </button>
                                    <button
                                        onClick={() => openWaitlist(b)}
                                        disabled={processing === b.bookingId}
                                        className={clsx('px-4 py-2 text-sm font-medium rounded-xl transition-all border border-orange-500/40 bg-orange-600/10 text-orange-400 hover:bg-orange-600/30',
                                            processing === b.bookingId && 'opacity-50 cursor-not-allowed')}>
                                        ⏳ Waitlist
                                    </button>
                                    <button
                                        onClick={() => openReject(b)}
                                        disabled={processing === b.bookingId}
                                        className={clsx('px-4 py-2 text-sm font-medium rounded-xl transition-all border status-rejected hover:bg-red-600/40',
                                            processing === b.bookingId && 'opacity-50 cursor-not-allowed')}>
                                        ✗ Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
