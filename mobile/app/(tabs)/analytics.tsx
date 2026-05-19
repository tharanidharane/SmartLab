/**
 * Analytics — QuickSight embed + utilization overview (Lab Incharge only)
 * Matches web Analytics page and LabInchargeDashboard analytics tab
 * Note: QuickSight iframe may not render in React Native WebView on all devices.
 * Falls back to showing utilization stats natively.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import api from '../../lib/api';
import { useAuthStore } from '../../store';

interface UtilizationRow {
    equipment_name: string;
    total_bookings: string;
    utilization_rate: string;
}

export default function AnalyticsScreen() {
    const { user } = useAuthStore();
    const [utilization, setUtilization] = useState<UtilizationRow[]>([]);
    const [embedUrl, setEmbedUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isIncharge = user?.role === 'LabIncharge';

    const loadEmbed = useCallback(async () => {
        try {
            const res = await api.get('/analytics/embed-url');
            setEmbedUrl(res.data.embedUrl ?? null);
            // Auto-refresh at 12 min
            const refreshIn = Math.min(res.data.refreshBefore ?? 720, 720) * 1000;
            refreshTimer.current = setTimeout(loadEmbed, refreshIn);
        } catch { }
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get('/analytics/utilization?days=30');
                setUtilization(res.data.utilization ?? []);
            } catch { }
            finally { setLoading(false); }
        };
        load();
        loadEmbed();
        return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
    }, [loadEmbed]);

    if (!isIncharge) {
        return (
            <View style={styles.center}>
                <Text style={styles.lockIcon}>🔒</Text>
                <Text style={styles.title}>Lab In-charge Only</Text>
                <Text style={styles.subtitle}>Analytics is restricted to Lab In-charges.</Text>
            </View>
        );
    }

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color='#818cf8' /></View>;
    }

    // Summary stats
    const totalBookings = utilization.reduce((s, r) => s + parseInt(r.total_bookings || '0'), 0);
    const avgRate = utilization.length > 0
        ? utilization.reduce((s, r) => s + parseFloat(r.utilization_rate || '0'), 0) / utilization.length
        : 0;
    const topEquip = [...utilization].sort((a, b) => parseInt(b.total_bookings) - parseInt(a.total_bookings))[0];

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setLoading(true); }} tintColor='#818cf8' />}>

            <Text style={styles.header}>Analytics</Text>
            <Text style={styles.hint}>Equipment utilization & insights (30 days)</Text>

            {/* Summary Cards */}
            <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryValue}>{totalBookings}</Text>
                    <Text style={styles.summaryLabel}>Total Bookings</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={[styles.summaryValue, { color: avgRate > 50 ? '#f59e0b' : '#22c55e' }]}>
                        {avgRate.toFixed(0)}%
                    </Text>
                    <Text style={styles.summaryLabel}>Avg Utilization</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryValue}>{utilization.length}</Text>
                    <Text style={styles.summaryLabel}>Equipment</Text>
                </View>
            </View>

            {/* Top Equipment */}
            {topEquip && (
                <View style={styles.topCard}>
                    <Text style={styles.topLabel}>🏆 Most Used Equipment</Text>
                    <Text style={styles.topName}>{topEquip.equipment_name}</Text>
                    <Text style={styles.topMeta}>
                        {topEquip.total_bookings} bookings · {parseFloat(topEquip.utilization_rate).toFixed(0)}% utilization
                    </Text>
                </View>
            )}

            {/* Utilization Breakdown */}
            <Text style={styles.sectionTitle}>Equipment Utilization</Text>
            {utilization.length === 0 ? (
                <Text style={styles.empty}>No utilization data available.</Text>
            ) : (
                utilization.map((r, i) => {
                    const rate = parseFloat(r.utilization_rate);
                    const barColor = rate > 70 ? '#ef4444' : rate > 40 ? '#f59e0b' : '#22c55e';
                    return (
                        <View key={i} style={styles.utilCard}>
                            <View style={styles.utilHeader}>
                                <Text style={styles.utilName} numberOfLines={1}>{r.equipment_name}</Text>
                                <Text style={[styles.utilRate, { color: barColor }]}>{rate.toFixed(0)}%</Text>
                            </View>
                            <View style={styles.barBg}>
                                <View style={[styles.barFill, { width: `${Math.min(rate, 100)}%`, backgroundColor: barColor }]} />
                            </View>
                            <Text style={styles.utilBookings}>{r.total_bookings} bookings</Text>
                        </View>
                    );
                })
            )}

            {/* QuickSight link */}
            {embedUrl && (
                <TouchableOpacity style={styles.quicksightBtn} onPress={() => Linking.openURL(embedUrl)}>
                    <Text style={styles.quicksightBtnText}>📊 Open Full QuickSight Dashboard</Text>
                    <Text style={styles.quicksightHint}>Opens in browser · Auto-refreshes every 12 min</Text>
                </TouchableOpacity>
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
    // Summary
    summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    summaryCard: { flex: 1, backgroundColor: '#1e293b', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
    summaryValue: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
    summaryLabel: { fontSize: 10, color: '#64748b', marginTop: 4 },
    // Top equipment
    topCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#4f46e540' },
    topLabel: { fontSize: 13, color: '#818cf8', fontWeight: '600', marginBottom: 6 },
    topName: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
    topMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
    // Section
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 14 },
    // Utilization cards
    utilCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
    utilHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    utilName: { fontSize: 13, fontWeight: '600', color: '#f8fafc', flex: 1 },
    utilRate: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
    barBg: { height: 6, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
    barFill: { height: 6, borderRadius: 3 },
    utilBookings: { fontSize: 11, color: '#64748b' },
    // QuickSight
    quicksightBtn: { backgroundColor: '#1e293b', borderRadius: 14, padding: 18, marginTop: 12, borderWidth: 1, borderColor: '#4f46e540', alignItems: 'center' },
    quicksightBtnText: { fontSize: 15, fontWeight: '600', color: '#818cf8' },
    quicksightHint: { fontSize: 11, color: '#64748b', marginTop: 4 },
    empty: { textAlign: 'center', color: '#64748b', marginTop: 20 },
});
