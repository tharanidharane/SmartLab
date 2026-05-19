// RequestCard — Lab Assistant review card for pending bookings
import { useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import BookingStatusBadge from './BookingStatusBadge';

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
}

interface Props {
    booking: Booking;
    onDecision: (bookingId: string, newStatus: 'APPROVED' | 'REJECTED') => void;
}

export default function RequestCard({ booking: b, onDecision }: Props) {
    const [loading, setLoading] = useState(false);

    const decide = async (status: 'APPROVED' | 'REJECTED') => {
        let reason: string | null = null;
        if (status === 'REJECTED') {
            reason = prompt('Rejection reason (will be shown to the student):');
            if (reason === null) return; // cancelled
        }
        setLoading(true);
        try {
            await api.put(`/bookings/${b.bookingId}/status`, {
                status,
                rejectionReason: reason || undefined,
            });
            toast.success(`Booking ${status.toLowerCase()}.`);
            onDecision(b.bookingId, status);
        } catch {
            toast.error('Action failed. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='glass rounded-xl p-5 border border-blue-800/30 hover-lift'>
            <div className='flex items-start justify-between gap-3 mb-3'>
                <div>
                    <h3 className='font-semibold text-white'>{b.equipmentName}</h3>
                    <p className='text-xs text-slate-400 mt-0.5'>
                        👤 {b.userName ?? b.userEmail}
                        {b.createdAt && (
                            <span className='ml-2 text-slate-500'>
                                · {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                            </span>
                        )}
                    </p>
                </div>
                <BookingStatusBadge status={b.status} />
            </div>

            {b.slot && (
                <p className='text-xs text-slate-400 mb-2'>📅 {b.slot.date} · {b.slot.startTime}–{b.slot.endTime}</p>
            )}
            {b.purpose && (
                <div className='bg-slate-800/50 rounded-lg px-3 py-2 mb-4 border border-slate-700/30'>
                    <p className='text-xs text-slate-400 font-medium mb-0.5'>Purpose</p>
                    <p className='text-xs text-slate-300 leading-relaxed'>{b.purpose}</p>
                </div>
            )}

            <div className='flex gap-2'>
                <button
                    onClick={() => decide('APPROVED')}
                    disabled={loading}
                    className='flex-1 py-2 text-xs font-semibold text-green-300 bg-green-900/30 border border-green-800/50 rounded-lg hover:bg-green-900/50 transition-all disabled:opacity-50'>
                    ✓ Approve
                </button>
                <button
                    onClick={() => decide('REJECTED')}
                    disabled={loading}
                    className='flex-1 py-2 text-xs font-semibold text-red-300 bg-red-900/30 border border-red-800/50 rounded-lg hover:bg-red-900/50 transition-all disabled:opacity-50'>
                    ✗ Reject
                </button>
            </div>
        </div>
    );
}
