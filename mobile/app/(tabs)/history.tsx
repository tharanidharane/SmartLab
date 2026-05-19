/**
 * History Tab — Rejected, Waitlisted, Completed, Cancelled bookings
 */
import { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, RefreshControl,
    TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../lib/api';
import { useAuthStore } from '../../store';

interface Booking {
    bookingId: string;
    equipmentName: string;
    status: string;
    slot?: { date: string; startTime: string; endTime: string };
    rejectionReason?: string;
    waitlistPosition?: number;
    createdAt?: string;
    userEmail?: string;
}

type Filter = 'REJECTED' | 'WAITLISTED' | 'COMPLETED' | 'CANCELLED';

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; icon: keyof typeof Ionicons.glyphMap }> = {
    REJECTED: { bg: '#450a0a', text: '#fca5a5', dot: '#ef4444', icon: 'close-circle' },
    WAITLISTED: { bg: '#2e1065', text: '#c4b5fd', dot: '#a855f7', icon: 'hourglass' },
    COMPLETED: { bg: '#0c2a1a', text: '#86efac', dot: '#22c55e', icon: 'checkmark-circle' },
    CANCELLED: { bg: '#1e293b', text: '#94a3b8', dot: '#64748b', icon: 'ban' },
};

const FILTER_OPTS: { value: Filter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'REJECTED', label: 'Rejected', icon: 'close-circle-outline' },
    { value: 'WAITLISTED', label: 'Waitlisted', icon: 'hourglass-outline' },
    { value: 'COMPLETED', label: 'Completed', icon: 'checkmark-circle-outline' },
    { value: 'CANCELLED', label: 'Cancelled', icon: 'ban-outline' },
];

export default function HistoryTab() {
    const { user } = useAuthStore();
    const [filter, setFilter] = useState<Filter>('REJECTED');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const isLabStaff = user?.role === 'LabAssistant' || user?.role === 'LabIncharge';

    const loadHistory = useCallback(async (status: Filter) => {
        try {
            let res;
            // Lab staff see ALL bookings (globally), students see only their own
            const endpoint = isLabStaff
                ? `/bookings/all?status=${status}&limit=50`
                : `/bookings?status=${status}&limit=50`;
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    res = await api.get(endpoint);
                    break;
                } catch (e: any) {
                    if (attempt === 2 || e?.response?.status === 401) throw e;
                    await new Promise(r => setTimeout(r, 1500));
                }
            }
            setBookings(res!.data.bookings ?? []);
        } catch (e: any) {
            if (e?.response?.status !== 401) console.error('History load error:', e?.message ?? e);
            setBookings([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [isLabStaff]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            loadHistory(filter);
        }, [filter, loadHistory])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadHistory(filter);
    };

    const cfg = STATUS_COLORS[filter];

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Booking History</Text>

            {/* Filter pills — compact horizontal */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
                {FILTER_OPTS.map(f => (
                    <TouchableOpacity
                        key={f.value}
                        style={[styles.filterBtn, filter === f.value && styles.filterBtnActive]}
                        onPress={() => setFilter(f.value)}
                        activeOpacity={0.7}>
                        <Ionicons
                            name={f.icon}
                            size={14}
                            color={filter === f.value ? '#a5b4fc' : '#94a3b8'}
                        />
                        <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Count badge */}
            {!loading && (
                <Text style={styles.countText}>
                    {bookings.length} {filter.toLowerCase()} booking{bookings.length !== 1 ? 's' : ''}
                </Text>
            )}

            {loading ? (
                <ActivityIndicator color='#4f46e5' size='large' style={{ marginTop: 40 }} />
            ) : (
                <ScrollView
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor='#4f46e5' />}>
                    {bookings.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name={cfg.icon} size={32} color={cfg.dot} />
                            </View>
                            <Text style={styles.emptyTitle}>No {filter.toLowerCase()} bookings</Text>
                            <Text style={styles.emptyText}>No bookings with this status found.</Text>
                        </View>
                    ) : (
                        bookings.map(b => (
                            <View
                                key={b.bookingId}
                                style={[styles.card, { borderLeftColor: cfg.dot }]}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.cardIconCircle, { backgroundColor: cfg.dot + '20' }]}>
                                        <Ionicons name='flask' size={16} color={cfg.dot} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.eqName}>{b.equipmentName}</Text>
                                    </View>
                                    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                                        <View style={[styles.dot, { backgroundColor: cfg.dot }]} />
                                        <Text style={[styles.badgeText, { color: cfg.text }]}>
                                            {b.status}
                                            {b.waitlistPosition != null ? ` #${b.waitlistPosition}` : ''}
                                        </Text>
                                    </View>
                                </View>

                                {b.slot && (
                                    <View style={styles.detailRow}>
                                        <Ionicons name='calendar-outline' size={13} color='#64748b' />
                                        <Text style={styles.detail}>
                                            {b.slot.date} · {b.slot.startTime}–{b.slot.endTime}
                                        </Text>
                                    </View>
                                )}

                                {b.userEmail && (user?.role === 'LabAssistant' || user?.role === 'LabIncharge') && (
                                    <View style={styles.detailRow}>
                                        <Ionicons name='person-outline' size={13} color='#64748b' />
                                        <Text style={styles.detail}>{b.userEmail}</Text>
                                    </View>
                                )}

                                {b.rejectionReason && (
                                    <View style={styles.reasonBox}>
                                        <Text style={styles.reasonLabel}>Reason</Text>
                                        <Text style={styles.reasonText}>{b.rejectionReason}</Text>
                                    </View>
                                )}

                                {b.createdAt && (
                                    <Text style={styles.timestamp}>
                                        {new Date(b.createdAt).toLocaleDateString('en-IN', {
                                            day: '2-digit', month: 'short', year: 'numeric',
                                        })}
                                    </Text>
                                )}
                            </View>
                        ))
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { fontSize: 22, fontWeight: '700', color: '#f8fafc', padding: 16, paddingBottom: 8 },
    filterScroll: { paddingHorizontal: 16, paddingBottom: 4, maxHeight: 46 },
    filterContent: { gap: 8, paddingRight: 16, alignItems: 'center' },
    filterBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, backgroundColor: '#1e293b',
        borderWidth: 1, borderColor: '#334155',
    },
    filterBtnActive: { backgroundColor: '#312e81', borderColor: '#4f46e5' },
    filterText: { color: '#94a3b8', fontWeight: '600', fontSize: 12 },
    filterTextActive: { color: '#a5b4fc' },
    countText: { fontSize: 12, color: '#475569', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, fontWeight: '500' },
    list: { padding: 16, paddingBottom: 40, gap: 10 },
    card: {
        backgroundColor: '#1e293b', borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: '#334155',
        borderLeftWidth: 3,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
    cardIconCircle: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    eqName: { fontSize: 15, fontWeight: '700', color: '#f8fafc', marginTop: 4 },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, gap: 5 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    detail: { fontSize: 13, color: '#94a3b8' },
    reasonBox: {
        backgroundColor: '#450a0a', borderRadius: 8, padding: 10, marginTop: 8,
        borderWidth: 1, borderColor: '#7f1d1d',
    },
    reasonLabel: { fontSize: 11, color: '#fca5a5', fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
    reasonText: { fontSize: 13, color: '#fecaca', lineHeight: 18 },
    timestamp: { fontSize: 11, color: '#475569', marginTop: 8 },
    emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyIconCircle: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center',
        marginBottom: 16, borderWidth: 1, borderColor: '#334155',
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
    emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
});
