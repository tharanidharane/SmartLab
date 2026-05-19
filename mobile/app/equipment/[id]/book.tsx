// Booking modal — presented as a full-screen modal sheet
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { format } from 'date-fns';
import api from '../../../lib/api';

interface Slot { startTime: string; endTime: string; available: boolean; }

export default function BookingModal() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const today = format(new Date(), 'yyyy-MM-dd');
    const [date, setDate] = useState(today);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [selected, setSelected] = useState<Slot | null>(null);
    const [purpose, setPurpose] = useState('');
    const [notes, setNotes] = useState('');
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!date || !id) return;
        setLoadingSlots(true);
        api.get(`/equipment/${id}/slots?date=${date}`)
            .then(r => { setSlots(r.data.slots ?? []); setSelected(null); })
            .catch((err: any) => {
                const msg = err?.response?.data?.message ?? 'Failed to load slots.';
                Alert.alert('Error', msg);
            })
            .finally(() => setLoadingSlots(false));
    }, [date, id]);

    const submit = async () => {
        if (!selected) { Alert.alert('Select a slot', 'Please choose a time slot.'); return; }
        if (purpose.trim().length < 10) { Alert.alert('Purpose required', 'Please describe your purpose (min 10 chars).'); return; }
        setSubmitting(true);
        try {
            await api.post('/bookings', {
                equipmentId: id,
                slot: { date, startTime: selected.startTime, endTime: selected.endTime, timezone: 'Asia/Kolkata' },
                purpose: purpose.trim(),
                notes: notes.trim() || undefined,
            });
            Alert.alert('Success', 'Booking submitted!', [{ text: 'OK', onPress: () => router.back() }]);
        } catch (err: any) {
            const serverMsg: string | undefined = err?.response?.data?.message;
            const status: number | undefined = err?.response?.status;
            if (status === 409) {
                Alert.alert('Slot Unavailable', serverMsg ?? 'This slot is already booked. You have been added to the waitlist.');
            } else if (status === 400) {
                Alert.alert('Invalid Details', serverMsg ?? 'Please check your inputs and try again.');
            } else if (status === 403) {
                Alert.alert('Not Allowed', serverMsg ?? 'You are not permitted to book this equipment.');
            } else {
                Alert.alert('Booking Failed', serverMsg ?? 'Could not submit booking. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.title}>Book Equipment</Text>

            {/* Date input */}
            <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={date} onChangeText={setDate}
                placeholder='2025-01-01' placeholderTextColor='#64748b' />

            {/* Slots */}
            <Text style={styles.label}>Time Slot</Text>
            {loadingSlots ? <ActivityIndicator color='#818cf8' />
                : <View style={styles.slotGrid}>
                    {slots.map(s => (
                        <TouchableOpacity key={`${s.startTime}-${s.endTime}`}
                            disabled={!s.available}
                            onPress={() => setSelected(s)}
                            style={[styles.slot,
                            selected?.startTime === s.startTime && styles.slotSelected,
                            !s.available && styles.slotUnavailable
                            ]}>
                            <Text style={[styles.slotText, !s.available && styles.slotTextUnavailable]}>
                                {s.startTime}–{s.endTime}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            }

            {/* Purpose */}
            <Text style={styles.label}>Purpose *</Text>
            <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                value={purpose} onChangeText={setPurpose}
                placeholder='Describe your research purpose…' placeholderTextColor='#64748b'
                multiline />

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                value={notes} onChangeText={setNotes}
                placeholder='Any additional notes…' placeholderTextColor='#64748b'
                multiline />

            <TouchableOpacity style={[styles.submitBtn, (submitting || !selected) && styles.submitDisabled]}
                disabled={submitting || !selected} onPress={submit}>
                {submitting ? <ActivityIndicator color='#fff' /> : <Text style={styles.submitText}>Submit Booking</Text>}
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
    title: { fontSize: 22, fontWeight: '700', color: '#f8fafc', marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: '#1e293b', borderRadius: 14, borderWidth: 1, borderColor: '#334155', color: '#f8fafc', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    slot: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1e293b' },
    slotSelected: { borderColor: '#4f46e5', backgroundColor: '#4f46e5' },
    slotUnavailable: { opacity: 0.3 },
    slotText: { fontSize: 12, color: '#f8fafc', fontWeight: '500' },
    slotTextUnavailable: { color: '#64748b' },
    submitBtn: { backgroundColor: '#4f46e5', borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
    submitDisabled: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
    submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
