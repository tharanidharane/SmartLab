/**
 * User Management — View users, change roles (Lab Incharge only)
 * Matches web LabInchargeDashboard users tab
 */
import { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    ActivityIndicator, RefreshControl, Alert, TouchableOpacity,
} from 'react-native';
import api from '../../lib/api';
import { useAuthStore } from '../../store';

interface UserRecord {
    userId: string;
    email: string;
    name: string;
    role: string;
    department: string;
    status: string;
}

const ROLES = ['Student', 'Faculty', 'LabAssistant', 'LabIncharge'];

const roleColors: Record<string, string> = {
    Student: '#22c55e',
    Faculty: '#3b82f6',
    LabAssistant: '#f59e0b',
    LabIncharge: '#a855f7',
    Researcher: '#06b6d4',
};

export default function UserManagementScreen() {
    const { user } = useAuthStore();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const isIncharge = user?.role === 'LabIncharge';

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/users');
            setUsers(res.data.users ?? []);
        } catch { }
        finally { setLoading(false); setRefreshing(false); }
    };

    useEffect(() => { load(); }, []);

    if (!isIncharge) {
        return (
            <View style={styles.center}>
                <Text style={styles.lockIcon}>🔒</Text>
                <Text style={styles.title}>Lab In-charge Only</Text>
                <Text style={styles.subtitle}>User management is restricted to Lab In-charges.</Text>
            </View>
        );
    }

    const handleRoleChange = (u: UserRecord) => {
        const otherRoles = ROLES.filter(r => r !== u.role);
        Alert.alert(
            'Change Role',
            `Current role: ${u.role}\nUser: ${u.name || u.email}`,
            [
                ...otherRoles.map(r => ({
                    text: r,
                    onPress: async () => {
                        try {
                            await api.put(`/users/${u.userId}/role`, { role: r });
                            setUsers(prev => prev.map(x => x.userId === u.userId ? { ...x, role: r } : x));
                            Alert.alert('Success', `Role updated to ${r}.`);
                        } catch {
                            Alert.alert('Error', 'Failed to update role.');
                        }
                    },
                })),
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>User Management</Text>
            <Text style={styles.hint}>{users.length} registered users</Text>

            {loading && users.length === 0 ? (
                <ActivityIndicator color='#818cf8' style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={u => u.userId}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
                            tintColor='#818cf8' />
                    }
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <View style={styles.cardRow}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {(item.name || item.email)?.[0]?.toUpperCase() ?? '?'}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.name}>{item.name || 'Unnamed'}</Text>
                                    <Text style={styles.email}>{item.email}</Text>
                                    {item.department ? <Text style={styles.dept}>{item.department}</Text> : null}
                                </View>
                                <TouchableOpacity
                                    style={[styles.roleBadge, { backgroundColor: (roleColors[item.role] ?? '#64748b') + '22', borderColor: (roleColors[item.role] ?? '#64748b') + '44' }]}
                                    onPress={() => handleRoleChange(item)}>
                                    <Text style={[styles.roleText, { color: roleColors[item.role] ?? '#64748b' }]}>
                                        {item.role}
                                    </Text>
                                    <Text style={styles.changeHint}>tap to change</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <Text style={styles.empty}>No users found.</Text>
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
    card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#4f46e520', borderWidth: 1, borderColor: '#4f46e540', justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 16, fontWeight: '700', color: '#818cf8' },
    name: { fontSize: 14, fontWeight: '600', color: '#f8fafc' },
    email: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
    dept: { fontSize: 11, color: '#64748b', marginTop: 2 },
    roleBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
    roleText: { fontSize: 12, fontWeight: '600' },
    changeHint: { fontSize: 8, color: '#64748b', marginTop: 2 },
    empty: { textAlign: 'center', color: '#64748b', marginTop: 40 },
});
