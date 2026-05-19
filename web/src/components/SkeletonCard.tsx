// SkeletonCard — pulse loading placeholder for equipment and booking cards
import clsx from 'clsx';

interface Props { className?: string; rows?: number; }

export default function SkeletonCard({ className, rows = 3 }: Props) {
    return (
        <div className={clsx('glass rounded-2xl p-5 border border-slate-700/50 animate-pulse', className)}>
            <div className='flex items-start gap-3 mb-4'>
                <div className='w-10 h-10 bg-slate-700/60 rounded-xl' />
                <div className='flex-1 space-y-2'>
                    <div className='h-4 bg-slate-700/60 rounded w-3/4' />
                    <div className='h-3 bg-slate-700/40 rounded w-1/2' />
                </div>
                <div className='w-16 h-6 bg-slate-700/60 rounded-full' />
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className={clsx('h-3 bg-slate-700/40 rounded mb-2', i === rows - 1 ? 'w-2/3' : 'w-full')} />
            ))}
            <div className='mt-4 h-9 bg-slate-700/60 rounded-xl' />
        </div>
    );
}
