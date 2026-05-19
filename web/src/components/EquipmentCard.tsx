// EquipmentCard — gradient accent + availability ring indicator
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Equipment } from '../store';

interface Props { equipment: Equipment; }

const STATUS_GRADIENT: Record<string, string> = {
    AVAILABLE: 'from-indigo-900/40 to-slate-800/60',
    UNDER_MAINTENANCE: 'from-amber-900/40 to-slate-800/60',
    RETIRED: 'from-slate-900/60 to-slate-800/60',
};

const RING_COLOR: Record<string, string> = {
    AVAILABLE: 'ring-green-500/60',
    UNDER_MAINTENANCE: 'ring-amber-500/60',
    RETIRED: 'ring-slate-600/60',
};

const STATUS_LABEL: Record<string, string> = {
    AVAILABLE: 'Available', UNDER_MAINTENANCE: 'Maintenance', RETIRED: 'Retired',
};

export default function EquipmentCard({ equipment: e }: Props) {
    const navigate = useNavigate();
    const available = e.status === 'AVAILABLE';

    return (
        <div className={clsx(
            'glass rounded-2xl overflow-hidden hover-lift border border-slate-700/50 flex flex-col',
            !available && 'opacity-80'
        )}>
            {/* Gradient header with availability ring */}
            <div className={clsx('h-40 bg-gradient-to-br flex items-center justify-center relative', STATUS_GRADIENT[e.status])}>
                <div className={clsx('w-20 h-20 rounded-full ring-4 flex items-center justify-center bg-slate-800/60', RING_COLOR[e.status])}>
                    <span className='text-4xl'>🔬</span>
                </div>
                {/* Ring availability indicator */}
                <div className={clsx(
                    'absolute top-3 right-3 w-3 h-3 rounded-full',
                    available ? 'bg-green-400 animate-pulse' : e.status === 'UNDER_MAINTENANCE' ? 'bg-amber-400' : 'bg-slate-500'
                )} title={STATUS_LABEL[e.status]} />
            </div>

            <div className='p-5 flex flex-col flex-1'>
                <div className='flex items-start justify-between mb-1'>
                    <h3 className='font-semibold text-white text-sm leading-tight flex-1 mr-2'>{e.name}</h3>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full shrink-0', `status-${e.status.toLowerCase().replace('_', '-')}`)}>
                        {STATUS_LABEL[e.status]}
                    </span>
                </div>
                <p className='text-xs text-indigo-400 mb-1'>{e.category}</p>
                <p className='text-xs text-slate-400 mb-1'>📍 {e.location}</p>
                <p className='text-xs text-slate-500 line-clamp-2 flex-1'>{e.description}</p>
                <p className='text-xs text-slate-500 mt-2'>Max {e.maxBookingHours}h · {e.requiresApproval ? 'Approval required' : 'Auto-approved'}</p>

                <button
                    disabled={!available}
                    onClick={() => navigate(`/equipment/${e.equipmentId}/book`)}
                    className={clsx(
                        'mt-4 w-full py-2.5 rounded-xl text-sm font-medium transition-all',
                        available
                            ? 'bg-indigo-600/80 hover:bg-indigo-600 text-white'
                            : 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-700/30'
                    )}>
                    {available ? 'Book Now' : 'Unavailable'}
                </button>
            </div>
        </div>
    );
}
