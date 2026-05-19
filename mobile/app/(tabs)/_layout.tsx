import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store';
import { Platform } from 'react-native';

export default function TabsLayout() {
    const { user } = useAuthStore();
    const role = user?.role ?? 'Student';
    const isStudent = ['Student', 'Faculty', 'Researcher'].includes(role);
    const isAssistant = role === 'LabAssistant';
    const isIncharge = role === 'LabIncharge';
    const isStaff = isAssistant || isIncharge;

    return (
        <Tabs screenOptions={{
            headerStyle: { backgroundColor: '#0f172a', elevation: 0, shadowOpacity: 0 },
            headerTintColor: '#f8fafc',
            headerTitleStyle: { fontWeight: '700', fontSize: 18 },
            tabBarStyle: {
                backgroundColor: '#0f172a',
                borderTopColor: '#1e293b',
                borderTopWidth: 1,
                height: Platform.OS === 'ios' ? 88 : 64,
                paddingBottom: Platform.OS === 'ios' ? 28 : 8,
                paddingTop: 8,
                elevation: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
            },
            tabBarActiveTintColor: '#818cf8',
            tabBarInactiveTintColor: '#475569',
            tabBarLabelStyle: {
                fontSize: 10,
                fontWeight: '600',
                marginTop: 2,
            },
            tabBarIconStyle: {
                marginBottom: -2,
            },
        }}>
            {/* ─── Home — visible to all ─────────────────────────────── */}
            <Tabs.Screen name='index' options={{
                title: 'Home',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />,
            }} />

            {/* ─── Equipment browse — Students/Faculty see this in tab bar ── */}
            <Tabs.Screen name='equipment' options={{
                title: 'Equipment',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'flask' : 'flask-outline'} size={22} color={color} />,
                href: isStudent ? undefined : null,
            }} />

            {/* ─── Bookings — Students/Faculty only ────────────────── */}
            <Tabs.Screen name='bookings' options={{
                title: 'Bookings',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={22} color={color} />,
                href: isStudent ? undefined : null,
            }} />

            {/* ─── Approvals — Assistant only ──────────────────── */}
            <Tabs.Screen name='approvals' options={{
                title: 'Approvals',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'} size={22} color={color} />,
                href: isAssistant ? undefined : null,
            }} />

            {/* ─── AI — visible to all ──────────────────────────────── */}
            <Tabs.Screen name='genai' options={{
                title: 'AI',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={22} color={color} />,
            }} />

            {/* ─── History — Students/Faculty ───────────────────────── */}
            <Tabs.Screen name='history' options={{
                title: 'History',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'time' : 'time-outline'} size={22} color={color} />,
                href: isStudent ? undefined : null,
            }} />

            {/* ─── QR Scan — Assistant only ────────────────────── */}
            <Tabs.Screen name='qr' options={{
                title: 'QR Scan',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'qr-code' : 'qr-code-outline'} size={22} color={color} />,
                href: isAssistant ? undefined : null,
            }} />

            {/* ─── Usage Logs — Staff tab bar ─────────────────────────── */}
            <Tabs.Screen name='usage-logs' options={{
                title: 'Usage',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={22} color={color} />,
                href: isStaff ? undefined : null,
            }} />

            {/* ─── Equipment Manager — Incharge tab bar ─────────────── */}
            <Tabs.Screen name='manage-equipment' options={{
                title: 'Manage',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'build' : 'build-outline'} size={22} color={color} />,
                href: isIncharge ? undefined : null,
            }} />

            {/* ─── ML Forecast — Incharge tab bar ─────────────────────── */}
            <Tabs.Screen name='forecast' options={{
                title: 'Forecast',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'trending-up' : 'trending-up-outline'} size={22} color={color} />,
                href: isIncharge ? undefined : null,
            }} />

            {/* ─── Anomalies — Incharge (accessible via Home) ────────── */}
            <Tabs.Screen name='anomalies' options={{
                title: 'Anomalies',
                headerTitle: 'Anomaly Detection',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'warning' : 'warning-outline'} size={22} color={color} />,
                href: null,
            }} />

            {/* ─── Audit Logs — Incharge (accessible via Home) ───────── */}
            <Tabs.Screen name='audit-logs' options={{
                title: 'Audit',
                headerTitle: 'Audit Logs',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={22} color={color} />,
                href: null,
            }} />

            {/* ─── User Management — Incharge (accessible via Home) ──── */}
            <Tabs.Screen name='user-management' options={{
                title: 'Users',
                headerTitle: 'User Management',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} />,
                href: null,
            }} />

            {/* ─── Analytics — Incharge (accessible via Home) ────────── */}
            <Tabs.Screen name='analytics' options={{
                title: 'Analytics',
                headerTitle: 'Analytics Dashboard',
                tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={22} color={color} />,
                href: null,
            }} />
        </Tabs>
    );
}
