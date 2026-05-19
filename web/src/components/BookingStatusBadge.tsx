// BookingStatusBadge — animated pulse for PENDING, static for all others
import clsx from 'clsx';

const CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; border: string; pulse: boolean }> = {
    PENDING: { label: 'Pending', dot: 'bg-blue-400', text: 'text-blue-300', bg: 'bg-blue-900/30', border: 'border-blue-800/50', pulse: true },
    APPROVED: { label: 'Approved', dot: 'bg-green-400', text: 'text-green-300', bg: 'bg-green-900/30', border: 'border-green-800/50', pulse: false },
    REJECTED: { label: 'Rejected', dot: 'bg-red-400', text: 'text-red-300', bg: 'bg-red-900/30', border: 'border-red-800/50', pulse: false },
    CANCELLED: { label: 'Cancelled', dot: 'bg-slate-400', text: 'text-slate-300', bg: 'bg-slate-800/30', border: 'border-slate-700/50', pulse: false },
    WAITLISTED: { label: 'Waitlisted', dot: 'bg-purple-400', text: 'text-purple-300', bg: 'bg-purple-900/30', border: 'border-purple-800/50', pulse: false },
    COMPLETED: { label: 'Completed', dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-900/30', border: 'border-amber-800/50', pulse: false },
};

interface Props { status: string; waitlistPosition?: number; size?: 'sm' | 'md'; }

export default function BookingStatusBadge({ status, waitlistPosition, size = 'sm' }: Props) {
    const cfg = CONFIG[status] ?? CONFIG['CANCELLED'];
    return (
        <span className={clsx(
            'inline-flex items-center gap-1.5 rounded-full border font-medium',
            cfg.bg, cfg.text, cfg.border,
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
        )}>
            <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot, cfg.pulse && 'animate-pulse')} />
            {cfg.label}{waitlistPosition ? ` #${waitlistPosition}` : ''}
        </span>
    );
}
