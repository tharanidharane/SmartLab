// Home tab -- role-aware dashboard with stats and quick links
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../lib/api';
import { useAuthStore } from '../../store';
import * as SecureStore from '../../lib/storage';

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
    'Total Equipment': 'flask-outline',
    'Equipment': 'flask-outline',
    'Available': 'checkmark-circle-outline',
    'Maintenance': 'construct-outline',
    'Users': 'people-outline',
    'Pending Approvals': 'hourglass-outline',
    'Active Bookings': 'calendar-outline',
};

const ACTION_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
    'Manage Equipment': 'build-outline',
    'ML Forecasting': 'trending-up-outline',
    'Anomaly Detection': 'warning-outline',
    'Audit Logs': 'document-text-outline',
    'User Management': 'people-outline',
    'Analytics': 'bar-chart-outline',
    'Usage Logs': 'pulse-outline',
    'AI Assistant': 'sparkles-outline',
    'Pending Approvals': 'checkmark-circle-outline',
    'QR Scanner': 'qr-code-outline',
    'History': 'time-outline',
    'Equipment': 'flask-outline',
    'Browse Equipment': 'flask-outline',
    'My Bookings': 'calendar-outline',
};

const STAT_COLORS = ['#818cf8', '#22c55e', '#f59e0b', '#38bdf8'];

export default function HomeScreen() {
    const { user } = useAuthStore();
    const role = user?.role ?? 'Student';
    const isStudent = ['Student', 'Faculty', 'Researcher'].includes(role);
    const isAssistant = role === 'LabAssistant';
    const isIncharge = role === 'LabIncharge';

    const [stats, setStats] = useState({ total: 0, available: 0, myActive: 0, pendingApprovals: 0, maintenanceCount: 0, userCount: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [eqRes, bkRes] = await Promise.all([
                    api.get('/equipment'),
                    api.get('/bookings?limit=10'),
                ]);
                const items = eqRes.data.items ?? [];
                const bookings = bkRes.data.bookings ?? [];
                const newStats = {
                    total: items.length,
                    available: items.filter((e: { status: string }) => e.status === 'AVAILABLE').length,
                    myActive: bookings.filter((b: { status: string }) => ['APPROVED', 'PENDING'].includes(b.status)).length,
                    pendingApprovals: 0,
                    maintenanceCount: items.filter((e: { status: string }) => e.status === 'UNDER_MAINTENANCE').length,
                    userCount: 0,
                };

                if (isAssistant) {
                    try {
                        const pRes = await api.get('/bookings/pending');
                        newStats.pendingApprovals = pRes.data.total ?? (pRes.data.bookings?.length ?? 0);
                    } catch { }
                }
                if (isIncharge) {
                    try {
                        const uRes = await api.get('/users');
                        newStats.userCount = uRes.data.users?.length ?? 0;
                    } catch { }
                }

                setStats(newStats);
            } catch { }
            finally { setLoading(false); }
        };
        load();
    }, [isAssistant, isIncharge]);

    if (loading) return <View style={styles.center}><ActivityIndicator color='#818cf8' size='large' /></View>;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const statCards = isIncharge
        ? [
            { label: 'Total Equipment', value: stats.total },
            { label: 'Available', value: stats.available },
            { label: 'Maintenance', value: stats.maintenanceCount },
            { label: 'Users', value: stats.userCount },
        ]
        : isAssistant
            ? [
                { label: 'Pending Approvals', value: stats.pendingApprovals },
                { label: 'Total Equipment', value: stats.total },
                { label: 'Available', value: stats.available },
            ]
            : [
                { label: 'Equipment', value: stats.total },
                { label: 'Available', value: stats.available },
                { label: 'Active Bookings', value: stats.myActive },
            ];

    const quickActions = isIncharge
        ? [
            { label: 'Manage Equipment', desc: `${stats.total} total — Add/Edit/Delete`, route: '/(tabs)/manage-equipment' },
            { label: 'ML Forecasting', desc: 'Demand prediction & utilization', route: '/(tabs)/forecast' },
            { label: 'Anomaly Detection', desc: 'Unusual usage patterns', route: '/(tabs)/anomalies' },
            { label: 'Audit Logs', desc: 'System activity log', route: '/(tabs)/audit-logs' },
            { label: 'User Management', desc: `${stats.userCount} users — Role changes`, route: '/(tabs)/user-management' },
            { label: 'Analytics', desc: 'QuickSight & utilization', route: '/(tabs)/analytics' },
            { label: 'Usage Logs', desc: 'Real-time booking events', route: '/(tabs)/usage-logs' },
            { label: 'AI Assistant', desc: 'Lab intelligence', route: '/(tabs)/genai' },
        ]
        : isAssistant
            ? [
                { label: 'Pending Approvals', desc: `${stats.pendingApprovals} awaiting review`, route: '/(tabs)/approvals' },
                { label: 'QR Scanner', desc: 'Check-in / check-out', route: '/(tabs)/qr' },
                { label: 'Usage Logs', desc: 'Real-time booking events', route: '/(tabs)/usage-logs' },
                { label: 'History', desc: 'Rejected & waitlisted', route: '/(tabs)/history' },
                { label: 'Equipment', desc: `${stats.available} available`, route: '/(tabs)/equipment' },
                { label: 'AI Assistant', desc: 'Lab intelligence', route: '/(tabs)/genai' },
            ]
            : [
                { label: 'Browse Equipment', desc: `${stats.available} available`, route: '/(tabs)/equipment' },
                { label: 'My Bookings', desc: `${stats.myActive} active`, route: '/(tabs)/bookings' },
                { label: 'History', desc: 'Past bookings', route: '/(tabs)/history' },
                { label: 'AI Assistant', desc: 'Lab intelligence', route: '/(tabs)/genai' },
            ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
            {/* Greeting Section */}
            <View style={styles.greetingSection}>
                <View style={styles.avatarCircle}>
                    <Ionicons name='person' size={24} color='#818cf8' />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.greeting}>{greeting}, {user?.name?.split(' ')[0]}</Text>
                    <Text style={styles.subtitle}>{role} · {user?.department}</Text>
                </View>
            </View>

            <View style={[styles.roleBadge, isIncharge ? styles.roleBadgeIncharge : isAssistant ? styles.roleBadgeAssistant : styles.roleBadgeStudent]}>
                <Ionicons
                    name={isIncharge ? 'shield-checkmark-outline' : isAssistant ? 'body-outline' : 'school-outline'}
                    size={16} color='#f8fafc' style={{ marginRight: 6 }}
                />
                <Text style={styles.roleBadgeText}>
                    {isIncharge ? 'Lab In-Charge Dashboard' : isAssistant ? 'Lab Assistant Dashboard' : 'Student Dashboard'}
                </Text>
            </View>

            {/* Stat Cards */}
            <View style={styles.statsRow}>
                {statCards.map((s, idx) => (
                    <View key={s.label} style={styles.statCard}>
                        <View style={[styles.statIconCircle, { backgroundColor: (STAT_COLORS[idx % STAT_COLORS.length]) + '20' }]}>
                            <Ionicons
                                name={(ICON_MAP[s.label] ?? 'stats-chart-outline') as keyof typeof Ionicons.glyphMap}
                                size={18}
                                color={STAT_COLORS[idx % STAT_COLORS.length]}
                            />
                        </View>
                        <Text style={styles.statValue}>{s.value}</Text>
                        <Text style={styles.statLabel}>{s.label}</Text>
                    </View>
                ))}
            </View>

            {/* Quick Actions */}
            <Text style={styles.heading}>Quick Actions</Text>
            {quickActions.map(a => (
                <TouchableOpacity key={a.label} style={styles.actionCard} onPress={() => router.push(a.route as never)} activeOpacity={0.7}>
                    <View style={styles.actionIconCircle}>
                        <Ionicons
                            name={(ACTION_ICON_MAP[a.label] ?? 'arrow-forward-outline') as keyof typeof Ionicons.glyphMap}
                            size={20}
                            color='#818cf8'
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.actionLabel}>{a.label}</Text>
                        <Text style={styles.actionDesc}>{a.desc}</Text>
                    </View>
                    <Ionicons name='chevron-forward' size={18} color='#475569' />
                </TouchableOpacity>
            ))}

            <TouchableOpacity
                style={styles.logoutBtn}
                activeOpacity={0.7}
                onPress={async () => {
                    await SecureStore.deleteItemAsync('accessToken');
                    await SecureStore.deleteItemAsync('refreshToken');
                    await SecureStore.deleteItemAsync('idToken');
                    useAuthStore.getState().clearUser();
                    router.replace('/login');
                }}>
                <Ionicons name='log-out-outline' size={18} color='#fca5a5' style={{ marginRight: 8 }} />
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
    center: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
    greetingSection: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 16, gap: 14 },
    avatarCircle: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#818cf8',
        justifyContent: 'center', alignItems: 'center',
    },
    greeting: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
    subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    roleBadge: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    roleBadgeIncharge: { backgroundColor: '#312e81', borderWidth: 1, borderColor: '#4338ca' },
    roleBadgeAssistant: { backgroundColor: '#1e3a5f', borderWidth: 1, borderColor: '#2563eb' },
    roleBadgeStudent: { backgroundColor: '#14532d', borderWidth: 1, borderColor: '#16a34a' },
    roleBadgeText: { color: '#f8fafc', fontWeight: '600', fontSize: 13 },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28, flexWrap: 'wrap' },
    statCard: {
        flex: 1, minWidth: 90, backgroundColor: '#1e293b', borderRadius: 16,
        padding: 14, borderWidth: 1, borderColor: '#334155',
    },
    statIconCircle: {
        width: 32, height: 32, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    },
    statValue: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
    statLabel: { fontSize: 10, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    heading: { fontSize: 17, fontWeight: '700', color: '#f8fafc', marginBottom: 12 },
    actionCard: {
        backgroundColor: '#1e293b', borderRadius: 16, padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: '#334155',
        flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    actionIconCircle: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: '#312e8140', justifyContent: 'center', alignItems: 'center',
    },
    actionLabel: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
    actionDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
    logoutBtn: {
        marginTop: 20, padding: 14, borderRadius: 14,
        backgroundColor: '#450a0a', borderWidth: 1, borderColor: '#7f1d1d',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    },
    logoutText: { color: '#fca5a5', fontWeight: 'bold', fontSize: 14 },
});