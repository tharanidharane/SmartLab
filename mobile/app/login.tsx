import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from '../lib/storage';
import axios from 'axios';
import { useAuthStore } from '../store';
import { decodeJwtPayload } from '../lib/jwtDecode';
import { API_URL, getAuthFailureMessage } from '../lib/runtimeConfig';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { setUser } = useAuthStore();

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Please enter email and password.');
            return;
        }
        setLoading(true);
        try {
            if (!API_URL) {
                throw new Error(getAuthFailureMessage('Login'));
            }
            const res = await axios.post(`${API_URL}/auth/login`, { email: email.trim(), password });
            const { accessToken, refreshToken, idToken } = res.data;

            await SecureStore.setItemAsync('accessToken', idToken);
            await SecureStore.setItemAsync('refreshToken', refreshToken);
            await SecureStore.setItemAsync('idToken', idToken);

            const payload = decodeJwtPayload(idToken) as Record<string, string>;
            setUser({
                userId: payload.sub,
                name: payload.name ?? payload.email.split('@')[0],
                email: payload.email,
                role: (payload['custom:role'] ?? 'Student') as 'Student' | 'Faculty' | 'LabAssistant' | 'LabIncharge',
                department: payload['custom:department'] ?? 'General',
            });

            router.replace('/(tabs)');
        } catch (err: unknown) {
            const baseMsg = axios.isAxiosError(err)
                ? (err.response?.data?.message
                    ?? (err.request ? getAuthFailureMessage('Login', 'Login failed. Unable to reach server. Check network or API URL.') : 'Login failed.'))
                : (err instanceof Error ? err.message : 'Login failed.');
            const msg = __DEV__ ? `${baseMsg}\nAPI: ${API_URL}` : baseMsg;
            console.error('Login Error:', err);
            if (Platform.OS === 'web') {
                window.alert(`Login Failed: ${msg}`);
            } else {
                Alert.alert('Login Failed', msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                {/* Logo section */}
                <View style={styles.logoSection}>
                    <View style={styles.logoCircle}>
                        <Ionicons name='flask' size={32} color='#818cf8' />
                    </View>
                    <Text style={styles.logo}>SmartLab</Text>
                    <Text style={styles.subtitle}>University Lab Equipment Booking</Text>
                </View>

                {/* Email input */}
                <View style={styles.inputContainer}>
                    <Ionicons name='mail-outline' size={18} color='#64748b' style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder='University Email'
                        placeholderTextColor='#64748b'
                        value={email}
                        onChangeText={setEmail}
                        keyboardType='email-address'
                        autoCapitalize='none'
                        autoCorrect={false}
                    />
                </View>

                {/* Password input */}
                <View style={styles.inputContainer}>
                    <Ionicons name='lock-closed-outline' size={18} color='#64748b' style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder='Password'
                        placeholderTextColor='#64748b'
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color='#64748b' />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading} activeOpacity={0.7}>
                    {loading
                        ? <ActivityIndicator color='#ffffff' />
                        : <View style={styles.buttonContent}>
                            <Ionicons name='log-in-outline' size={18} color='#ffffff' style={{ marginRight: 6 }} />
                            <Text style={styles.buttonText}>Sign In</Text>
                        </View>
                    }
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/register')} activeOpacity={0.7}>
                    <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Sign Up</Text></Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 20 },
    card: {
        backgroundColor: '#1e293b', borderRadius: 24, padding: 28, width: '100%', maxWidth: 400,
        borderWidth: 1, borderColor: '#334155',
    },
    logoSection: { alignItems: 'center', marginBottom: 32 },
    logoCircle: {
        width: 64, height: 64, borderRadius: 20,
        backgroundColor: '#312e8140', justifyContent: 'center', alignItems: 'center',
        marginBottom: 12, borderWidth: 1, borderColor: '#4f46e540',
    },
    logo: { fontSize: 28, fontWeight: '700', color: '#818cf8', marginBottom: 4 },
    subtitle: { fontSize: 13, color: '#64748b', textAlign: 'center' },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#0f172a', borderRadius: 14,
        borderWidth: 1, borderColor: '#334155',
        marginBottom: 14, paddingHorizontal: 14,
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: '#f8fafc', paddingVertical: 14, fontSize: 15 },
    eyeBtn: { padding: 4 },
    button: { backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
    buttonContent: { flexDirection: 'row', alignItems: 'center' },
    buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
    linkButton: { marginTop: 20, alignItems: 'center' },
    linkText: { color: '#94a3b8', fontSize: 14 },
    linkBold: { color: '#818cf8', fontWeight: '600' },
});
