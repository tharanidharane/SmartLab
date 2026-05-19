// Bookings tab — My bookings list with cancel + QR code for APPROVED bookings
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import api from '../../lib/api';

interface Booking {
    bookingId: string;
    equipmentName: string;
    status: string;
    slot?: { date: string; startTime: string; endTime: string };
    purpose?: string;
    waitlistPosition?: number;
    rejectionReason?: string;
    createdAt?: string;
}

const STATUS_META: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    APPROVED: { color: '#22c55e', icon: 'checkmark-circle' },
    PENDING: { color: '#38bdf8', icon: 'time' },
    REJECTED: { color: '#ef4444', icon: 'close-circle' },
    CANCELLED: { color: '#64748b', icon: 'ban' },
    WAITLISTED: { color: '#a78bfa', icon: 'hourglass' },
    COMPLETED: { color: '#f59e0b', icon: 'checkmark-done-circle' },
};

export default function BookingsScreen() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [qrBooking, setQrBooking] = useState<Booking | null>(null);

    const load = useCallback(async (refresh = false) => {
        if (refresh) setRefreshing(true);
        try {
            const res = await api.get('/bookings');
            setBookings(res.data.bookings ?? []);
        } catch (e: any) {
            if (e?.response?.status !== 401) console.error('Bookings load error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    const handleCancel = (bookingId: string) => {
        Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
            { text: 'Keep', style: 'cancel' },
            {
                text: 'Cancel Booking', style: 'destructive', onPress: async () => {
                    try {
                        await api.delete(`/bookings/${bookingId}`);
                        setBookings(b => b.map(bk => bk.bookingId === bookingId ? { ...bk, status: 'CANCELLED' } : bk));
                    } catch {
                        Alert.alert('Error', 'Failed to cancel booking.');
                    }
                }
            },
        ]);
    };

    const qrValue = (b: Booking) => `smartlab://check-in?bookingId=${b.bookingId}`;

    return (
        <View style={styles.container}>
            {/* QR Code Full-screen Modal */}
            <Modal visible={!!qrBooking} transparent animationType='fade' onRequestClose={() => setQrBooking(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Ionicons name='qr-code' size={24} color='#818cf8' />
                            <Text style={styles.modalTitle}>Show this to Lab Staff</Text>
                        </View>
                        <Text style={styles.modalEquip}>{qrBooking?.equipmentName}</Text>
                        <View style={styles.modalSlotRow}>
                            <Ionicons name='calendar-outline' size={14} color='#94a3b8' />
                            <Text style={styles.modalSlot}>
                                {qrBooking?.slot?.date} · {qrBooking?.slot?.startTime}–{qrBooking?.slot?.endTime}
                            </Text>
                        </View>
                        {qrBooking && (
                            <View style={styles.qrWrapper}>
                                <QRCode
                                    value={qrValue(qrBooking)}
                                    size={220}
                                    backgroundColor='#ffffff'
                                    color='#0f172a'
                                />
                            </View>
                        )}
                        <Text style={styles.qrHint}>
                            The lab assistant will scan this code to check you in
                        </Text>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setQrBooking(null)} activeOpacity={0.7}>
                            <Text style={styles.closeBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Header */}
            <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>My Bookings</Text>
                {!loading && <Text style={styles.headerCount}>{bookings.length} total</Text>}
            </View>

            {loading
                ? <ActivityIndicator color='#818cf8' size='large' style={{ marginTop: 40 }} />
                : <FlatList
                    data={bookings}
                    keyExtractor={b => b.bookingId}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor='#818cf8' />}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    renderItem={({ item: b }) => {
                        const meta = STATUS_META[b.status] ?? { color: '#64748b', icon: 'help-circle' as keyof typeof Ionicons.glyphMap };
                        return (
                            <View style={[styles.card, { borderLeftColor: meta.color, borderLeftWidth: 3 }]}>
                                <View style={styles.row}>
                                    <View style={[styles.cardIconCircle, { backgroundColor: meta.color + '20' }]}>
                                        <Ionicons name='flask' size={16} color={meta.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.name}>{b.equipmentName}</Text>
                                        {b.slot && (
                                            <View style={styles.slotRow}>
                                                <Ionicons name='calendar-outline' size={12} color='#64748b' />
                                                <Text style={styles.slot}>{b.slot.date} · {b.slot.startTime}–{b.slot.endTime}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={[styles.badge, { backgroundColor: meta.color + '18', borderColor: meta.color + '40' }]}>
                                        <Ionicons name={meta.icon} size={12} color={meta.color} style={{ marginRight: 3 }} />
                                        <Text style={[styles.badgeText, { color: meta.color }]}>
                                            {b.status}{b.waitlistPosition ? ` #${b.waitlistPosition}` : ''}
                                        </Text>
                                    </View>
                                </View>
                                {b.purpose && (
                                    <View style={styles.purposeRow}>
                                        <Ionicons name='document-text-outline' size={12} color='#64748b' />
                                        <Text style={styles.purpose} numberOfLines={1}>{b.purpose}</Text>
                                    </View>
                                )}
                                {b.rejectionReason && (
                                    <View style={styles.rejectionRow}>
                                        <Ionicons name='alert-circle' size={12} color='#f87171' />
                                        <Text style={styles.rejection}>{b.rejectionReason}</Text>
                                    </View>
                                )}

                                <View style={styles.actions}>
                                    {(b.status === 'APPROVED' || b.status === 'PENDING') && (
                                        <TouchableOpacity style={styles.qrBtn} onPress={() => setQrBooking(b)} activeOpacity={0.7}>
                                            <Ionicons name='qr-code-outline' size={15} color='#a5b4fc' />
                                            <Text style={styles.qrBtnText}>Show QR</Text>
                                        </TouchableOpacity>
                                    )}
                                    {['PENDING', 'APPROVED', 'WAITLISTED'].includes(b.status) && (
                                        <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(b.bookingId)} activeOpacity={0.7}>
                                            <Ionicons name='close-outline' size={15} color='#f87171' />
                                            <Text style={styles.cancelText}>Cancel</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name='calendar-outline' size={32} color='#475569' />
                            </View>
                            <Text style={styles.emptyTitle}>No bookings yet</Text>
                            <Text style={styles.emptyText}>Browse equipment to make your first booking.</Text>
                        </View>
                    }
                />
            }
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
    headerCount: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    card: {
        backgroundColor: '#1e293b', borderRadius: 16, padding: 14,
        marginBottom: 10, borderWidth: 1, borderColor: '#334155',
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 10 },
    cardIconCircle: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    name: { fontSize: 15, fontWeight: '700', color: '#f8fafc' },
    slotRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
    slot: { fontSize: 12, color: '#94a3b8' },
    badge: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
    },
    badgeText: { fontSize: 10, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' },
    qrBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#312e81', borderWidth: 1, borderColor: '#4f46e5',
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    },
    qrBtnText: { color: '#a5b4fc', fontSize: 13, fontWeight: '600' },
    cancelBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
        borderWidth: 1, borderColor: '#ef444440',
    },
    cancelText: { color: '#f87171', fontSize: 13, fontWeight: '500' },
    purposeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, marginBottom: 2 },
    purpose: { fontSize: 12, color: '#64748b', flex: 1 },
    rejectionRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, marginBottom: 2 },
    rejection: { fontSize: 12, color: '#f87171', flex: 1 },
    emptyContainer: { alignItems: 'center', paddingTop: 60 },
    emptyIconCircle: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center',
        marginBottom: 16, borderWidth: 1, borderColor: '#334155',
    },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: '#f8fafc', marginTop: 4 },
    emptyText: { fontSize: 13, color: '#64748b', marginTop: 4 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    modalCard: { backgroundColor: '#1e293b', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#334155' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
    modalEquip: { fontSize: 15, color: '#a5b4fc', fontWeight: '600', marginBottom: 8, textAlign: 'center' },
    modalSlotRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 20 },
    modalSlot: { fontSize: 13, color: '#94a3b8' },
    qrWrapper: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 16 },
    qrHint: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 20, lineHeight: 18 },
    closeBtn: { backgroundColor: '#4f46e5', paddingVertical: 13, paddingHorizontal: 40, borderRadius: 14 },
    closeBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});
