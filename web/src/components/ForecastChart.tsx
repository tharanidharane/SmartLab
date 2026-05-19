// ForecastChart — Recharts AreaChart with upper/lower confidence bands
import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

interface ForecastPoint {
    ds: string;              // date string 'YYYY-MM-DD'
    yhat: number;
    yhat_lower: number;
    yhat_upper: number;
}

interface ForecastSeries {
    equipmentId: string;
    equipmentName: string;
    forecast: ForecastPoint[];
}

interface Props {
    data: ForecastSeries[];
    selectedEquipmentId?: string;
}

const tooltipStyle = { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' };

export default function ForecastChart({ data, selectedEquipmentId }: Props) {
    const series = selectedEquipmentId
        ? data.find(d => d.equipmentId === selectedEquipmentId)
        : data[0];

    if (!series || !series.forecast?.length) {
        return (
            <div className='flex items-center justify-center h-48 text-slate-500 text-sm'>
                No forecast data available. Run a forecast refresh to generate predictions.
            </div>
        );
    }

    const chartData = series.forecast.map(p => ({
        date: p.ds.slice(5),   // 'MM-DD' for readability
        predicted: +p.yhat.toFixed(1),
        lower: +p.yhat_lower.toFixed(1),
        upper: +p.yhat_upper.toFixed(1),
    }));

    return (
        <div>
            <p className='text-sm text-slate-400 mb-4'>
                14-day demand forecast for <span className='text-white font-medium'>{series.equipmentName}</span>
                <span className='text-xs text-slate-500 ml-2'>(shaded band = 95% confidence interval)</span>
            </p>
            <ResponsiveContainer width='100%' height={300}>
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                        <linearGradient id='predGrad' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor='#4f46e5' stopOpacity={0.3} />
                            <stop offset='95%' stopColor='#4f46e5' stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id='confGrad' x1='0' y1='0' x2='0' y2='1'>
                            <stop offset='5%' stopColor='#38bdf8' stopOpacity={0.12} />
                            <stop offset='95%' stopColor='#38bdf8' stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' stroke='#334155' />
                    <XAxis dataKey='date' tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Bookings', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                    {/* Confidence band — upper */}
                    <Area type='monotone' dataKey='upper' stroke='none' fill='url(#confGrad)' name='Upper bound' />
                    {/* Confidence band — lower */}
                    <Area type='monotone' dataKey='lower' stroke='none' fill='#0f172a' name='Lower bound' />
                    {/* Prediction line */}
                    <Area type='monotone' dataKey='predicted' stroke='#4f46e5' fill='url(#predGrad)' strokeWidth={2} name='Predicted bookings' dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
