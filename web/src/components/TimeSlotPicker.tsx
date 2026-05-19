// TimeSlotPicker — visual 30-min (or 1hr) slot grid
import clsx from 'clsx';

export interface TimeSlot {
    startTime: string;
    endTime: string;
    available: boolean;
    label?: string;  // optional short label e.g. "9 AM"
}

interface Props {
    slots: TimeSlot[];
    selected: TimeSlot | null;
    onSelect: (slot: TimeSlot) => void;
    columns?: number;
}

export default function TimeSlotPicker({ slots, selected, onSelect, columns = 4 }: Props) {
    if (!slots.length) {
        return <p className='text-slate-500 text-sm text-center py-4'>No slots available for this date.</p>;
    }

    return (
        <div className={clsx('grid gap-2', {
            'grid-cols-3': columns === 3,
            'grid-cols-4': columns === 4,
            'grid-cols-5': columns === 5,
        })}>
            {slots.map((s) => {
                const isSelected = selected?.startTime === s.startTime && selected?.endTime === s.endTime;
                return (
                    <button
                        key={`${s.startTime}-${s.endTime}`}
                        type='button'
                        disabled={!s.available}
                        onClick={() => onSelect(s)}
                        className={clsx(
                            'py-2.5 px-2 rounded-xl text-xs font-medium text-center transition-all border',
                            {
                                'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30':
                                    isSelected,
                                'bg-slate-800/60 border-slate-600/50 text-slate-300 hover:border-indigo-400 hover:text-white':
                                    s.available && !isSelected,
                                'bg-slate-900/30 border-slate-800/30 text-slate-600 cursor-not-allowed':
                                    !s.available,
                            }
                        )}>
                        <span className='block'>{s.startTime}</span>
                        <span className='block text-[10px] opacity-70'>–{s.endTime}</span>
                        {!s.available && <span className='block text-[9px] opacity-50 mt-0.5'>Booked</span>}
                    </button>
                );
            })}
        </div>
    );
}
