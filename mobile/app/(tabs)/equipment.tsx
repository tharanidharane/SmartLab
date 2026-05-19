// Equipment tab — browse and book (matches web Equipment page filters)
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../lib/api';
import { useAuthStore } from '../../store';

interface Equipment {
    equipmentId: string;
    name: string;
    category: string;
    status: string;
    location: string;
    description: string;
    requiresApproval?: boolean;
}

const STATUS_META: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    AVAILABLE: { color: '#22c55e', icon: 'checkmark-circle' },
    UNDER_MAINTENANCE: { color: '#f59e0b', icon: 'construct' },
    RETIRED: { color: '#64748b', icon: 'close-circle' },
};

const STATUS_OPTS = [
    { label: 'Available', value: 'AVAILABLE', icon: 'checkmark-circle-outline' as keyof typeof Ionicons.glyphMap },
    { label: 'Maintenance', value: 'UNDER_MAINTENANCE', icon: 'construct-outline' as keyof typeof Ionicons.glyphMap },
    { label: 'Retired', value: 'RETIRED', icon: 'close-circle-outline' as keyof typeof Ionicons.glyphMap },
    { label: 'All', value: '', icon: 'apps-outline' as keyof typeof Ionicons.glyphMap },
];

export default function EquipmentScreen() {
    const [allItems, setAllItems] = useState<Equipment[]>([]);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('AVAILABLE');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { user } = useAuthStore();

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const params = new URLSearchParams();
            if (status) params.set('status', status);
            if (category) params.set('category', category);
            if (search) params.set('search', search);
            const res = await api.get(`/equipment?${params.toString()}`);
            setAllItems(res.data.items ?? []);
        } catch { }
        finally { setLoading(false); setRefreshing(false); }
    }, [status, category, search]);

    useEffect(() => { load(); }, [load]);

    const categories = [...new Set(allItems.map(e => e.category))].filter(Boolean);

    const filtered = search
        ? allItems.filter(i =>
            i.name.toLowerCase().includes(search.toLowerCase()) ||
            i.category.toLowerCase().includes(search.toLowerCase())
        )
        : allItems;

    return (
        <View style={styles.container}>
            {/* Search bar with icon */}
            <View style={styles.searchContainer}>
                <Ionicons name='search-outline' size={18} color='#64748b' style={styles.searchIcon} />
                <TextInput
                    style={styles.search}
                    value={search}
                    onChangeText={setSearch}
                    placeholder='Search equipment…'
                    placeholderTextColor='#64748b'
                    returnKeyType='search'
                    onSubmitEditing={() => load()}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
                        <Ionicons name='close-circle' size={18} color='#64748b' />
                    </TouchableOpacity>
                )}
            </View>

            {/* Status filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
                {STATUS_OPTS.map(opt => (
                    <TouchableOpacity key={opt.value}
                        style={[styles.chip, status === opt.value && styles.chipActive]}
                        onPress={() => setStatus(opt.value)}
                        activeOpacity={0.7}>
                        <Ionicons name={opt.icon} size={14} color={status === opt.value ? '#f8fafc' : '#94a3b8'} />
                        <Text style={[styles.chipText, status === opt.value && styles.chipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Category filter pills */}
            {categories.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow} contentContainerStyle={styles.filterContent}>
                    <TouchableOpacity
                        style={[styles.chip, category === '' && styles.chipCatActive]}
                        onPress={() => setCategory('')}
                        activeOpacity={0.7}>
                        <Text style={[styles.chipText, category === '' && styles.chipTextActive]}>All</Text>
                    </TouchableOpacity>
                    {categories.map(c => (
                        <TouchableOpacity key={c}
                            style={[styles.chip, category === c && styles.chipCatActive]}
                            onPress={() => setCategory(c)}
                            activeOpacity={0.7}>
                            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Results count */}
            {!loading && (
                <Text style={styles.resultCount}>{filtered.length} equipment found</Text>
            )}

            {loading
                ? <ActivityIndicator color='#818cf8' size='large' style={{ marginTop: 40 }} />
                : <FlatList
                    data={filtered}
                    keyExtractor={i => i.equipmentId}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor='#818cf8' />}
                    renderItem={({ item }) => {
                        const meta = STATUS_META[item.status] ?? { color: '#64748b', icon: 'help-circle' as keyof typeof Ionicons.glyphMap };
                        return (
                            <View style={[styles.card, { borderLeftColor: meta.color, borderLeftWidth: 3 }]}>
                                <View style={styles.cardHeader}>
                                    <View style={[styles.eqIconCircle, { backgroundColor: meta.color + '20' }]}>
                                        <Ionicons name='flask' size={18} color={meta.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.name}>{item.name}</Text>
                                        <Text style={styles.category}>
                                            <Ionicons name='folder-outline' size={11} color='#64748b' /> {item.category} · {item.location}
                                        </Text>
                                    </View>
                                    <View style={[styles.badge, { backgroundColor: meta.color + '18', borderColor: meta.color + '40' }]}>
                                        <Ionicons name={meta.icon} size={12} color={meta.color} style={{ marginRight: 3 }} />
                                        <Text style={[styles.badgeText, { color: meta.color }]}>
                                            {item.status.replace(/_/g, ' ')}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
                                {item.requiresApproval && (
                                    <View style={styles.approvalRow}>
                                        <Ionicons name='alert-circle-outline' size={13} color='#f59e0b' />
                                        <Text style={styles.approvalNote}>Requires approval</Text>
                                    </View>
                                )}
                                <TouchableOpacity
                                    style={[styles.bookBtn, item.status !== 'AVAILABLE' && styles.bookBtnDisabled]}
                                    disabled={item.status !== 'AVAILABLE' || user?.role === 'LabAssistant'}
                                    onPress={() => router.push(`/equipment/${item.equipmentId}/book` as never)}
                                    activeOpacity={0.7}>
                                    <Ionicons
                                        name={item.status !== 'AVAILABLE' ? 'close-circle-outline' : 'calendar-outline'}
                                        size={16} color='#f8fafc' style={{ marginRight: 6 }}
                                    />
                                    <Text style={styles.bookBtnText}>
                                        {item.status !== 'AVAILABLE' ? 'Not Available' : 'Book Now'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name='flask-outline' size={48} color='#334155' />
                            <Text style={styles.emptyTitle}>No equipment found</Text>
                            <Text style={styles.emptyText}>Try adjusting your filters or search query.</Text>
                        </View>
                    }
                />
            }
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#1e293b', borderRadius: 14,
        borderWidth: 1, borderColor: '#334155',
        marginBottom: 12, paddingHorizontal: 12,
    },
    searchIcon: { marginRight: 8 },
    search: { flex: 1, color: '#f8fafc', paddingVertical: 12, fontSize: 14 },
    clearBtn: { padding: 4 },
    filterRow: { marginBottom: 8, maxHeight: 38 },
    categoryRow: { marginBottom: 12, maxHeight: 38 },
    filterContent: { gap: 8, paddingRight: 16, alignItems: 'center' },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1,
        borderColor: '#334155', backgroundColor: '#1e293b',
    },
    chipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
    chipCatActive: { backgroundColor: '#0369a1', borderColor: '#0369a1' },
    chipText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
    chipTextActive: { color: '#f8fafc' },
    resultCount: { fontSize: 12, color: '#475569', marginBottom: 10, fontWeight: '500' },
    card: {
        backgroundColor: '#1e293b', borderRadius: 16, padding: 16,
        marginBottom: 12, borderWidth: 1, borderColor: '#334155',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
    eqIconCircle: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    name: { fontSize: 15, fontWeight: '700', color: '#f8fafc' },
    category: { fontSize: 12, color: '#64748b', marginTop: 3 },
    badge: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1,
    },
    badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    desc: { fontSize: 13, color: '#94a3b8', marginBottom: 10, lineHeight: 19 },
    approvalRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
    approvalNote: { fontSize: 12, color: '#f59e0b', fontWeight: '500' },
    bookBtn: {
        backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 11,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    },
    bookBtnDisabled: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
    bookBtnText: { color: '#f8fafc', fontSize: 14, fontWeight: '600' },
    emptyContainer: { alignItems: 'center', paddingTop: 60 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: '#f8fafc', marginTop: 12 },
    emptyText: { fontSize: 13, color: '#64748b', marginTop: 4 },
});
