/**
 * QR Scanner Tab — Lab Assistant equipment check-in/check-out
 * Uses expo-camera to scan bookingId QR codes
 * Deep link format: smartlab://check-in?bookingId=<id>
 */
import { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Alert,
    ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../../lib/api';
import { useAuthStore } from '../../store';

interface BookingResult {
    bookingId: string;
    equipmentName: string;
    userEmail: string;
    status: string;
    slot?: { date: string; startTime: string; endTime: string };
}

const statusMeta: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    APPROVED: { color: '#22c55e', icon: 'checkmark-circle' },
    PENDING: { color: '#f59e0b', icon: 'time' },
    COMPLETED: { color: '#3b82f6', icon: 'checkmark-done-circle' },
    REJECTED: { color: '#ef4444', icon: 'close-circle' },
    CANCELLED: { color: '#64748b', icon: 'ban' },
};

export default function QRScannerTab() {
    const { user } = useAuthStore();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [booking, setBooking] = useState<BookingResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionDone, setActionDone] = useState(false);

    const isAssistant = user?.role === 'LabAssistant';

    const handleBarCodeScanned = async ({ data }: { data: string }) => {
        if (scanned || loading) return;
        setScanned(true);

        let bookingId = data.trim();
        const match = data.match(/bookingId=([^&]+)/);
        if (match) bookingId = match[1];

        if (!bookingId) {
            Alert.alert('Invalid QR', 'This QR code does not contain a valid booking ID.');
            setScanned(false);
            return;
        }

        setLoading(true);
        try {
            const res = await api.get(`/bookings/${bookingId}`);
            setBooking(res.data.booking ?? res.data);
        } catch {
            Alert.alert('Not Found', `No booking found for ID: ${bookingId}`);
            setScanned(false);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async () => {
        if (!booking) return;
        setLoading(true);
        try {
            await api.put(`/bookings/${booking.bookingId}/status`, { status: 'COMPLETED' });
            setActionDone(true);
            setBooking(b => b ? { ...b, status: 'COMPLETED' } : null);
            Alert.alert('✓ Checked In', `${booking.equipmentName} booking marked as completed.`);
        } catch {
            Alert.alert('Error', 'Failed to mark booking as completed.');
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setScanned(false);
        setBooking(null);
        setActionDone(false);
    };

    if (!isAssistant) {
        return (
            <View style={styles.center}>
                <View style={styles.lockCircle}>
                    <Ionicons name='lock-closed' size={28} color='#64748b' />
                </View>
                <Text style={styles.title}>Lab Assistant Only</Text>
                <Text style={styles.subtitle}>This feature is available for Lab Assistants.</Text>
            </View>
        );
    }

    if (!permission) return <ActivityIndicator style={{ flex: 1 }} color='#4f46e5' />;

    if (!permission.granted) {
        return (
            <View style={styles.center}>
                <View style={styles.permCircle}>
                    <Ionicons name='camera' size={28} color='#818cf8' />
                </View>
                <Text style={styles.title}>Camera Permission Required</Text>
                <Text style={styles.subtitle}>Grant camera access to scan booking QR codes.</Text>
                <TouchableOpacity style={styles.btn} onPress={requestPermission} activeOpacity={0.7}>
                    <Ionicons name='shield-checkmark-outline' size={18} color='#fff' style={{ marginRight: 6 }} />
                    <Text style={styles.btnText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerSection}>
                <View style={styles.headerIconCircle}>
                    <Ionicons name='qr-code' size={20} color='#818cf8' />
                </View>
                <View>
                    <Text style={styles.header}>Equipment Check-In</Text>
                    <Text style={styles.hint}>Scan the booking QR code on the student's device</Text>
                </View>
            </View>

            {/* Camera viewfinder */}
            {!booking && (
                <View style={styles.cameraContainer}>
                    <CameraView
                        style={styles.camera}
                        facing='back'
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    >
                        <View style={styles.overlay}>
                            <View style={styles.scanBox}>
                                <View style={[styles.corner, styles.topLeft]} />
                                <View style={[styles.corner, styles.topRight]} />
                                <View style={[styles.corner, styles.bottomLeft]} />
                                <View style={[styles.corner, styles.bottomRight]} />
                            </View>
                            <Text style={styles.scanHint}>Align QR code within frame</Text>
                        </View>
                    </CameraView>
                    {loading && (
                        <View style={styles.scanningOverlay}>
                            <ActivityIndicator color='#4f46e5' size='large' />
                            <Text style={styles.scanningText}>Looking up booking…</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Booking result card */}
            {booking && (
                <ScrollView style={styles.resultContainer} contentContainerStyle={{ padding: 16 }}>
                    <View style={styles.card}>
                        <View style={styles.cardTop}>
                            <View style={[styles.cardIconCircle, { backgroundColor: (statusMeta[booking.status]?.color ?? '#64748b') + '20' }]}>
                                <Ionicons name='flask' size={18} color={statusMeta[booking.status]?.color ?? '#64748b'} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.equipName}>{booking.equipmentName}</Text>
                            </View>
                        </View>
                        <View style={styles.detailRow}>
                            <Ionicons name='person-outline' size={14} color='#64748b' />
                            <Text style={styles.detail}>{booking.userEmail}</Text>
                        </View>
                        {booking.slot && (
                            <View style={styles.detailRow}>
                                <Ionicons name='calendar-outline' size={14} color='#64748b' />
                                <Text style={styles.detail}>
                                    {booking.slot.date} · {booking.slot.startTime}–{booking.slot.endTime}
                                </Text>
                            </View>
                        )}
                        <View style={[styles.statusBadge, {
                            backgroundColor: (statusMeta[booking.status]?.color ?? '#64748b') + '18',
                        }]}>
                            <Ionicons
                                name={statusMeta[booking.status]?.icon ?? 'help-circle'}
                                size={14} color={statusMeta[booking.status]?.color ?? '#64748b'}
                            />
                            <Text style={[styles.statusText, { color: statusMeta[booking.status]?.color ?? '#64748b' }]}>
                                {booking.status}
                            </Text>
                        </View>
                    </View>

                    {booking.status === 'APPROVED' && !actionDone && (
                        <TouchableOpacity
                            style={[styles.btn, { backgroundColor: '#16a34a' }]}
                            onPress={handleCheckIn}
                            disabled={loading}
                            activeOpacity={0.7}>
                            {loading
                                ? <ActivityIndicator color='#fff' />
                                : <>
                                    <Ionicons name='checkmark-circle-outline' size={18} color='#fff' style={{ marginRight: 6 }} />
                                    <Text style={styles.btnText}>Mark Completed (Check-In)</Text>
                                </>
                            }
                        </TouchableOpacity>
                    )}
                    {actionDone && (
                        <View style={styles.successBox}>
                            <Ionicons name='checkmark-circle' size={20} color='#4ade80' />
                            <Text style={styles.successMsg}>Booking marked as completed</Text>
                        </View>
                    )}

                    <TouchableOpacity style={[styles.btn, { backgroundColor: '#475569', marginTop: 8 }]} onPress={reset} activeOpacity={0.7}>
                        <Ionicons name='scan-outline' size={18} color='#fff' style={{ marginRight: 6 }} />
                        <Text style={styles.btnText}>Scan Another</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}
        </View>
    );
}

const CORNER = 24;
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#0f172a' },
    lockCircle: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center',
        marginBottom: 16, borderWidth: 1, borderColor: '#334155',
    },
    permCircle: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: '#312e8140', justifyContent: 'center', alignItems: 'center',
        marginBottom: 16, borderWidth: 1, borderColor: '#4f46e540',
    },
    headerSection: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
    headerIconCircle: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: '#312e8140', justifyContent: 'center', alignItems: 'center',
    },
    header: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
    hint: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    title: { fontSize: 20, fontWeight: '700', color: '#f8fafc', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    cameraContainer: { flex: 1, position: 'relative' },
    camera: { flex: 1 },
    overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    scanBox: { width: 240, height: 240, position: 'relative' },
    scanHint: { color: '#94a3b8', fontSize: 13, marginTop: 20, fontWeight: '500' },
    corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#818cf8', borderWidth: 3 },
    topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
    topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
    bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
    bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
    scanningOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.8)',
        alignItems: 'center', justifyContent: 'center',
    },
    scanningText: { color: '#94a3b8', marginTop: 12, fontSize: 14 },
    resultContainer: { flex: 1 },
    card: {
        backgroundColor: '#1e293b', borderRadius: 16, padding: 18,
        borderWidth: 1, borderColor: '#334155', marginBottom: 16,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    cardIconCircle: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    equipName: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    detail: { fontSize: 14, color: '#94a3b8' },
    statusBadge: {
        alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, marginTop: 8,
    },
    statusText: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
    btn: {
        backgroundColor: '#4f46e5', paddingVertical: 14, borderRadius: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8,
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    successBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
    successMsg: { color: '#4ade80', fontSize: 15, fontWeight: '600' },
});
