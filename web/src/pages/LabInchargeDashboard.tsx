/**
 * Lab In-charge Dashboard — all 8 plan features:
 * 1. Equipment Manager (Add/Edit/Delete modal)
 * 2. ML Forecasting (ForecastChart + equipment selector)
 * 3. Procurement Recommendations (auto-generated from anomalies + forecast)
 * 4. Anomaly detection alerts
 * 5. Audit Logs viewer with filters
 * 6. User Management panel (view users, change role, activate/deactivate)
 * 7. QuickSight iframe with 12-min auto-refresh
 * 8. GenAI ChatWidget (floating)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import ForecastChart from '../components/ForecastChart';
import AuditLogRow from '../components/AuditLogRow';
import UtilizationPanel from '../components/UtilizationPanel';
import ChatWidget from '../components/ChatWidget';
import StatCard from '../components/StatCard';
import clsx from 'clsx';

// ── Types ────────────────────────────────────────────────────────────
interface Equipment {
    equipmentId: string;
    name: string;
    category: string;
    location: string;
    status: string;
    description: string;
    maxBookingHours: number;
    requiresApproval: boolean;
    specifications?: Record<string, string>;
}

interface Anomaly {
    equipmentId: string;
    equipmentName: string;
    zscore: number;
    anomalyDate: string;
    avgBookings: string;
    actualBookings: string;
}

interface UserRecord {
    userId: string;
    email: string;
    name: string;
    role: string;
    department: string;
    status: string;
}

type Tab = 'overview' | 'equipment' | 'forecast' | 'anomalies' | 'audit' | 'users' | 'analytics';

// ── Equipment Modal ──────────────────────────────────────────────────
function EquipmentModal({
    equipment, onClose, onSave,
}: {
    equipment: Partial<Equipment> | null;
    onClose: () => void;
    onSave: (e: Equipment) => void;
}) {
    const isNew = !equipment?.equipmentId;
    const [form, setForm] = useState<Partial<Equipment>>(equipment ?? {
        name: '', category: '', location: '', status: 'AVAILABLE',
        description: '', maxBookingHours: 4, requiresApproval: false,
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!form.name?.trim() || !form.category?.trim() || !form.location?.trim() || !form.description?.trim()) {
            toast.error('Name, category, location, and description are required.'); return;
        }
        setSaving(true);
        try {
            const res = isNew
                ? await api.post('/equipment', form)
                : await api.put(`/equipment/${form.equipmentId}`, form);
            onSave(res.data.equipment ?? res.data);
            toast.success(`Equipment ${isNew ? 'created' : 'updated'}.`);
            onClose();
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Failed to save equipment.';
            toast.error(msg);
        }
        finally { setSaving(false); }
    };

    const field = (label: string, key: keyof Equipment, type = 'text', options?: string[]) => (
        <div>
            <label className='block text-xs font-medium text-slate-400 mb-1'>{label}</label>
            {options ? (
                <select value={form[key] as string ?? ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className='w-full px-3 py-2 bg-slate-800 border border-slate-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500'>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            ) : (
                <input type={type} value={form[key] as string ?? ''}
                    onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className='w-full px-3 py-2 bg-slate-800 border border-slate-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500' />
            )}
        </div>
    );

    return (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4'>
            <div className='glass rounded-2xl p-6 w-full max-w-lg border border-slate-600/50 max-h-[90vh] overflow-y-auto'>
                <h2 className='text-lg font-bold text-white mb-5'>{isNew ? 'Add Equipment' : 'Edit Equipment'}</h2>
                <div className='space-y-4'>
                    {field('Name *', 'name')}
                    {field('Category *', 'category')}
                    {field('Location *', 'location')}
                    {field('Description *', 'description')}
                    {field('Status', 'status', 'text', ['AVAILABLE', 'UNDER_MAINTENANCE', 'RETIRED'])}
                    {field('Max Booking Hours', 'maxBookingHours', 'number')}
                    <div>
                        <label className='flex items-center gap-2 cursor-pointer'>
                            <input type='checkbox' checked={!!form.requiresApproval}
                                onChange={e => setForm(f => ({ ...f, requiresApproval: e.target.checked }))}
                                className='rounded border-slate-600 bg-slate-800' />
                            <span className='text-sm text-slate-300'>Requires approval</span>
                        </label>
                    </div>
                </div>
                <div className='flex gap-3 mt-6'>
                    <button onClick={onClose} className='flex-1 py-2.5 text-sm text-slate-300 border border-slate-600/50 rounded-xl hover:bg-slate-700/50 transition-all'>Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                        className='flex-1 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-50'>
                        {saving ? 'Saving…' : isNew ? 'Create' : 'Update'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Dashboard ────────────────────────────────────────────────────
export default function LabInchargeDashboard() {
    const [tab, setTab] = useState<Tab>('overview');
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [auditLogs, setAuditLogs] = useState<unknown[]>([]);
    const [auditFilter, setAuditFilter] = useState('');
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [usersLoaded, setUsersLoaded] = useState(false);
    const [forecastData, setForecastData] = useState<unknown[]>([]);
    const [forecastEquipId, setForecastEquipId] = useState('');
    const [forecastJobId, setForecastJobId] = useState<string | null>(null);
    const [forecastStatus, setForecastStatus] = useState<string>('');
    const [utilization, setUtilization] = useState<unknown[]>([]);
    const [embedUrl, setEmbedUrl] = useState<string | null>(null);
    const [embedError, setEmbedError] = useState<string | null>(null);
    const [embedLoading, setEmbedLoading] = useState(false);
    const [editingEquip, setEditingEquip] = useState<Partial<Equipment> | null | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const embedRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Data loading ────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            // Equipment loads independently — analytics failures must NOT block it
            try {
                const eqRes = await api.get('/equipment');
                setEquipment(eqRes.data.items ?? []);
            } catch { toast.error('Failed to load equipment.'); }
            finally { setLoading(false); }

            // Analytics calls are best-effort — each failure is isolated
            await Promise.allSettled([
                api.get('/analytics/anomalies?days=30')
                    .then(r => setAnomalies(r.data.anomalies ?? []))
                    .catch(() => { /* Athena may be unavailable locally */ }),
                api.get('/analytics/audit-logs?limit=50')
                    .then(r => setAuditLogs(r.data.logs ?? []))
                    .catch(() => { }),
                api.get('/analytics/utilization?days=30')
                    .then(r => setUtilization(r.data.utilization ?? []))
                    .catch(() => { }),
            ]);
        };
        init();
    }, []);

    // ── QuickSight embed with 12-min auto-refresh ────────────────────
    const loadEmbed = useCallback(async () => {
        setEmbedLoading(true);
        setEmbedError(null);
        try {
            const res = await api.get('/analytics/embed-url');
            // Handle graceful "unavailable" response from backend
            if (res.data.unavailable) {
                setEmbedError(res.data.message || 'QuickSight analytics is not available in this environment.');
                setEmbedUrl(null);
            } else if (res.data.embedUrl) {
                setEmbedUrl(res.data.embedUrl);
                // 12 min = 720s (plan specifies 12-min refresh for In-charge)
                const refreshIn = Math.min(res.data.refreshBefore ?? 720, 720) * 1000;
                embedRefreshTimer.current = setTimeout(loadEmbed, refreshIn);
            } else {
                setEmbedError('No dashboard URL received from the server.');
            }
        } catch {
            setEmbedError('QuickSight analytics dashboard is not configured or the endpoint is unavailable. Use the Analytics tab for utilization data instead.');
            setEmbedUrl(null);
        } finally {
            setEmbedLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tab === 'analytics') loadEmbed();
        return () => { if (embedRefreshTimer.current) clearTimeout(embedRefreshTimer.current); };
    }, [tab, loadEmbed]);

    // ── Users tab lazy load ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (tab === 'users' && !usersLoaded) {
            setUsersLoading(true);
            setUsersError(null);
            api.get('/users')
                .then(res => {
                    setUsers(res.data.users);
                    setUsersLoaded(true);
                })
                .catch(err => setUsersError(err.response?.data?.message || 'Failed to load users.'))
                .finally(() => setUsersLoading(false));
        }
    }, [tab, usersLoaded]);

    // ── Forecast ────────────────────────────────────────────────────────
    const handleForecastRefresh = async () => {
        try {
            const res = await api.post('/analytics/forecast/refresh');
            setForecastJobId(res.data.jobId);
            setForecastStatus('RUNNING');
            toast.success('Forecast job started. Polling for completion…');
            pollForecast(res.data.jobId);
        } catch { toast.error('Failed to start forecast.'); }
    };

    const pollForecast = async (jobId: string) => {
        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 5000));
            try {
                const res = await api.get(`/analytics/forecast/status/${jobId}`);
                setForecastStatus(res.data.status);
                if (res.data.status === 'COMPLETED') {
                    setForecastData(res.data.forecastData ?? []);
                    toast.success('Forecast ready!');
                    return;
                }
                if (res.data.status === 'FAILED') {
                    toast.error(`Forecast failed: ${res.data.reason ?? 'Unknown error'}`);
                    return;
                }
            } catch { break; }
        }
    };

    // ── Equipment actions ────────────────────────────────────────────────
    const handleDelete = async (e: Equipment) => {
        if (!confirm(`Soft-delete "${e.name}"? It will be moved to RETIRED status.`)) return;
        try {
            await api.delete(`/equipment/${e.equipmentId}`);
            setEquipment(eq => eq.map(i => i.equipmentId === e.equipmentId ? { ...i, status: 'RETIRED' } : i));
            toast.success('Equipment retired.');
        } catch { toast.error('Failed to retire equipment.'); }
    };

    // ── User role change ─────────────────────────────────────────────────
    const handleRoleChange = async (user: UserRecord, newRole: string) => {
        try {
            await api.put(`/users/${user.userId}/role`, { role: newRole });
            setUsers(u => u.map(x => x.userId === user.userId ? { ...x, role: newRole } : x));
            toast.success(`Role updated to ${newRole}.`);
        } catch { toast.error('Failed to update role.'); }
    };

    // ── Procurement recommendations (derived from anomalies + forecast) ──
    const recommendations = anomalies
        .filter(a => a.zscore > 2)
        .map(a => ({
            name: a.equipmentName,
            reason: `Unusual demand spike (z-score: ${a.zscore.toFixed(1)}) on ${a.anomalyDate}`,
            action: 'Consider purchasing additional units or increasing availability hours',
        }));

    const tabs: { id: Tab; label: string; count?: number }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'equipment', label: 'Equipment', count: equipment.length },
        { id: 'forecast', label: 'Forecast' },
        { id: 'anomalies', label: 'Anomalies', count: anomalies.length },
        { id: 'audit', label: 'Audit Logs' },
        { id: 'users', label: 'Users' },
        { id: 'analytics', label: 'QuickSight' }
    ];

    if (loading) return (
        <div className='flex items-center justify-center h-64'>
            <div className='w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin' />
        </div>
    );

    return (
        <div className='space-y-6'>
            <div className='flex items-center justify-between'>
                <h1 className='text-2xl font-bold text-white'>Lab In-charge Dashboard</h1>
                <span className='text-xs text-slate-500'>Full access</span>
            </div>

            {/* Tab bar */}
            <div className='flex gap-1 overflow-x-auto pb-1'>
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={clsx('px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5', {
                            'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30': tab === t.id,
                            'text-slate-400 hover:text-white hover:bg-slate-700/50': tab !== t.id,
                        })}>
                        {t.label}
                        {t.count !== undefined && (
                            <span className='text-xs bg-slate-700 text-slate-300 rounded-full px-1.5 py-0.5'>{t.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Overview ─────────────────────────────────────────────────── */}
            {tab === 'overview' && (
                <div className='space-y-6'>
                    <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
                        <StatCard label='Total Equipment' value={equipment.length} accentColor='#4f46e5' />
                        <StatCard label='Available' value={equipment.filter(e => e.status === 'AVAILABLE').length} accentColor='#22c55e' />
                        <StatCard label='Anomalies (30d)' value={anomalies.length} accentColor='#f59e0b' />
                        <StatCard label='Procurement Recs' value={recommendations.length} accentColor='#ef4444' />
                    </div>

                    {/* Procurement Recommendations */}
                    {recommendations.length > 0 && (
                        <div className='glass rounded-xl p-6 border border-amber-800/30'>
                            <h2 className='text-lg font-semibold text-white mb-4'>⚡ Procurement Recommendations</h2>
                            <div className='space-y-3'>
                                {recommendations.map((r, i) => (
                                    <div key={i} className='bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3'>
                                        <p className='text-sm font-medium text-amber-200'>{r.name}</p>
                                        <p className='text-xs text-amber-400/80 mt-1'>{r.reason}</p>
                                        <p className='text-xs text-slate-400 mt-1'>→ {r.action}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <UtilizationPanel data={utilization as Parameters<typeof UtilizationPanel>[0]['data']} />
                </div>
            )}

            {/* ── Equipment Manager ─────────────────────────────────────────── */}
            {tab === 'equipment' && (
                <div className='space-y-4'>
                    <div className='flex justify-end'>
                        <button onClick={() => setEditingEquip({})}
                            className='px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-500 transition-all'>
                            + Add Equipment
                        </button>
                    </div>
                    <div className='space-y-3'>
                        {equipment.map(e => (
                            <div key={e.equipmentId} className='glass rounded-xl px-5 py-4 flex items-center justify-between border border-slate-700/50'>
                                <div>
                                    <p className='font-medium text-white'>{e.name}</p>
                                    <p className='text-xs text-slate-400'>{e.category} · {e.location}</p>
                                    <span className={clsx('text-xs px-2 py-0.5 rounded-full mt-1 inline-block',
                                        `status-${e.status.toLowerCase().replace('_', '-')}`)}>
                                        {e.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className='flex gap-2'>
                                    <button onClick={() => setEditingEquip(e)}
                                        className='px-3 py-1.5 text-xs border border-slate-600/50 text-slate-300 rounded-lg hover:bg-slate-700/50 transition-all'>
                                        Edit
                                    </button>
                                    <button onClick={() => handleDelete(e)}
                                        disabled={e.status === 'RETIRED'}
                                        className='px-3 py-1.5 text-xs border border-red-800/50 text-red-400 rounded-lg hover:bg-red-900/20 transition-all disabled:opacity-40'>
                                        Retire
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {editingEquip !== undefined && (
                        <EquipmentModal
                            equipment={editingEquip}
                            onClose={() => setEditingEquip(undefined)}
                            onSave={(e) => {
                                setEquipment(eq => {
                                    const idx = eq.findIndex(i => i.equipmentId === e.equipmentId);
                                    return idx > -1 ? eq.map((i, ix) => ix === idx ? e : i) : [e, ...eq];
                                });
                                setEditingEquip(undefined);
                            }}
                        />
                    )}
                </div>
            )}

            {/* ── ML Forecast ──────────────────────────────────────────────── */}
            {tab === 'forecast' && (
                <div className='space-y-5'>
                    <div className='flex items-center gap-4 flex-wrap'>
                        <button onClick={handleForecastRefresh} disabled={forecastStatus === 'RUNNING'}
                            className='px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-50'>
                            {forecastStatus === 'RUNNING' ? '⏳ Running…' : '🔄 Refresh Forecast'}
                        </button>
                        {forecastStatus && (
                            <span className={clsx('text-sm', {
                                'text-green-400': forecastStatus === 'COMPLETED',
                                'text-amber-400': forecastStatus === 'RUNNING',
                                'text-red-400': forecastStatus === 'FAILED',
                            })}>
                                Status: {forecastStatus}
                            </span>
                        )}
                        {(forecastData as unknown[]).length > 0 && (
                            <select value={forecastEquipId} onChange={e => setForecastEquipId(e.target.value)}
                                className='px-3 py-2 bg-slate-800 border border-slate-600/50 rounded-xl text-slate-300 text-sm focus:outline-none'>
                                <option value=''>All equipment</option>
                                {(forecastData as { equipmentId: string; equipmentName: string }[]).map(d => (
                                    <option key={d.equipmentId} value={d.equipmentId}>{d.equipmentName}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className='glass rounded-xl p-6 border border-slate-700/50'>
                        <ForecastChart
                            data={forecastData as Parameters<typeof ForecastChart>[0]['data']}
                            selectedEquipmentId={forecastEquipId || undefined}
                        />
                    </div>
                </div>
            )}

            {/* ── Anomalies ────────────────────────────────────────────────── */}
            {tab === 'anomalies' && (
                <div className='space-y-4'>
                    <h2 className='text-lg font-semibold text-white'>Usage Anomalies (Last 30 Days)</h2>
                    {anomalies.length === 0
                        ? <p className='text-slate-400 text-center py-8'>No anomalies detected. Lab usage is within normal ranges.</p>
                        : anomalies.map((a, i) => (
                            <div key={i} className={clsx('glass rounded-xl px-5 py-4 border', a.zscore > 3 ? 'border-red-800/50' : 'border-amber-800/50')}>
                                <div className='flex items-center justify-between'>
                                    <div>
                                        <p className='font-medium text-white'>{a.equipmentName}</p>
                                        <p className='text-xs text-slate-400 mt-1'>Date: {a.anomalyDate}</p>
                                    </div>
                                    <div className='text-right'>
                                        <p className={clsx('text-lg font-bold', a.zscore > 3 ? 'text-red-400' : 'text-amber-400')}>
                                            z = {a.zscore.toFixed(2)}
                                        </p>
                                        <p className='text-xs text-slate-500'>
                                            {a.actualBookings} actual vs {parseFloat(a.avgBookings).toFixed(1)} expected
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    }
                </div>
            )}

            {/* ── Audit Logs ────────────────────────────────────────────────── */}
            {tab === 'audit' && (
                <div className='space-y-4'>
                    <input value={auditFilter} onChange={e => setAuditFilter(e.target.value)}
                        placeholder='Filter by event type or user…'
                        className='w-full px-4 py-2.5 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm' />
                    <div className='space-y-2'>
                        {(auditLogs as Parameters<typeof AuditLogRow>[0][])
                            .filter((l) => !auditFilter || JSON.stringify(l).toLowerCase().includes(auditFilter.toLowerCase()))
                            .map((l) => <AuditLogRow key={l.logId} {...l} />)
                        }
                        {auditLogs.length === 0 && (
                            <p className='text-slate-400 text-center py-8'>No audit logs recorded yet.</p>
                        )}
                    </div>
                </div>
            )}

            {/* ── User Management ────────────────────────────────────────────────── */}
            {tab === 'users' && (
                <div className='glass rounded-xl p-6 border border-slate-700/50'>
                    <div className='flex items-center justify-between mb-4'>
                        <h2 className='text-lg font-semibold text-white'>User Management</h2>
                        <button className='btn-secondary text-xs px-3 py-1.5 opacity-50 cursor-not-allowed' disabled>
                            Invite User
                        </button>
                    </div>
                    {usersLoading ? (
                        <div className='flex items-center justify-center p-8'>
                            <div className='w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin' />
                            <span className='ml-3 text-slate-400'>Loading users...</span>
                        </div>
                    ) : usersError ? (
                        <p className='text-rose-400 text-sm p-4 bg-rose-500/10 rounded-lg'>{usersError}</p>
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='w-full text-left border-collapse'>
                                <thead>
                                    <tr className='text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/50'>
                                        <th className='pb-3 font-medium'>Email</th>
                                        <th className='pb-3 font-medium'>Role</th>
                                        <th className='pb-3 font-medium'>Created At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.email} className='border-b border-slate-700/50 last:border-0 hover:bg-white/[0.02] transition-colors'>
                                            <td className='py-3 text-sm text-slate-300 font-medium'>{u.email}</td>
                                            <td className='py-3 text-sm text-slate-300 font-medium'>{u.role}</td>
                                            <td className='py-3 text-sm text-slate-500'>{new Date((u as any).createdAt || Date.now()).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className='py-8 text-center text-slate-500 text-sm'>No users generated.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── QuickSight Analytics ───────────────────────────────────────────── */}
            {tab === 'analytics' && (
                <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                        <h2 className='text-lg font-semibold text-white'>QuickSight Dashboard</h2>
                        <span className='text-xs text-slate-500'>Auto-refreshes every 12 min</span>
                    </div>

                    {embedLoading ? (
                        <div className='flex items-center justify-center p-12 glass rounded-xl border border-slate-700/50'>
                            <div className='w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin' />
                            <span className='ml-3 text-slate-400 text-sm'>Connecting to QuickSight…</span>
                        </div>
                    ) : embedError ? (
                        <div className='glass rounded-xl p-8 border border-slate-700/50 text-center'>
                            <div className='text-5xl mb-4'>📊</div>
                            <p className='text-lg font-semibold text-white mb-2'>QuickSight Not Available</p>
                            <p className='text-sm text-slate-400 max-w-md mx-auto mb-6'>{embedError}</p>
                            <div className='glass rounded-xl p-5 border border-indigo-800/30 max-w-md mx-auto'>
                                <p className='text-sm text-indigo-300 font-medium mb-2'>💡 Alternative Analytics</p>
                                <p className='text-xs text-slate-400'>
                                    You can view utilization data on the <strong>Overview</strong> tab, anomaly detection on the <strong>Anomalies</strong> tab,
                                    and audit history on the <strong>Audit Logs</strong> tab. These features work independently of QuickSight.
                                </p>
                            </div>
                            <div className='mt-6'>
                                <button onClick={loadEmbed} className='btn-primary text-xs py-2 px-4 shadow-lg shadow-indigo-500/20'>
                                    Retry Connection
                                </button>
                            </div>
                        </div>
                    ) : embedUrl ? (
                        <iframe src={embedUrl} width='100%' height='700'
                            className='rounded-xl border border-slate-700/50' title='QuickSight' />
                    ) : (
                        <div className='glass rounded-xl p-8 border border-slate-700/50 text-center'>
                            <div className='text-5xl mb-4'>📊</div>
                            <p className='text-lg font-semibold text-white mb-2'>QuickSight Not Configured</p>
                            <p className='text-sm text-slate-400 max-w-md mx-auto'>
                                The QuickSight dashboard has not been set up for this environment.
                                Use the Overview, Anomalies, and Audit Logs tabs for analytics.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ── ChatWidget (floating) ─────────────────────────────────────── */}
            <ChatWidget context='Lab In-charge analytics and management' />
        </div>
    );
}
