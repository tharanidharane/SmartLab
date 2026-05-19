import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../lib/api';
import clsx from 'clsx';

const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date'),
    purpose: z.string().min(10, 'Purpose must be at least 10 characters').max(500),
    notes: z.string().max(300).optional(),
});
type FormValues = z.infer<typeof schema>;

interface Slot { date: string; startTime: string; endTime: string; available: boolean; }

export default function BookingCreate() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [slots, setSlots] = useState<Slot[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const today = format(new Date(), 'yyyy-MM-dd');

    const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { date: today },
    });

    const watchedDate = watch('date');

    useEffect(() => {
        if (!watchedDate || !id) return;
        api.get(`/equipment/${id}/slots?date=${watchedDate}`)
            .then(r => { setSlots(r.data.slots ?? []); setSelectedSlot(null); })
            .catch((err) => {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                toast.error(msg ?? 'Failed to load available slots.');
            });
    }, [watchedDate, id]);

    const onSubmit = async (data: FormValues) => {
        if (!selectedSlot) { toast.error('Please select a time slot.'); return; }
        setIsSubmitting(true);
        try {
            await api.post('/bookings', {
                equipmentId: id,
                slot: { date: data.date, startTime: selectedSlot.startTime, endTime: selectedSlot.endTime, timezone: 'Asia/Kolkata' },
                purpose: data.purpose,
                notes: data.notes,
            });
            toast.success('Booking submitted successfully!');
            navigate('/bookings');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string }; status?: number } };
            const serverMsg = axiosErr?.response?.data?.message;
            const status = axiosErr?.response?.status;
            if (status === 409) {
                toast.error(serverMsg ?? 'This slot is already booked. Try another slot or time.');
            } else if (status === 400) {
                toast.error(serverMsg ?? 'Invalid booking details. Please check your inputs.');
            } else if (status === 403) {
                toast.error(serverMsg ?? 'You are not allowed to book this equipment.');
            } else {
                toast.error(serverMsg ?? 'Failed to submit booking. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className='max-w-2xl mx-auto space-y-6'>
            <div className='flex items-center gap-3'>
                <button onClick={() => navigate(-1)} className='text-slate-400 hover:text-white transition-colors'>← Back</button>
                <h1 className='text-2xl font-bold text-white'>Book Equipment</h1>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
                {/* Date */}
                <div className='glass rounded-xl p-6'>
                    <label className='block text-sm font-medium text-slate-300 mb-2'>Select Date</label>
                    <input type='date' {...register('date')} min={today}
                        className='px-4 py-2.5 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-sm' />
                    {errors.date && <p className='text-red-400 text-xs mt-1'>{errors.date.message}</p>}
                </div>

                {/* Slots */}
                <div className='glass rounded-xl p-6'>
                    <label className='block text-sm font-medium text-slate-300 mb-4'>Select Time Slot</label>
                    <div className='grid grid-cols-3 gap-2'>
                        {slots.map(s => (
                            <button key={`${s.startTime}-${s.endTime}`} type='button'
                                disabled={!s.available}
                                onClick={() => setSelectedSlot(s)}
                                className={clsx('py-2 rounded-lg text-xs font-medium transition-all border', {
                                    'bg-indigo-600 border-indigo-500 text-white': selectedSlot?.startTime === s.startTime,
                                    'bg-slate-800/60 border-slate-600/50 text-slate-300 hover:border-indigo-500': s.available && selectedSlot?.startTime !== s.startTime,
                                    'bg-slate-900/40 border-slate-800/30 text-slate-600 cursor-not-allowed': !s.available,
                                })}>
                                {s.startTime}–{s.endTime}
                                {!s.available && <span className='block text-xs opacity-60'>Booked</span>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Purpose */}
                <div className='glass rounded-xl p-6 space-y-4'>
                    <div>
                        <label className='block text-sm font-medium text-slate-300 mb-2'>Purpose *</label>
                        <textarea {...register('purpose')} rows={3}
                            placeholder='Describe your research or project purpose…'
                            className='w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm resize-none' />
                        {errors.purpose && <p className='text-red-400 text-xs mt-1'>{errors.purpose.message}</p>}
                    </div>
                    <div>
                        <label className='block text-sm font-medium text-slate-300 mb-2'>Notes (optional)</label>
                        <textarea {...register('notes')} rows={2}
                            placeholder='Any additional notes…'
                            className='w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm resize-none' />
                    </div>
                </div>

                <button type='submit' disabled={isSubmitting || !selectedSlot}
                    className='w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold rounded-xl hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-lg shadow-indigo-900/40 disabled:opacity-50 disabled:cursor-not-allowed'>
                    {isSubmitting ? 'Submitting…' : 'Submit Booking'}
                </button>
            </form>
        </div>
    );
}
