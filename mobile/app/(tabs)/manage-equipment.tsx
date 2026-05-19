/**
 * Equipment Manager — Add/Edit/Delete equipment (Lab Incharge only)
 * Full CRUD operations matching web LabInchargeDashboard equipment tab
 */
import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, Modal, ScrollView,
    RefreshControl, Switch,
} from 'react-native';
import api from '../../lib/api';
import { useAuthStore } from '../../store';

interface Equipment {
    equipmentId: string;
    name: string;
    category: string;
    location: string;
    status: string;
    description: string;
    maxBookingHours: number;
    requiresApproval: boolean;
}

const STATUS_OPTIONS = ['AVAILABLE', 'UNDER_MAINTENANCE', 'RETIRED'];
const statusColor: Record<string, string> = {
    AVAILABLE: '#22c55e', UNDER_MAINTENANCE: '#f59e0b', RETIRED: '#64748b',
};

export default function EquipmentManagerScreen() {
    const { user } = useAuthStore();
    const [items, setItems] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [editing, setEditing] = useState<Partial<Equipment> | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [form, setForm] = useState({
        name: '', category: '', location: '', description: '',
        status: 'AVAILABLE', maxBookingHours: '4', requiresApproval: false,
    });

    const isIncharge = user?.role === 'LabIncharge';

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/equipment');
            setItems(res.data.items ?? []);
        } catch { }
        finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openAdd = () => {
        setEditing(null);
        setForm({ name: '', category: '', location: '', description: '', status: 'AVAILABLE', maxBookingHours: '4', requiresApproval: false });
        setModalVisible(true);
    };

    const openEdit = (eq: Equipment) => {
        setEditing(eq);
        setForm({
            name: eq.name,
            category: eq.category,
            location: eq.location ?? '',
            description: eq.description ?? '',
            status: eq.status,
            maxBookingHours: String(eq.maxBookingHours ?? 4),
            requiresApproval: eq.requiresApproval ?? false,
        });
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.category.trim()) {
            Alert.alert('Validation', 'Name and category are required.');
            return;
        }
        setSaving(true);
        const payload = {
            name: form.name.trim(),
            category: form.category.trim(),
            location: form.location.trim(),
            description: form.description.trim(),
            status: form.status,
            maxBookingHours: parseInt(form.maxBookingHours) || 4,
            requiresApproval: form.requiresApproval,
        };
        try {
            if (editing?.equipmentId) {
                const res = await api.put(`/equipment/${editing.equipmentId}`, payload);
                const updated = res.data.equipment ?? res.data;
                setItems(prev => prev.map(i => i.equipmentId === editing.equipmentId ? { ...i, ...updated } : i));
                Alert.alert('Success', 'Equipment updated.');
            } else {
                const res = await api.post('/equipment', payload);
                const created = res.data.equipment ?? res.data;
                setItems(prev => [created, ...prev]);
                Alert.alert('Success', 'Equipment created.');
            }
            setModalVisible(false);
        } catch {
            Alert.alert('Error', 'Failed to save equipment.');
        } finally { setSaving(false); }
    };

    const handleDelete = (eq: Equipment) => {
        Alert.alert(
            'Retire Equipment',
            `Soft-delete "${eq.name}"? It will be moved to RETIRED status.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Retire', style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/equipment/${eq.equipmentId}`);
                            setItems(prev => prev.map(i => i.equipmentId === eq.equipmentId ? { ...i, status: 'RETIRED' } : i));
                            Alert.alert('Done', 'Equipment retired.');
                        } catch { Alert.alert('Error', 'Failed to retire equipment.'); }
                    },
                },
            ]
        );
    };

    if (!isIncharge) {
        return (
            <View style={styles.center}>
                <Text style={styles.lockIcon}>🔒</Text>
                <Text style={styles.titleText}>Lab In-charge Only</Text>
                <Text style={styles.subtitleText}>Equipment management is restricted to Lab In-charges.</Text>
            </View>
        );
    }

    const filtered = search
        ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()))
        : items;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.header}>Equipment Manager</Text>
                <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
                    <Text style={styles.addBtnText}>+ Add</Text>
                </TouchableOpacity>
            </View>

            <TextInput style={styles.search} value={search} onChangeText={setSearch}
                placeholder='Search equipment…' placeholderTextColor='#64748b' />

            {loading && items.length === 0 ? (
                <ActivityIndicator color='#818cf8' style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={i => i.equipmentId}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
                            tintColor='#818cf8' />
                    }
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <View style={styles.cardTop}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.name}>{item.name}</Text>
                                    <Text style={styles.meta}>{item.category} · {item.location}</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: (statusColor[item.status] ?? '#64748b') + '22' }]}>
                                    <Text style={[styles.statusText, { color: statusColor[item.status] ?? '#64748b' }]}>
                                        {item.status.replace('_', ' ')}
                                    </Text>
                                </View>
                            </View>
                            {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
                            <View style={styles.actionRow}>
                                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                                    <Text style={styles.editBtnText}>✏️ Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.retireBtn, item.status === 'RETIRED' && { opacity: 0.4 }]}
                                    disabled={item.status === 'RETIRED'}
                                    onPress={() => handleDelete(item)}>
                                    <Text style={styles.retireBtnText}>🗑 Retire</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={<Text style={styles.empty}>No equipment found.</Text>}
                />
            )}

            {/* Add/Edit Modal */}
            <Modal visible={modalVisible} animationType='slide' transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView>
                            <Text style={styles.modalTitle}>{editing?.equipmentId ? 'Edit Equipment' : 'Add Equipment'}</Text>

                            <Text style={styles.label}>Name *</Text>
                            <TextInput style={styles.input} value={form.name}
                                onChangeText={v => setForm(f => ({ ...f, name: v }))}
                                placeholder='Equipment name' placeholderTextColor='#64748b' />

                            <Text style={styles.label}>Category *</Text>
                            <TextInput style={styles.input} value={form.category}
                                onChangeText={v => setForm(f => ({ ...f, category: v }))}
                                placeholder='e.g. Microscope, Spectrometer' placeholderTextColor='#64748b' />

                            <Text style={styles.label}>Location</Text>
                            <TextInput style={styles.input} value={form.location}
                                onChangeText={v => setForm(f => ({ ...f, location: v }))}
                                placeholder='Lab room / building' placeholderTextColor='#64748b' />

                            <Text style={styles.label}>Description</Text>
                            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={form.description}
                                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                                placeholder='Equipment description' placeholderTextColor='#64748b' multiline />

                            <Text style={styles.label}>Status</Text>
                            <View style={styles.statusRow}>
                                {STATUS_OPTIONS.map(s => (
                                    <TouchableOpacity key={s}
                                        style={[styles.statusOption, form.status === s && styles.statusOptionActive]}
                                        onPress={() => setForm(f => ({ ...f, status: s }))}>
                                        <Text style={[styles.statusOptionText, form.status === s && styles.statusOptionTextActive]}>
                                            {s.replace('_', ' ')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Max Booking Hours</Text>
                            <TextInput style={styles.input} value={form.maxBookingHours}
                                onChangeText={v => setForm(f => ({ ...f, maxBookingHours: v }))}
                                keyboardType='numeric' placeholderTextColor='#64748b' />

                            <View style={styles.switchRow}>
                                <Text style={styles.switchLabel}>Requires Approval</Text>
                                <Switch
                                    value={form.requiresApproval}
                                    onValueChange={v => setForm(f => ({ ...f, requiresApproval: v }))}
                                    trackColor={{ false: '#334155', true: '#4f46e5' }}
                                    thumbColor='#f8fafc'
                                />
                            </View>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                                    <Text style={styles.saveBtnText}>
                                        {saving ? 'Saving…' : editing?.equipmentId ? 'Update' : 'Create'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#0f172a' },
    lockIcon: { fontSize: 48, marginBottom: 16 },
    titleText: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
    subtitleText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    header: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
    addBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    addBtnText: { color: '#f8fafc', fontWeight: '600', fontSize: 14 },
    search: { backgroundColor: '#1e293b', borderRadius: 14, borderWidth: 1, borderColor: '#334155', color: '#f8fafc', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 14, fontSize: 14 },
    card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
    name: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
    meta: { fontSize: 12, color: '#64748b', marginTop: 2 },
    statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    statusText: { fontSize: 11, fontWeight: '500' },
    desc: { fontSize: 13, color: '#94a3b8', marginBottom: 10, lineHeight: 18 },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
    editBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
    editBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
    retireBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#7f1d1d', alignItems: 'center' },
    retireBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '500' },
    empty: { textAlign: 'center', color: '#64748b', marginTop: 40 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#0f172a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: '#334155' },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 20 },
    label: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 6, marginTop: 12 },
    input: { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', color: '#f8fafc', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
    statusRow: { flexDirection: 'row', gap: 8 },
    statusOption: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
    statusOptionActive: { borderColor: '#4f46e5', backgroundColor: '#4f46e520' },
    statusOptionText: { fontSize: 11, color: '#64748b', fontWeight: '500' },
    statusOptionTextActive: { color: '#818cf8' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingVertical: 8 },
    switchLabel: { fontSize: 14, color: '#94a3b8' },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 20 },
    cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
    cancelBtnText: { color: '#94a3b8', fontWeight: '600' },
    saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#4f46e5', alignItems: 'center' },
    saveBtnText: { color: '#f8fafc', fontWeight: '600' },
});
