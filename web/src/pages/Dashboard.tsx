import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore, useEquipmentStore } from '../store';
import clsx from 'clsx';

interface DashboardStats {
    totalEquipment: number;
    availableEquipment: number;
    myActiveBookings: number;
    pendingApprovals?: number;
}

const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className={`glass rounded-xl p-6 hover-lift border ${color}`}>
        <p className='text-3xl font-bold text-white'>{value}</p>
        <p className='text-sm text-slate-400 mt-1'>{label}</p>
    </div>
);

export default function Dashboard() {
    const { user } = useAuthStore();
    const { equipment, setEquipment } = useEquipmentStore();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recent, setRecent] = useState<unknown[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [eqRes, bkRes] = await Promise.all([
                    api.get('/equipment'),
                    api.get('/bookings?limit=5'),
                ]);
                const items = eqRes.data.items;
                setEquipment(items);
                setRecent(bkRes.data.bookings ?? []);
                setStats({
                    totalEquipment: items.length,
                    availableEquipment: items.filter((e: { status: string }) => e.status === 'AVAILABLE').length,
                    myActiveBookings: (bkRes.data.bookings ?? []).filter((b: { status: string }) =>
                        ['APPROVED', 'PENDING'].includes(b.status)).length,
                });

                if (['LabAssistant', 'LabIncharge'].includes(user?.role ?? '')) {
                    const pRes = await api.get('/bookings/pending');
                    setStats(s => s ? { ...s, pendingApprovals: pRes.data.total } : s);
                }
            } catch (err) {
                console.error('Dashboard load error:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user?.role, setEquipment]);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    if (loading) {
        return (
            <div className='flex items-center justify-center h-64'>
                <div className='w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin' />
            </div>
        );
    }

    return (
        <div className='space-y-8'>
            {/* Header */}
            <div>
                <h1 className='text-2xl font-bold text-white'>{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
                <p className='text-slate-400 mt-1'>Here&apos;s what&apos;s happening in the lab</p>
            </div>

            {/* Stats */}
            <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
                <StatCard label='Total Equipment' value={stats?.totalEquipment ?? 0} color='border-slate-700/50' />
                <StatCard label='Available Now' value={stats?.availableEquipment ?? 0} color='border-green-800/50' />
                {['Student', 'Faculty', 'Researcher'].includes(user?.role ?? '') && (
                    <StatCard label='Active Bookings' value={stats?.myActiveBookings ?? 0} color='border-blue-800/50' />
                )}
                {stats?.pendingApprovals !== undefined && (
                    <StatCard label='Pending Approval' value={stats.pendingApprovals} color='border-yellow-800/50' />
                )}
            </div>

            {/* Quick actions */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                {/* Generic Tools (Students/Researchers) */}
                {['Student', 'Faculty', 'Researcher'].includes(user?.role ?? '') && (
                    <>
                        <Link to='/equipment'
                            className='glass rounded-xl p-6 hover-lift border border-indigo-500/20 text-center'>
                            <div className='w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center mx-auto mb-3'>
                                <span className='text-2xl'>🔬</span>
                            </div>
                            <p className='font-semibold text-white'>Browse Equipment</p>
                            <p className='text-xs text-slate-400 mt-1'>{equipment.filter(e => e.status === 'AVAILABLE').length} available</p>
                        </Link>
                        <Link to='/bookings'
                            className='glass rounded-xl p-6 hover-lift border border-sky-500/20 text-center'>
                            <div className='w-12 h-12 bg-sky-600/20 rounded-xl flex items-center justify-center mx-auto mb-3'>
                                <span className='text-2xl'>📅</span>
                            </div>
                            <p className='font-semibold text-white'>My Bookings</p>
                            <p className='text-xs text-slate-400 mt-1'>View and manage</p>
                        </Link>
                    </>
                )}

                {/* Admin Tools (Lab Assistant) */}
                {user?.role === 'LabAssistant' && (
                    <>
                        <Link to='/approvals'
                            className='glass rounded-xl p-6 hover-lift border border-indigo-500/20 text-center'>
                            <div className='w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center mx-auto mb-3'>
                                <span className='text-2xl'>✅</span>
                            </div>
                            <p className='font-semibold text-white'>Approvals</p>
                            <p className='text-xs text-slate-400 mt-1'>{stats?.pendingApprovals ?? 0} pending review</p>
                        </Link>
                        <Link to='/lab-assistant'
                            className='glass rounded-xl p-6 hover-lift border border-sky-500/20 text-center'>
                            <div className='w-12 h-12 bg-sky-600/20 rounded-xl flex items-center justify-center mx-auto mb-3'>
                                <span className='text-2xl'>🛠️</span>
                            </div>
                            <p className='font-semibold text-white'>Lab Console</p>
                            <p className='text-xs text-slate-400 mt-1'>Manage daily operations</p>
                        </Link>
                    </>
                )}

                {/* Admin Tools (Lab In-charge) */}
                {user?.role === 'LabIncharge' && (
                    <>
                        <Link to='/lab-incharge'
                            className='glass rounded-xl p-6 hover-lift border border-indigo-500/20 text-center'>
                            <div className='w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center mx-auto mb-3'>
                                <span className='text-2xl'>👑</span>
                            </div>
                            <p className='font-semibold text-white'>In-charge Panel</p>
                            <p className='text-xs text-slate-400 mt-1'>Global lab metrics</p>
                        </Link>
                        <Link to='/analytics'
                            className='glass rounded-xl p-6 hover-lift border border-sky-500/20 text-center'>
                            <div className='w-12 h-12 bg-sky-600/20 rounded-xl flex items-center justify-center mx-auto mb-3'>
                                <span className='text-2xl'>📈</span>
                            </div>
                            <p className='font-semibold text-white'>Analytics</p>
                            <p className='text-xs text-slate-400 mt-1'>Forecast & Utilization</p>
                        </Link>
                    </>
                )}

                {/* Universal Tool */}
                <Link to='/genai'
                    className='glass rounded-xl p-6 hover-lift border border-purple-500/20 text-center'>
                    <div className='w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center mx-auto mb-3'>
                        <span className='text-2xl'>✨</span>
                    </div>
                    <p className='font-semibold text-white'>AI Assistant</p>
                    <p className='text-xs text-slate-400 mt-1'>Lab intelligence</p>
                </Link>
            </div>

            {/* Recent bookings - Only show to Students/Faculty as it queries their personal bookings */}
            {['Student', 'Faculty', 'Researcher'].includes(user?.role ?? '') && recent.length > 0 && (
                <div>
                    <h2 className='text-lg font-semibold text-white mb-4'>Recent Activity</h2>
                    <div className='space-y-3'>
                        {(recent as Array<{
                            bookingId: string;
                            equipmentName: string;
                            status: string;
                            slot?: { date: string; startTime: string; endTime: string };
                        }>).map((b) => (
                            <div key={b.bookingId} className='glass rounded-xl px-4 py-3 flex items-center justify-between'>
                                <div>
                                    <p className='text-white font-medium text-sm'>{b.equipmentName}</p>
                                    <p className='text-slate-400 text-xs'>{b.slot?.date} · {b.slot?.startTime}–{b.slot?.endTime}</p>
                                </div>
                                <span className={clsx('text-xs px-2 py-1 rounded-full', `status-${b.status.toLowerCase()}`)}>
                                    {b.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
