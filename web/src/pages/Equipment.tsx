import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Equipment, useEquipmentStore, useAuthStore } from '../store';
import clsx from 'clsx';

export default function EquipmentPage() {
    const { equipment, setEquipment } = useEquipmentStore();
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState('AVAILABLE');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const params = new URLSearchParams();
                if (category) params.set('category', category);
                if (status) params.set('status', status);
                if (search) params.set('search', search);
                const res = await api.get(`/equipment?${params}`);
                setEquipment(res.data.items);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [category, status, search, setEquipment]);

    const categories = [...new Set(equipment.map(e => e.category))].filter(Boolean);

    return (
        <div className='space-y-6'>
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                <h1 className='text-2xl font-bold text-white'>Lab Equipment</h1>
                <div className='flex gap-3'>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder='Search equipment…'
                        className='px-4 py-2 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm w-48'
                    />
                    <select value={category} onChange={e => setCategory(e.target.value)}
                        className='px-3 py-2 bg-slate-800/60 border border-slate-600/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:border-indigo-500'>
                        <option value=''>All Categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={status} onChange={e => setStatus(e.target.value)}
                        className='px-3 py-2 bg-slate-800/60 border border-slate-600/50 rounded-xl text-slate-300 text-sm focus:outline-none focus:border-indigo-500'>
                        <option value='AVAILABLE'>Available</option>
                        <option value='UNDER_MAINTENANCE'>Maintenance</option>
                        <option value='RETIRED'>Retired</option>
                        <option value=''>All</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className='flex items-center justify-center h-48'>
                    <div className='w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin' />
                </div>
            ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                    {equipment.map((e: Equipment) => (
                        <div key={e.equipmentId} className='glass rounded-2xl overflow-hidden hover-lift border border-slate-700/50'>
                            <div className='h-40 bg-gradient-to-br from-indigo-900/40 to-slate-800/60 flex items-center justify-center'>
                                <span className='text-5xl'>🔬</span>
                            </div>
                            <div className='p-5'>
                                <div className='flex items-start justify-between mb-2'>
                                    <h3 className='font-semibold text-white'>{e.name}</h3>
                                    <span className={clsx('text-xs px-2 py-1 rounded-full shrink-0', `status-${e.status.toLowerCase().replace('_', '-')}`)}>
                                        {e.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className='text-xs text-indigo-400 mb-2'>{e.category}</p>
                                <p className='text-sm text-slate-400 mb-1'>📍 {e.location}</p>
                                <p className='text-xs text-slate-500 line-clamp-2 mb-4'>{e.description}</p>
                                {user?.role !== 'LabAssistant' && (
                                    <button
                                        disabled={e.status !== 'AVAILABLE'}
                                        onClick={() => navigate(`/equipment/${e.equipmentId}/book`)}
                                        className='w-full py-2.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed'>
                                        {e.status !== 'AVAILABLE' ? 'Not Available' : 'Book Now'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {equipment.length === 0 && (
                        <div className='col-span-3 text-center py-12 text-slate-500'>
                            No equipment found. Try adjusting your filters.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
