// ChatUsageMeter — monthly token usage with color-coded bar
import clsx from 'clsx';

interface Props {
    used: number;
    limit: number;
    resetsAt?: string;
    compact?: boolean;
}

export default function ChatUsageMeter({ used, limit, resetsAt, compact = false }: Props) {
    const pct = Math.min(100, Math.round((used / limit) * 100));
    const color = pct < 70 ? 'bg-green-500' : pct < 90 ? 'bg-amber-500' : 'bg-red-500';
    const textColor = pct < 70 ? 'text-green-400' : pct < 90 ? 'text-amber-400' : 'text-red-400';

    if (compact) {
        return (
            <div className='flex items-center gap-2'>
                <div className='flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden'>
                    <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
                </div>
                <span className={clsx('text-xs font-medium tabular-nums', textColor)}>{pct}%</span>
            </div>
        );
    }

    return (
        <div className='glass rounded-xl p-4 border border-slate-700/50'>
            <div className='flex items-center justify-between mb-2'>
                <span className='text-sm font-medium text-slate-200'>Monthly AI Usage</span>
                <span className={clsx('text-xs font-semibold tabular-nums', textColor)}>{pct}%</span>
            </div>
            <div className='h-2 bg-slate-700 rounded-full overflow-hidden mb-2'>
                <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
            </div>
            <div className='flex justify-between text-xs text-slate-500'>
                <span>{used.toLocaleString()} tokens used</span>
                <span>{limit.toLocaleString()} limit</span>
            </div>
            {resetsAt && (
                <p className='text-xs text-slate-500 mt-1.5'>Resets on {resetsAt}</p>
            )}
            {pct >= 90 && (
                <p className='text-xs text-red-400 mt-2 font-medium'>⚠️ Approaching monthly limit — queries may be throttled</p>
            )}
        </div>
    );
}
