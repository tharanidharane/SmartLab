// StatCard with Recharts sparkline mini-chart
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';

interface Props {
    label: string;
    value: string | number;
    delta?: string;         // e.g. "+12% vs last week"
    trend?: 'up' | 'down' | 'neutral';
    sparkline?: number[];   // last N data points
    accentColor?: string;
    className?: string;
}

export default function StatCard({ label, value, delta, trend, sparkline, accentColor = '#4f46e5', className }: Props) {
    const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400';
    const sparkData = (sparkline ?? []).map(v => ({ v }));

    return (
        <div className={clsx('glass rounded-xl p-5 border border-slate-700/50 hover-lift', className)}>
            <div className='flex items-start justify-between'>
                <div>
                    <p className='text-xs text-slate-400 font-medium uppercase tracking-wider mb-1'>{label}</p>
                    <p className='text-2xl font-bold text-white'>{value}</p>
                    {delta && <p className={clsx('text-xs mt-1', trendColor)}>{delta}</p>}
                </div>
                {sparkData.length > 1 && (
                    <div className='w-20 h-12'>
                        <ResponsiveContainer width='100%' height='100%'>
                            <LineChart data={sparkData}>
                                <Line type='monotone' dataKey='v' stroke={accentColor} dot={false} strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
