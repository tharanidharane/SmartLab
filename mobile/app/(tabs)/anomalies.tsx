/**
 * Anomaly Detection — View usage anomalies (Lab Incharge only)
 * Matches web LabInchargeDashboard anomalies tab
 */
import { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import api from '../../lib/api';
import { useAuthStore } from '../../store';

interface Anomaly {
    equipmentId: string;
    equipmentName: string;
    zscore: number;
    anomalyDate: string;
    avgBookings: string;
    actualBookings: string;
}

export default function AnomaliesScreen() {
    const { user } = useAuthStore();
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const isIncharge = user?.role === 'LabIncharge';

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/analytics/anomalies?days=30');
            setAnomalies(res.data.anomalies ?? []);
        } catch { }
        finally { setLoading(false); setRefreshing(false); }
    };

    useEffect(() => { load(); }, []);

    if (!isIncharge) {
        return (
            <View style={styles.center}>
                <Text style={styles.lockIcon}>🔒</Text>
                <Text style={styles.title}>Lab In-charge Only</Text>
                <Text style={styles.subtitle}>Anomaly detection is restricted to Lab In-charges.</Text>
            </View>
        );
    }

    // Derive procurement recommendations from high z-score anomalies
    const recommendations = anomalies
        .filter(a => a.zscore > 2)
        .map(a => ({
            name: a.equipmentName,
            reason: `Unusual demand spike (z-score: ${a.zscore.toFixed(1)}) on ${a.anomalyDate}`,
        }));

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Usage Anomalies</Text>
            <Text style={styles.hint}>Last 30 days · Unusual booking patterns</Text>

            {/* Procurement Recommendations */}
            {recommendations.length > 0 && (
                <View style={styles.recsCard}>
                    <Text style={styles.recsTitle}>⚡ Procurement Recommendations</Text>
                    {recommendations.map((r, i) => (
                        <View key={i} style={styles.recItem}>
                            <Text style={styles.recName}>{r.name}</Text>
                            <Text style={styles.recReason}>{r.reason}</Text>
                            <Text style={styles.recAction}>→ Consider purchasing additional units</Text>
                        </View>
                    ))}
                </View>
            )}

            {loading && anomalies.length === 0 ? (
                <ActivityIndicator color='#818cf8' style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={anomalies}
                    keyExtractor={(_, i) => i.toString()}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
                            tintColor='#818cf8' />
                    }
                    renderItem={({ item }) => {
                        const isCritical = item.zscore > 3;
                        return (
                            <View style={[styles.card, { borderColor: isCritical ? '#7f1d1d' : '#78350f' }]}>
                                <View style={styles.cardRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.equipName}>{item.equipmentName}</Text>
                                        <Text style={styles.meta}>Date: {item.anomalyDate}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={[styles.zscore, { color: isCritical ? '#ef4444' : '#f59e0b' }]}>
                                            z = {item.zscore.toFixed(2)}
                                        </Text>
                                        <Text style={styles.comparison}>
                                            {item.actualBookings} actual vs {parseFloat(item.avgBookings).toFixed(1)} avg
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>✓</Text>
                            <Text style={styles.emptyText}>No anomalies detected</Text>
                            <Text style={styles.emptySubtext}>Lab usage is within normal ranges.</Text>
                        </View>
                    }
                />
            )}
        </View>
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
    // Procurement recommendations
    recsCard: { backgroundColor: '#451a0320', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#78350f' },
    recsTitle: { fontSize: 16, fontWeight: '700', color: '#fbbf24', marginBottom: 12 },
    recItem: { backgroundColor: '#78350f20', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#78350f40' },
    recName: { fontSize: 14, fontWeight: '600', color: '#fde68a' },
    recReason: { fontSize: 12, color: '#f59e0b', marginTop: 4, lineHeight: 17 },
    recAction: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
    // Anomaly cards
    card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1 },
    cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
    equipName: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
    meta: { fontSize: 12, color: '#64748b', marginTop: 4 },
    zscore: { fontSize: 18, fontWeight: '700' },
    comparison: { fontSize: 11, color: '#64748b', marginTop: 2 },
    // Empty state
    emptyContainer: { alignItems: 'center', paddingTop: 60 },
    emptyIcon: { fontSize: 40, color: '#22c55e', marginBottom: 12 },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#f8fafc' },
    emptySubtext: { fontSize: 13, color: '#64748b', marginTop: 4 },
});
