import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import QRCode from 'qrcode';
import { useAuthStore } from '../store';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';

interface Booking {
    bookingId: string;
    equipmentName: string;
    status: string;
    slot?: { date: string; startTime: string; endTime: string };
    purpose?: string;
    waitlistPosition?: number;
    rejectionReason?: string;
    createdAt?: string;
}

function QRModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const qrValue = `smartlab://check-in?bookingId=${booking.bookingId}`;

    useEffect(() => {
        if (canvasRef.current) {
            QRCode.toCanvas(canvasRef.current, qrValue, {
                width: 220,
                margin: 2,
                color: { dark: '#0f172a', light: '#ffffff' },
            });
        }
    }, [qrValue]);

    return (
        <div className='fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4' onClick={onClose}>
            <div className='glass rounded-2xl p-8 max-w-sm w-full border border-slate-600/50 text-center' onClick={e => e.stopPropagation()}>
                <h2 className='text-lg font-bold text-white mb-1'>Show this to Lab Staff</h2>
                <p className='text-indigo-400 font-semibold mb-1'>{booking.equipmentName}</p>
                <p className='text-sm text-slate-400 mb-6'>
                    📅 {booking.slot?.date} · {booking.slot?.startTime}–{booking.slot?.endTime}
                </p>
                <div className='flex justify-center mb-4'>
                    <div className='bg-white p-3 rounded-xl inline-block shadow-[0_0_15px_rgba(255,255,255,0.1)]'>
                        <canvas ref={canvasRef} />
                    </div>
                </div>
                <div className='bg-slate-800/80 rounded-xl p-3 mb-6 flex items-center justify-between border border-slate-700/50'>
                    <div className='text-left'>
                        <p className='text-xs text-slate-500 mb-0.5'>Booking ID</p>
                        <p className='text-sm font-mono text-slate-300'>{booking.bookingId}</p>
                    </div>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(booking.bookingId);
                            toast.success('Booking ID copied!');
                        }}
                        className='p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors'
                        title="Copy ID">
                        <ClipboardDocumentIcon className='w-4 h-4' />
                    </button>
                </div>
                <p className='text-xs text-slate-500 mb-6'>
                    The lab assistant will scan this QR code or use the ID to check you in
                </p>
                <button onClick={onClose}
                    className='w-full py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all font-medium'>
                    Close
                </button>
            </div>
        </div>
    );
}

export default function MyBookings() {
    const { user } = useAuthStore();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState<string | null>(null);
    const [qrBooking, setQrBooking] = useState<Booking | null>(null);

    const fetchId = useRef(0);

    const fetchBookings = useCallback(async () => {
        const id = ++fetchId.current;
        setLoading(true);
        try {
            const r = await api.get('/bookings');
            if (id === fetchId.current) {
                setBookings(r.data.bookings ?? []);
            }
        } catch (err: unknown) {
            console.error('MyBookings fetch error:', err);
            if (id === fetchId.current) {
                const axiosErr = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
                const msg = axiosErr?.response?.data?.message ?? axiosErr?.message ?? 'Failed to load bookings.';
                if (axiosErr?.response?.status !== 401) {
                    toast.error(msg);
                }
            }
        } finally {
            if (id === fetchId.current) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const handleCancel = async (bookingId: string) => {
        if (!confirm('Are you sure you want to cancel this booking?')) return;
        setCancelling(bookingId);
        try {
            await api.delete(`/bookings/${bookingId}`);
            setBookings(b => b.map(bk => bk.bookingId === bookingId ? { ...bk, status: 'CANCELLED' } : bk));
            toast.success('Booking cancelled.');
        } catch {
            toast.error('Failed to cancel booking.');
        } finally {
            setCancelling(null);
        }
    };

    if (loading) return (
        <div className='flex items-center justify-center h-48'>
            <div className='w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin' />
        </div>
    );

    return (
        <div className='space-y-6'>
            <h1 className='text-2xl font-bold text-white'>My Bookings</h1>

            {/* QR Modal */}
            {qrBooking && <QRModal booking={qrBooking} onClose={() => setQrBooking(null)} />}

            {bookings.length === 0 ? (
                <div className='text-center py-12 text-slate-400'>No bookings yet. Browse equipment to get started.</div>
            ) : (
                <div className='space-y-4'>
                    {bookings.map(b => (
                        <div key={b.bookingId} className='glass rounded-xl p-5 flex items-center justify-between hover-lift border border-slate-700/50'>
                            <div className='flex-1'>
                                <div className='flex items-center gap-3 mb-1'>
                                    <h3 className='font-semibold text-white'>{b.equipmentName}</h3>
                                    <span className={clsx('text-xs px-2 py-0.5 rounded-full', `status-${b.status.toLowerCase()}`)}>
                                        {b.status}{b.waitlistPosition ? ` #${b.waitlistPosition}` : ''}
                                    </span>
                                </div>
                                <p className='text-sm text-slate-400'>
                                    📅 {b.slot?.date} · {b.slot?.startTime}–{b.slot?.endTime}
                                </p>
                                {b.purpose && <p className='text-xs text-slate-500 mt-1 line-clamp-1'>Purpose: {b.purpose}</p>}
                                {b.rejectionReason && <p className='text-xs text-red-400 mt-1'>Reason: {b.rejectionReason}</p>}
                            </div>
                            <div className='flex items-center gap-2 ml-4'>
                                {user?.role === 'Student' && (b.status === 'APPROVED' || b.status === 'PENDING') && (
                                    <button
                                        onClick={() => setQrBooking(b)}
                                        className='px-4 py-2 text-sm text-indigo-400 border border-indigo-800/50 rounded-lg hover:bg-indigo-900/20 transition-all'>
                                        📱 Show QR
                                    </button>
                                )}
                                {['PENDING', 'APPROVED', 'WAITLISTED'].includes(b.status) && (
                                    <button
                                        onClick={() => handleCancel(b.bookingId)}
                                        disabled={cancelling === b.bookingId}
                                        className='px-4 py-2 text-sm text-red-400 border border-red-800/50 rounded-lg hover:bg-red-900/20 transition-all disabled:opacity-50'>
                                        {cancelling === b.bookingId ? '…' : 'Cancel'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
