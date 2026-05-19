// Approvals tab — LabAssistant/LabIncharge only
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';

interface Booking {
    bookingId: string;
    userId: string;
    userEmail: string;
    equipmentName: string;
    slot?: { date: string; startTime: string; endTime: string };
    purpose?: string;
    createdAt?: string;
}

export default function ApprovalsScreen() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);
    const [rejectTarget, setRejectTarget] = useState<Booking | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [waitlistTarget, setWaitlistTarget] = useState<Booking | null>(null);

    const load = useCallback(async (refresh = false) => {
        if (refresh) setRefreshing(true);
        try {
            const res = await api.get('/bookings/pending');
            setBookings(res.data.bookings ?? []);
        } catch (e: any) {
            if (e?.response?.status !== 401) console.error('Approvals load error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const decide = async (b: Booking, status: 'APPROVED' | 'REJECTED' | 'WAITLISTED', reason?: string) => {
        setProcessing(b.bookingId);
        try {
            await api.put(`/bookings/${b.bookingId}/status`, { status, rejectionReason: reason });
            setBookings(bb => bb.filter(bk => bk.bookingId !== b.bookingId));
        } catch (e: any) {
            const msg = e?.response?.data?.message ?? 'Action failed. Please try again.';
            Alert.alert('Error', msg);
        } finally { setProcessing(null); }
    };

    const openReject = (b: Booking) => { setRejectReason(''); setRejectTarget(b); };
    const confirmReject = () => {
        if (!rejectTarget) return;
        const b = rejectTarget;
        setRejectTarget(null);
        decide(b, 'REJECTED', rejectReason.trim() || undefined);
    };

    const openWaitlist = (b: Booking) => { setWaitlistTarget(b); };
    const confirmWaitlist = () => {
        if (!waitlistTarget) return;
        const b = waitlistTarget;
        setWaitlistTarget(null);
        decide(b, 'WAITLISTED');
    };

    return (
        <View style={styles.container}>
            {/* Reject reason modal */}
            <Modal visible={!!rejectTarget} transparent animationType='fade' onRequestClose={() => setRejectTarget(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalIconCircle}>
                            <Ionicons name='close-circle' size={24} color='#ef4444' />
                        </View>
                        <Text style={styles.modalTitle}>Reject Booking</Text>
                        <Text style={styles.modalSub}>{rejectTarget?.equipmentName}</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            placeholder='Rejection reason (optional, shown to user)…'
                            placeholderTextColor='#64748b'
                            multiline
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectTarget(null)} activeOpacity={0.7}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalReject} onPress={confirmReject} activeOpacity={0.7}>
                                <Ionicons name='close-circle-outline' size={16} color='#f87171' style={{ marginRight: 4 }} />
                                <Text style={styles.modalRejectText}>Reject</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Waitlist confirm modal */}
            <Modal visible={!!waitlistTarget} transparent animationType='fade' onRequestClose={() => setWaitlistTarget(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={[styles.modalIconCircle, { backgroundColor: '#d9770620' }]}>
                            <Ionicons name='hourglass' size={24} color='#fb923c' />
                        </View>
                        <Text style={styles.modalTitle}>Move to Waitlist</Text>
                        <Text style={styles.modalSub}>{waitlistTarget?.equipmentName}</Text>
                        <Text style={styles.modalDesc}>The student will be notified and automatically promoted if a slot opens up.</Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setWaitlistTarget(null)} activeOpacity={0.7}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalWaitlist} onPress={confirmWaitlist} activeOpacity={0.7}>
                                <Ionicons name='hourglass-outline' size={16} color='#fb923c' style={{ marginRight: 4 }} />
                                <Text style={styles.modalWaitlistText}>Waitlist</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {loading
                ? <ActivityIndicator color='#818cf8' size='large' style={{ marginTop: 40 }} />
                : <FlatList
                    data={bookings}
                    keyExtractor={b => b.bookingId}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor='#818cf8' />}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    ListHeaderComponent={
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.headerTitle}>Pending Approvals</Text>
                                <Text style={styles.headerCount}>{bookings.length} awaiting review</Text>
                            </View>
                            <TouchableOpacity onPress={() => load(true)} style={styles.refreshBtn} activeOpacity={0.7}>
                                <Ionicons name='refresh' size={18} color='#818cf8' />
                            </TouchableOpacity>
                        </View>
                    }
                    renderItem={({ item: b }) => (
                        <View style={[styles.card, { borderLeftColor: '#38bdf8', borderLeftWidth: 3 }]}>
                            <View style={styles.cardTop}>
                                <View style={styles.cardIconCircle}>
                                    <Ionicons name='flask' size={16} color='#38bdf8' />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.name}>{b.equipmentName}</Text>
                                    <View style={styles.metaRow}>
                                        <Ionicons name='calendar-outline' size={12} color='#64748b' />
                                        <Text style={styles.meta}>{b.slot?.date} · {b.slot?.startTime}–{b.slot?.endTime}</Text>
                                    </View>
                                    <View style={styles.metaRow}>
                                        <Ionicons name='person-outline' size={12} color='#64748b' />
                                        <Text style={styles.meta}>{b.userEmail}</Text>
                                    </View>
                                </View>
                            </View>
                            {b.purpose && (
                                <View style={styles.purposeBox}>
                                    <Ionicons name='document-text-outline' size={12} color='#64748b' />
                                    <Text style={styles.purpose}>{b.purpose}</Text>
                                </View>
                            )}
                            <View style={styles.actions}>
                                <TouchableOpacity
                                    style={styles.approveBtn}
                                    disabled={processing === b.bookingId}
                                    onPress={() => decide(b, 'APPROVED')}
                                    activeOpacity={0.7}>
                                    <Ionicons name='checkmark-circle-outline' size={16} color='#4ade80' />
                                    <Text style={styles.approveText}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.waitlistBtn}
                                    disabled={processing === b.bookingId}
                                    onPress={() => openWaitlist(b)}
                                    activeOpacity={0.7}>
                                    <Ionicons name='hourglass-outline' size={16} color='#fb923c' />
                                    <Text style={styles.waitlistText}>Waitlist</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.rejectBtn}
                                    disabled={processing === b.bookingId}
                                    onPress={() => openReject(b)}
                                    activeOpacity={0.7}>
                                    <Ionicons name='close-circle-outline' size={16} color='#f87171' />
                                    <Text style={styles.rejectText}>Reject</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name='checkmark-done-circle' size={32} color='#22c55e' />
                            </View>
                            <Text style={styles.emptyTitle}>All caught up!</Text>
                            <Text style={styles.emptyText}>No pending approvals right now.</Text>
                        </View>
                    }
                />
            }
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
    headerCount: { fontSize: 12, color: '#64748b', marginTop: 2 },
    refreshBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: '#334155',
    },
    card: {
        backgroundColor: '#1e293b', borderRadius: 16, padding: 14,
        marginBottom: 12, borderWidth: 1, borderColor: '#334155',
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
    cardIconCircle: {
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: '#38bdf820', justifyContent: 'center', alignItems: 'center',
    },
    name: { fontSize: 15, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
    meta: { fontSize: 12, color: '#94a3b8' },
    purposeBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 6,
        marginTop: 4, backgroundColor: '#0f172a', borderRadius: 8, padding: 10,
    },
    purpose: { fontSize: 12, color: '#64748b', flex: 1 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    approveBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
        backgroundColor: '#16a34a18', borderWidth: 1, borderColor: '#16a34a40',
        borderRadius: 12, paddingVertical: 10,
    },
    approveText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
    waitlistBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
        backgroundColor: '#d9770618', borderWidth: 1, borderColor: '#d9770640',
        borderRadius: 12, paddingVertical: 10,
    },
    waitlistText: { color: '#fb923c', fontSize: 13, fontWeight: '600' },
    rejectBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
        backgroundColor: '#dc262618', borderWidth: 1, borderColor: '#dc262640',
        borderRadius: 12, paddingVertical: 10,
    },
    rejectText: { color: '#f87171', fontSize: 13, fontWeight: '600' },
    emptyContainer: { alignItems: 'center', paddingTop: 60 },
    emptyIconCircle: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#14532d40', justifyContent: 'center', alignItems: 'center',
        marginBottom: 16, borderWidth: 1, borderColor: '#16a34a40',
    },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: '#f8fafc', marginTop: 4 },
    emptyText: { fontSize: 13, color: '#64748b', marginTop: 4 },
    // Modal styles
    modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalCard: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
    modalIconCircle: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: '#dc262620', justifyContent: 'center', alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
    modalSub: { fontSize: 13, color: '#94a3b8', marginBottom: 16 },
    modalDesc: { fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 20, textAlign: 'center' },
    modalInput: { backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155', color: '#f8fafc', padding: 14, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 16, width: '100%' },
    modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
    modalCancel: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
    modalCancelText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
    modalReject: { flex: 1, flexDirection: 'row', paddingVertical: 13, borderRadius: 12, backgroundColor: '#dc262630', borderWidth: 1, borderColor: '#dc262660', alignItems: 'center', justifyContent: 'center' },
    modalRejectText: { color: '#f87171', fontSize: 14, fontWeight: '600' },
    modalWaitlist: { flex: 1, flexDirection: 'row', paddingVertical: 13, borderRadius: 12, backgroundColor: '#d9770630', borderWidth: 1, borderColor: '#d9770660', alignItems: 'center', justifyContent: 'center' },
    modalWaitlistText: { color: '#fb923c', fontSize: 14, fontWeight: '600' },
});
