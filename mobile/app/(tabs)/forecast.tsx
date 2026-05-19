/**
 * ML Forecasting — Trigger forecast jobs & view results (Lab Incharge only)
 * Matches web LabInchargeDashboard forecast tab
 */
import { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import api from '../../lib/api';
import { useAuthStore } from '../../store';

interface ForecastItem {
    equipmentId: string;
    equipmentName: string;
    date: string;
    predictedBookings: number;
    lower?: number;
    upper?: number;
}

interface UtilizationRow {
    equipment_name: string;
    total_bookings: string;
    utilization_rate: string;
}

export default function ForecastScreen() {
    const { user } = useAuthStore();
    const [forecastData, setForecastData] = useState<ForecastItem[]>([]);
    const [utilization, setUtilization] = useState<UtilizationRow[]>([]);
    const [forecastStatus, setForecastStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const pollingRef = useRef(false);

    const isIncharge = user?.role === 'LabIncharge';

    useEffect(() => {
        const load = async () => {
            try {
                const [fRes, uRes] = await Promise.allSettled([
                    api.get('/analytics/forecast'),
                    api.get('/analytics/utilization?days=30'),
                ]);
                if (fRes.status === 'fulfilled') setForecastData(fRes.value.data.forecastData ?? []);
                if (uRes.status === 'fulfilled') setUtilization(uRes.value.data.utilization ?? []);
            } catch { }
            finally { setLoading(false); }
        };
        load();
    }, []);

    const handleRefreshForecast = async () => {
        if (pollingRef.current) return;
        try {
            setForecastStatus('RUNNING');
            const res = await api.post('/analytics/forecast/refresh');
            const jobId = res.data.jobId;
            pollingRef.current = true;

            // Poll for completion
            for (let i = 0; i < 60; i++) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const statusRes = await api.get(`/analytics/forecast/status/${jobId}`);
                    setForecastStatus(statusRes.data.status);
                    if (statusRes.data.status === 'COMPLETED') {
                        setForecastData(statusRes.data.forecastData ?? []);
                        pollingRef.current = false;
                        return;
                    }
                    if (statusRes.data.status === 'FAILED') {
                        pollingRef.current = false;
                        return;
                    }
                } catch { break; }
            }
            pollingRef.current = false;
        } catch {
            setForecastStatus('FAILED');
            pollingRef.current = false;
        }
    };

    if (!isIncharge) {
        return (
            <View style={styles.center}>
                <Text style={styles.lockIcon}>🔒</Text>
                <Text style={styles.title}>Lab In-charge Only</Text>
                <Text style={styles.subtitle}>ML Forecasting is restricted to Lab In-charges.</Text>
            </View>
        );
    }

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color='#818cf8' /></View>;
    }

    // Group forecast by equipment
    const groupedForecast = forecastData.reduce<Record<string, ForecastItem[]>>((acc, item) => {
        const key = item.equipmentName ?? item.equipmentId;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor='#818cf8' />}>

            <Text style={styles.header}>ML Forecasting</Text>
            <Text style={styles.hint}>Demand prediction & utilization analysis</Text>

            {/* Refresh forecast button */}
            <TouchableOpacity
                style={[styles.refreshBtn, forecastStatus === 'RUNNING' && { opacity: 0.6 }]}
                onPress={handleRefreshForecast}
                disabled={forecastStatus === 'RUNNING'}>
                <Text style={styles.refreshBtnText}>
                    {forecastStatus === 'RUNNING' ? '⏳ Running…' : '🔄 Refresh Forecast'}
                </Text>
            </TouchableOpacity>

            {forecastStatus ? (
                <Text style={[styles.statusText, {
                    color: forecastStatus === 'COMPLETED' ? '#22c55e' : forecastStatus === 'RUNNING' ? '#f59e0b' : '#ef4444'
                }]}>
                    Status: {forecastStatus}
                </Text>
            ) : null}

            {/* Utilization Section */}
            {utilization.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📊 Equipment Utilization (30 Days)</Text>
                    {utilization.map((r, i) => {
                        const rate = parseFloat(r.utilization_rate);
                        const barColor = rate > 70 ? '#ef4444' : rate > 40 ? '#f59e0b' : '#22c55e';
                        return (
                            <View key={i} style={styles.utilRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.utilName} numberOfLines={1}>
                                        {r.equipment_name}
                                    </Text>
                                    <Text style={styles.utilMeta}>{r.total_bookings} bookings</Text>
                                </View>
                                <View style={styles.barContainer}>
                                    <View style={[styles.bar, { width: `${Math.min(rate, 100)}%`, backgroundColor: barColor }]} />
                                </View>
                                <Text style={[styles.utilRate, { color: barColor }]}>{rate.toFixed(0)}%</Text>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Forecast Section */}
            {Object.keys(groupedForecast).length > 0 ? (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔮 Demand Forecast</Text>
                    {Object.entries(groupedForecast).map(([name, items]) => (
                        <View key={name} style={styles.forecastCard}>
                            <Text style={styles.forecastEquip}>{name}</Text>
                            {items.slice(0, 7).map((item, i) => (
                                <View key={i} style={styles.forecastRow}>
                                    <Text style={styles.forecastDate}>{item.date}</Text>
                                    <View style={styles.forecastBarContainer}>
                                        <View style={[styles.forecastBar, { width: `${Math.min(item.predictedBookings * 10, 100)}%` }]} />
                                    </View>
                                    <Text style={styles.forecastValue}>{item.predictedBookings.toFixed(1)}</Text>
                                </View>
                            ))}
                        </View>
                    ))}
                </View>
            ) : (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>🔮</Text>
                    <Text style={styles.emptyText}>No forecast data yet</Text>
                    <Text style={styles.emptySubtext}>Tap "Refresh Forecast" to generate predictions</Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#0f172a' },
    lockIcon: { fontSize: 48, marginBottom: 16 },
    title: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20 },
    header: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
    hint: { fontSize: 12, color: '#64748b', marginTop: 2, marginBottom: 16 },
    refreshBtn: { backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
    refreshBtnText: { color: '#f8fafc', fontWeight: '600', fontSize: 15 },
    statusText: { fontSize: 13, fontWeight: '500', marginBottom: 16 },
    // Sections
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 14 },
    // Utilization
    utilRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
    utilName: { fontSize: 13, color: '#f8fafc', fontWeight: '500' },
    utilMeta: { fontSize: 11, color: '#64748b', marginTop: 1 },
    barContainer: { width: 80, height: 6, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden' },
    bar: { height: 6, borderRadius: 3 },
    utilRate: { fontSize: 13, fontWeight: '700', width: 40, textAlign: 'right' },
    // Forecast
    forecastCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
    forecastEquip: { fontSize: 14, fontWeight: '600', color: '#f8fafc', marginBottom: 10 },
    forecastRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
    forecastDate: { fontSize: 11, color: '#64748b', width: 70 },
    forecastBarContainer: { flex: 1, height: 6, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden' },
    forecastBar: { height: 6, borderRadius: 3, backgroundColor: '#818cf8' },
    forecastValue: { fontSize: 12, color: '#94a3b8', width: 36, textAlign: 'right' },
    // Empty
    emptyContainer: { alignItems: 'center', paddingTop: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyText: { fontSize: 16, fontWeight: '600', color: '#f8fafc' },
    emptySubtext: { fontSize: 13, color: '#64748b', marginTop: 4 },
});
