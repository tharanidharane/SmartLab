/**
 * Usage Logs — Real-time usage log feed (polls every 30s)
 * For Lab Assistants & Lab Incharge
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { useAuthStore } from '../../store';

interface UsageEvent {
    eventType: string;
    bookingId: string;
    equipmentName: string;
    userName?: string;
    userEmail?: string;
    timestamp: string;
    status?: string;
}

const statusMeta: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    APPROVED: { color: '#22c55e', icon: 'checkmark-circle' },
    REJECTED: { color: '#ef4444', icon: 'close-circle' },
    PENDING: { color: '#f59e0b', icon: 'time' },
    COMPLETED: { color: '#3b82f6', icon: 'checkmark-done-circle' },
    CANCELLED: { color: '#64748b', icon: 'ban' },
    WAITLISTED: { color: '#a855f7', icon: 'hourglass' },
};

const eventIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    BOOKING_STATUS_CHANGED: 'swap-horizontal-outline',
    BOOKING_CREATED: 'add-circle-outline',
    CHECK_IN: 'log-in-outline',
    CHECK_OUT: 'log-out-outline',
};

export default function UsageLogsScreen() {
    const { user } = useAuthStore();
    const [logs, setLogs] = useState<UsageEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isStaff = user?.role === 'LabAssistant' || user?.role === 'LabIncharge';

    const loadLogs = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/analytics/audit-logs?eventType=BOOKING_STATUS_CHANGED&limit=30');
            setLogs(res.data.logs ?? []);
        } catch { }
        finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadLogs();
        intervalRef.current = setInterval(() => loadLogs(true), 30_000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [loadLogs]);

    if (!isStaff) {
        return (
            <View style={styles.center}>
                <View style={styles.lockCircle}>
                    <Ionicons name='lock-closed' size={28} color='#64748b' />
                </View>
                <Text style={styles.title}>Staff Only</Text>
                <Text style={styles.subtitle}>Usage logs are available for Lab Assistants and Lab In-charges.</Text>
            </View>
        );
    }

    const formatTime = (ts: string) => {
        try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
        catch { return ts; }
    };
    const formatDate = (ts: string) => {
        try { return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }); }
        catch { return ''; }
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.header}>Real-time Usage</Text>
                    <View style={styles.liveRow}>
                        <View style={styles.liveDot} />
                        <Text style={styles.hint}>Live · refreshes every 30s</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => loadLogs()} style={styles.refreshBtn} activeOpacity={0.7}>
                    <Ionicons name='refresh' size={18} color='#818cf8' />
                </TouchableOpacity>
            </View>

            {loading && logs.length === 0 ? (
                <ActivityIndicator color='#818cf8' size='large' style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={logs}
                    keyExtractor={(_, i) => i.toString()}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLogs(); }}
                            tintColor='#818cf8' />
                    }
                    renderItem={({ item }) => {
                        const sMeta = item.status ? statusMeta[item.status] : null;
                        const evIcon = eventIcons[item.eventType] ?? 'pulse-outline';
                        return (
                            <View style={styles.card}>
                                <View style={styles.cardRow}>
                                    <View style={[styles.eventIconCircle, { backgroundColor: (sMeta?.color ?? '#818cf8') + '20' }]}>
                                        <Ionicons name={evIcon} size={18} color={sMeta?.color ?? '#818cf8'} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.equipName}>{item.equipmentName}</Text>
                                        <View style={styles.detailRow}>
                                            <Ionicons name='person-outline' size={11} color='#475569' />
                                            <Text style={styles.detail}>{item.userName ?? item.userEmail ?? item.bookingId}</Text>
                                        </View>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
                                        <Text style={styles.date}>{formatDate(item.timestamp)}</Text>
                                    </View>
                                </View>
                                {item.status && sMeta && (
                                    <View style={[styles.statusBadge, { backgroundColor: sMeta.color + '18' }]}>
                                        <Ionicons name={sMeta.icon} size={12} color={sMeta.color} />
                                        <Text style={[styles.statusText, { color: sMeta.color }]}>
                                            {item.status}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name='pulse-outline' size={32} color='#475569' />
                            </View>
                            <Text style={styles.emptyTitle}>No usage events yet</Text>
                            <Text style={styles.emptyText}>Events will appear here as bookings are processed.</Text>
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
    lockCircle: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center',
        marginBottom: 16, borderWidth: 1, borderColor: '#334155',
    },
    title: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    header: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
    liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
    hint: { fontSize: 12, color: '#64748b' },
    refreshBtn: {
        width: 40, height: 40, backgroundColor: '#1e293b', borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: '#334155',
    },
    card: {
        backgroundColor: '#1e293b', borderRadius: 14, padding: 14,
        marginBottom: 10, borderWidth: 1, borderColor: '#334155',
    },
    cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    eventIconCircle: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    equipName: { fontSize: 14, fontWeight: '700', color: '#f8fafc' },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    detail: { fontSize: 12, color: '#64748b' },
    time: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
    date: { fontSize: 10, color: '#64748b', marginTop: 1 },
    statusBadge: {
        alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 8,
    },
    statusText: { fontSize: 11, fontWeight: '700' },
    emptyContainer: { alignItems: 'center', paddingTop: 60 },
    emptyIconCircle: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center',
        marginBottom: 16, borderWidth: 1, borderColor: '#334155',
    },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: '#f8fafc', marginTop: 4 },
    emptyText: { fontSize: 13, color: '#64748b', marginTop: 4 },
});
