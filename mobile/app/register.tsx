import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import * as SecureStore from '../lib/storage';
import { useAuthStore } from '../store';
import { decodeJwtPayload } from '../lib/jwtDecode';
import { API_URL, getAuthFailureMessage } from '../lib/runtimeConfig';

export default function RegisterScreen() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [department, setDepartment] = useState('');
    const [role, setRole] = useState<'Student' | 'Faculty' | 'LabAssistant' | 'LabIncharge'>('Student');
    const [loading, setLoading] = useState(false);

    const { setUser } = useAuthStore();

    const handleRegister = async () => {
        if (!name.trim() || !email.trim() || !password.trim() || !department.trim()) {
            Alert.alert('Error', 'Please fill in all fields.');
            return;
        }

        setLoading(true);
        try {
            if (!API_URL) {
                throw new Error(getAuthFailureMessage('Registration'));
            }
            // 1. Call custom backend register API to create user in Auth provider 
            await axios.post(`${API_URL}/auth/register`, {
                name: name.trim(),
                email: email.trim(),
                password,
                department: department.trim(),
                role
            });

            // 2. Immediately log them in after successful registration
            const loginRes = await axios.post(`${API_URL}/auth/login`, {
                email: email.trim(),
                password
            });

            const { accessToken, refreshToken, idToken } = loginRes.data;

            await SecureStore.setItemAsync('accessToken', accessToken);
            await SecureStore.setItemAsync('refreshToken', refreshToken);
            await SecureStore.setItemAsync('idToken', idToken);

            const payload = decodeJwtPayload(idToken) as Record<string, string>;
            setUser({
                userId: payload.sub,
                name: payload.name ?? name.trim(),
                email: payload.email,
                role: (payload['custom:role'] ?? role) as 'Student' | 'Faculty' | 'LabAssistant' | 'LabIncharge',
                department: payload['custom:department'] ?? department.trim(),
            });

            if (Platform.OS === 'web') {
                window.alert('Registration successful!');
            } else {
                Alert.alert('Success', 'Registration successful!');
            }
            router.replace('/(tabs)');

        } catch (err: unknown) {
            const msg = axios.isAxiosError(err)
                ? (err.response?.data?.message
                    ?? (err.request ? getAuthFailureMessage('Registration', 'Registration failed. Unable to reach server. Check network or API URL.') : 'Registration failed.'))
                : (err instanceof Error ? err.message : 'Registration failed.');

            console.error('Registration Error:', err);
            if (Platform.OS === 'web') {
                window.alert(`Registration Failed: ${msg}`);
            } else {
                Alert.alert('Registration Failed', msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer} style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <View style={styles.card}>
                <Text style={styles.logo}>Create Account</Text>
                <Text style={styles.subtitle}>Join SmartLab System</Text>

                <TextInput
                    style={styles.input}
                    placeholder='Full Name'
                    placeholderTextColor='#64748b'
                    value={name}
                    onChangeText={setName}
                />

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

                <TextInput
                    style={styles.input}
                    placeholder='Password'
                    placeholderTextColor='#64748b'
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />

                <TextInput
                    style={styles.input}
                    placeholder='Department (e.g. Computer Science)'
                    placeholderTextColor='#64748b'
                    value={department}
                    onChangeText={setDepartment}
                />

                <Text style={styles.label}>Select Role</Text>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={role}
                        style={Platform.OS === 'web' ? styles.pickerWeb : styles.pickerNative}
                        dropdownIconColor="#818cf8"
                        onValueChange={(itemValue) => setRole(itemValue as any)}
                    >
                        <Picker.Item label="Student" value="Student" color={Platform.OS === 'ios' ? '#f8fafc' : undefined} />
                        <Picker.Item label="Faculty" value="Faculty" color={Platform.OS === 'ios' ? '#f8fafc' : undefined} />
                        <Picker.Item label="Lab Assistant" value="LabAssistant" color={Platform.OS === 'ios' ? '#f8fafc' : undefined} />
                        <Picker.Item label="Lab Incharge" value="LabIncharge" color={Platform.OS === 'ios' ? '#f8fafc' : undefined} />
                    </Picker>
                </View>

                <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
                    {loading
                        ? <ActivityIndicator color='#ffffff' />
                        : <Text style={styles.buttonText}>Register</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/login')}>
                    <Text style={styles.linkText}>Already have an account? Sign In</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    card: { backgroundColor: '#1e293b', borderRadius: 24, padding: 28, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: 'rgba(148,163,184,0.1)' },
    logo: { fontSize: 26, fontWeight: '700', color: '#818cf8', textAlign: 'center', marginBottom: 6 },
    subtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 24 },
    label: { fontSize: 13, color: '#94a3b8', marginBottom: 8, marginLeft: 4 },
    input: { backgroundColor: '#0f172a', borderRadius: 14, borderWidth: 1, borderColor: '#334155', color: '#f8fafc', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14, fontSize: 15 },
    pickerContainer: { backgroundColor: '#0f172a', borderRadius: 14, borderWidth: 1, borderColor: '#334155', marginBottom: 20, overflow: 'hidden' },
    pickerNative: { color: '#f8fafc' },
    pickerWeb: { color: '#f8fafc', backgroundColor: 'transparent', padding: 14, border: 'none', outlineStyle: 'none', fontSize: 15 } as any,
    button: { backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
    buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
    linkButton: { marginTop: 20, alignItems: 'center' },
    linkText: { color: '#818cf8', fontSize: 14, fontWeight: '500' },
});
