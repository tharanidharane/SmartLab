/**
 * Audit Logs — View system audit logs with search (Lab Incharge only)
 * Matches web LabInchargeDashboard audit tab
 */
import { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import api from '../../lib/api';
import { useAuthStore } from '../../store';

interface AuditLog {
    logId?: string;
    eventType: string;
    userId?: string;
    userEmail?: string;
    userName?: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    details?: string;
    timestamp: string;
    ipAddress?: string;
}

const eventIcons: Record<string, string> = {
    BOOKING_CREATED: '📅',
    BOOKING_STATUS_CHANGED: '🔄',
    BOOKING_CANCELLED: '❌',
    EQUIPMENT_CREATED: '🔬',
    EQUIPMENT_UPDATED: '✏️',
    EQUIPMENT_DELETED: '🗑',
    USER_LOGIN: '🔑',
    USER_REGISTER: '👤',
    ROLE_CHANGED: '🎭',
};

export default function AuditLogsScreen() {
    const { user } = useAuthStore();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('');

    const isIncharge = user?.role === 'LabIncharge';

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/analytics/audit-logs?limit=50');
            setLogs(res.data.logs ?? []);
        } catch { }
        finally { setLoading(false); setRefreshing(false); }
    };

    useEffect(() => { load(); }, []);

    if (!isIncharge) {
        return (
            <View style={styles.center}>
                <Text style={styles.lockIcon}>🔒</Text>
                <Text style={styles.title}>Lab In-charge Only</Text>
                <Text style={styles.subtitle}>Audit logs are restricted to Lab In-charges.</Text>
            </View>
        );
    }

    const filtered = filter
        ? logs.filter(l => JSON.stringify(l).toLowerCase().includes(filter.toLowerCase()))
        : logs;

    const formatTime = (ts: string) => {
        try {
            const d = new Date(ts);
            return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } catch { return ts; }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Audit Logs</Text>
            <Text style={styles.hint}>System activity log</Text>

            <TextInput style={styles.search} value={filter} onChangeText={setFilter}
                placeholder='Filter by event type or user…' placeholderTextColor='#64748b' />

            {loading && logs.length === 0 ? (
                <ActivityIndicator color='#818cf8' style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item, i) => item.logId ?? i.toString()}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
                            tintColor='#818cf8' />
                    }
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <View style={styles.cardRow}>
                                <Text style={styles.icon}>
                                    {eventIcons[item.eventType] ?? '📋'}
                                </Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.eventType}>
                                        {item.eventType?.replace(/_/g, ' ') ?? item.action ?? 'Unknown'}
                                    </Text>
                                    <Text style={styles.userInfo}>
                                        {item.userName ?? item.userEmail ?? item.userId ?? '—'}
                                    </Text>
                                    {item.resourceType && (
                                        <Text style={styles.resource}>
                                            {item.resourceType} · {item.resourceId?.slice(0, 8)}…
                                        </Text>
                                    )}
                                    {item.details && (
                                        <Text style={styles.details} numberOfLines={2}>{item.details}</Text>
                                    )}
                                </View>
                                <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <Text style={styles.empty}>No audit logs found.</Text>
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
    hint: { fontSize: 12, color: '#64748b', marginTop: 2, marginBottom: 12 },
    search: { backgroundColor: '#1e293b', borderRadius: 14, borderWidth: 1, borderColor: '#334155', color: '#f8fafc', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 14, fontSize: 14 },
    card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
    cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    icon: { fontSize: 18, marginTop: 2 },
    eventType: { fontSize: 13, fontWeight: '600', color: '#f8fafc', textTransform: 'capitalize' },
    userInfo: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    resource: { fontSize: 11, color: '#64748b', marginTop: 2 },
    details: { fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 16 },
    time: { fontSize: 11, color: '#64748b', flexShrink: 0 },
    empty: { textAlign: 'center', color: '#64748b', marginTop: 40 },
});
