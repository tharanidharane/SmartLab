import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface UtilizationRow {
    equipment_name: string;
    total_bookings: string;
    utilization_rate: string;
}

export default function AnalyticsPage() {
    const [utilization, setUtilization] = useState<UtilizationRow[]>([]);
    const [embedUrl, setEmbedUrl] = useState<string | null>(null);
    const [loadingUtil, setLoadingUtil] = useState(true);
    const [loadingEmbed, setLoadingEmbed] = useState(true);
    const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadEmbedUrl = useCallback(async () => {
        try {
            const res = await api.get('/analytics/embed-url');
            setEmbedUrl(res.data.embedUrl);
            // Auto-refresh at refreshBefore (30min = 1800s)
            const refreshIn = (res.data.refreshBefore ?? 1800) * 1000;
            refreshTimer.current = setTimeout(loadEmbedUrl, refreshIn);
        } catch {
            // QuickSight not configured — show empty state silently
        } finally {
            setLoadingEmbed(false);
        }
    }, []);

    useEffect(() => {
        // Load utilization chart — Athena may be unavailable locally, show empty state
        api.get('/analytics/utilization?days=30')
            .then(r => setUtilization(r.data.utilization ?? []))
            .catch(() => { /* No Glue ETL data yet — empty state shown */ })
            .finally(() => setLoadingUtil(false));

        // Load QuickSight embed
        loadEmbedUrl();

        return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
    }, [loadEmbedUrl]);

    const chartData = utilization.map(r => ({
        name: r.equipment_name.length > 20 ? r.equipment_name.slice(0, 20) + '…' : r.equipment_name,
        bookings: parseInt(r.total_bookings),
        rate: parseFloat(r.utilization_rate).toFixed(1),
    }));

    const COLORS = ['#4f46e5', '#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    return (
        <div className='space-y-8'>
            <h1 className='text-2xl font-bold text-white'>Analytics</h1>

            {/* Utilization chart */}
            <div className='glass rounded-xl p-6 border border-slate-700/50'>
                <h2 className='text-lg font-semibold text-white mb-4'>Equipment Utilization (Last 30 Days)</h2>
                {loadingUtil ? (
                    <div className='flex items-center justify-center h-48'>
                        <div className='w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin' />
                    </div>
                ) : chartData.length === 0 ? (
                    <p className='text-slate-400 text-center py-8'>No utilization data yet. Bookings data will appear here once the Glue ETL pipeline has run.</p>
                ) : (
                    <ResponsiveContainer width='100%' height={280}>
                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                            <XAxis dataKey='name' tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-35} textAnchor='end' />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                                formatter={(v, _n, p) => [`${v} bookings (${p.payload.rate}%)`, 'Bookings']}
                            />
                            <Bar dataKey='bookings' radius={[4, 4, 0, 0]}>
                                {chartData.map((_, i) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* QuickSight embed */}
            <div className='glass rounded-xl p-6 border border-slate-700/50'>
                <div className='flex items-center justify-between mb-4'>
                    <h2 className='text-lg font-semibold text-white'>Advanced Dashboard</h2>
                    <span className='text-xs text-slate-400'>Auto-refreshes every 30 min</span>
                </div>
                {loadingEmbed ? (
                    <div className='flex items-center justify-center h-96'>
                        <div className='text-center'>
                            <div className='w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3' />
                            <p className='text-slate-400 text-sm'>Loading QuickSight dashboard…</p>
                        </div>
                    </div>
                ) : embedUrl ? (
                    <iframe src={embedUrl} width='100%' height='600' className='rounded-xl border border-slate-700/50' title='QuickSight Dashboard' />
                ) : (
                    <p className='text-slate-400 text-center py-8'>QuickSight not configured for this environment. Available in the deployed AWS setup.</p>
                )}
            </div>
        </div>
    );
}
