// AuditLogRow — color-coded by event type
import { format } from 'date-fns';
import clsx from 'clsx';

const EVENT_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
    BOOKING_CREATED: { color: 'text-blue-300', bg: 'bg-blue-900/30 border-blue-800/40', icon: '📅' },
    BOOKING_APPROVED: { color: 'text-green-300', bg: 'bg-green-900/30 border-green-800/40', icon: '✅' },
    BOOKING_REJECTED: { color: 'text-red-300', bg: 'bg-red-900/30 border-red-800/40', icon: '❌' },
    BOOKING_CANCELLED: { color: 'text-slate-300', bg: 'bg-slate-800/30 border-slate-700/40', icon: '🚫' },
    EQUIPMENT_CREATED: { color: 'text-indigo-300', bg: 'bg-indigo-900/30 border-indigo-800/40', icon: '🔬' },
    EQUIPMENT_UPDATED: { color: 'text-amber-300', bg: 'bg-amber-900/30 border-amber-800/40', icon: '✏️' },
    EQUIPMENT_DELETED: { color: 'text-red-300', bg: 'bg-red-900/30 border-red-800/40', icon: '🗑️' },
    USER_LOGIN: { color: 'text-sky-300', bg: 'bg-sky-900/30 border-sky-800/40', icon: '🔑' },
    USER_ROLE_CHANGED: { color: 'text-purple-300', bg: 'bg-purple-900/30 border-purple-800/40', icon: '👤' },
    GENAI_QUERY: { color: 'text-fuchsia-300', bg: 'bg-fuchsia-900/30 border-fuchsia-800/40', icon: '✨' },
};

interface Props {
    logId: string;
    eventType: string;
    userId: string;
    userEmail?: string;
    resourceId?: string;
    description?: string;
    timestamp: string;
    ipAddress?: string;
}

export default function AuditLogRow(props: Props) {
    const cfg = EVENT_CONFIG[props.eventType] ?? { color: 'text-slate-300', bg: 'bg-slate-800/30 border-slate-700/40', icon: '📋' };
    return (
        <div className={clsx('border rounded-lg px-4 py-3 flex items-start gap-3', cfg.bg)}>
            <span className='text-lg shrink-0 mt-0.5'>{cfg.icon}</span>
            <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2 flex-wrap'>
                    <span className={clsx('text-xs font-semibold', cfg.color)}>{props.eventType}</span>
                    {props.resourceId && <span className='text-xs text-slate-500 font-mono truncate'>{props.resourceId}</span>}
                </div>
                <p className='text-xs text-slate-400 mt-0.5'>{props.description || 'No description'}</p>
                <div className='flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap'>
                    <span>👤 {props.userEmail ?? props.userId}</span>
                    {props.ipAddress && <span>🌐 {props.ipAddress}</span>}
                    <span>🕐 {format(new Date(props.timestamp), 'MMM d, HH:mm:ss')}</span>
                </div>
            </div>
        </div>
    );
}
