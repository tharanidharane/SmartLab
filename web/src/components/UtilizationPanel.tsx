// UtilizationPanel — equipment utilization table with staleSince amber banner
import { useState } from 'react';
import clsx from 'clsx';

interface UtilRow {
    equipment_name: string;
    equipment_id: string;
    total_bookings: string;
    utilization_rate: string;
}

interface Props {
    data: UtilRow[];
    staleSince?: string;   // ISO timestamp — show amber banner if present
    isLoading?: boolean;
}

export default function UtilizationPanel({ data, staleSince, isLoading }: Props) {
    const [sortKey, setSortKey] = useState<'name' | 'bookings' | 'rate'>('rate');
    const [desc, setDesc] = useState(true);

    const toggle = (k: typeof sortKey) => { if (sortKey === k) setDesc(d => !d); else { setSortKey(k); setDesc(true); } };

    const sorted = [...data].sort((a, b) => {
        let diff = 0;
        if (sortKey === 'name') diff = a.equipment_name.localeCompare(b.equipment_name);
        if (sortKey === 'bookings') diff = parseInt(a.total_bookings) - parseInt(b.total_bookings);
        if (sortKey === 'rate') diff = parseFloat(a.utilization_rate) - parseFloat(b.utilization_rate);
        return desc ? -diff : diff;
    });

    return (
        <div className='glass rounded-xl border border-slate-700/50 overflow-hidden'>
            {staleSince && (
                <div className='bg-amber-900/30 border-b border-amber-700/40 px-4 py-2 flex items-center gap-2'>
                    <span className='text-amber-400 text-sm'>⚠️</span>
                    <p className='text-amber-300 text-xs'>
                        Data may be stale — last refreshed {new Date(staleSince).toLocaleString()}. Run Glue ETL to update.
                    </p>
                </div>
            )}
            <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                    <thead>
                        <tr className='border-b border-slate-700/50'>
                            {[
                                { k: 'name' as const, label: 'Equipment' },
                                { k: 'bookings' as const, label: 'Bookings' },
                                { k: 'rate' as const, label: 'Utilization %' },
                            ].map(({ k, label }) => (
                                <th key={k}
                                    onClick={() => toggle(k)}
                                    className='px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white select-none'>
                                    {label} {sortKey === k && (desc ? '↓' : '↑')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading
                            ? Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className='border-b border-slate-800/50'>
                                    <td className='px-4 py-3'><div className='h-3 bg-slate-700/60 rounded animate-pulse w-3/4' /></td>
                                    <td className='px-4 py-3'><div className='h-3 bg-slate-700/60 rounded animate-pulse w-12' /></td>
                                    <td className='px-4 py-3'><div className='h-3 bg-slate-700/60 rounded animate-pulse w-16' /></td>
                                </tr>
                            ))
                            : sorted.map(r => {
                                const rate = parseFloat(r.utilization_rate);
                                const barColor = rate > 80 ? 'bg-red-500' : rate > 50 ? 'bg-amber-500' : 'bg-green-500';
                                return (
                                    <tr key={r.equipment_id} className='border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors'>
                                        <td className='px-4 py-3 text-white font-medium'>{r.equipment_name}</td>
                                        <td className='px-4 py-3 text-slate-300 tabular-nums'>{r.total_bookings}</td>
                                        <td className='px-4 py-3'>
                                            <div className='flex items-center gap-2'>
                                                <div className='flex-1 h-1.5 bg-slate-700 rounded-full max-w-24'>
                                                    <div className={clsx('h-full rounded-full', barColor)} style={{ width: `${Math.min(100, rate)}%` }} />
                                                </div>
                                                <span className='text-xs tabular-nums text-slate-300 w-10'>{rate.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        }
                    </tbody>
                </table>
                {!isLoading && data.length === 0 && (
                    <p className='text-center text-slate-500 py-8 text-sm'>No utilization data. Run Glue ETL first.</p>
                )}
            </div>
        </div>
    );
}
