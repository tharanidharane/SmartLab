import { useEffect } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import * as SecureStore from '../lib/storage';
import { useAuthStore } from '../store';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { decodeJwtPayload } from '../lib/jwtDecode';

export default function RootLayout() {
    const { setUser, clearUser } = useAuthStore();
    const colorScheme = useColorScheme();
    const isDark = colorScheme !== 'light';
    usePushNotifications();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = await SecureStore.getItemAsync('accessToken');
                if (!token) {
                    router.replace('/login');
                    return;
                }
                const idToken = await SecureStore.getItemAsync('idToken');
                if (idToken) {
                    const payload = decodeJwtPayload(idToken) as Record<string, string>;
                    setUser({
                        userId: payload.sub,
                        name: payload.name ?? (payload.email?.split('@')[0] ?? 'User'),
                        email: payload.email,
                        role: (payload['custom:role'] ?? 'Student') as 'Student' | 'Faculty' | 'LabAssistant' | 'LabIncharge',
                        department: payload['custom:department'] ?? 'General',
                    });
                    router.replace('/(tabs)');
                } else {
                    throw new Error('No idToken');
                }
            } catch {
                clearUser();
                await SecureStore.deleteItemAsync('accessToken');
                await SecureStore.deleteItemAsync('idToken');
                router.replace('/login');
            }
        };
        checkAuth();
    }, [setUser, clearUser]);

    return (
        <>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack screenOptions={{
                headerStyle: { backgroundColor: '#0f172a' },
                headerTintColor: '#f8fafc',
                contentStyle: { backgroundColor: '#0f172a' },
            }}>
                <Stack.Screen name='index' options={{ headerShown: false }} />
                <Stack.Screen name='login' options={{ headerShown: false }} />
                <Stack.Screen name='register' options={{ headerShown: false }} />
                <Stack.Screen name='(tabs)' options={{ headerShown: false }} />
                <Stack.Screen name='equipment/[id]/book' options={{ title: 'Book Equipment', presentation: 'modal' }} />
            </Stack>
        </>
    );
}
