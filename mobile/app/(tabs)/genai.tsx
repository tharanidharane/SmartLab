// GenAI tab — mobile chat interface
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import api from '../../lib/api';

interface Message { role: 'user' | 'assistant'; content: string; }

const QUICK_PROMPTS = [
    'What equipment is available?',
    'Show booking statistics',
    'Lab usage insights',
    'Equipment maintenance tips',
];

export default function GenAIScreen() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [usagePercent, setUsagePercent] = useState(0);
    const sessionId = useRef(Crypto.randomUUID());
    const listRef = useRef<FlatList>(null);

    useEffect(() => {
        api.get('/genai/usage').then(r => setUsagePercent(r.data.percentUsed ?? 0)).catch(() => { });
    }, []);

    const send = async (msg?: string) => {
        const text = (msg ?? input).trim();
        if (!text || sending) return;
        setInput('');
        setSending(true);
        const userMsg: Message = { role: 'user', content: text };
        setMessages(m => [...m, userMsg]);
        try {
            const res = await api.post('/genai/chat', { message: text, sessionId: sessionId.current });
            setMessages(m => [...m, { role: 'assistant', content: res.data.reply }]);
            if (res.data.usage) setUsagePercent(Math.round((res.data.usage.used / res.data.usage.limit) * 100));
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        } catch (err: unknown) {
            const axErr = err as { response?: { status?: number; data?: { message?: string } } };
            if (axErr.response?.status === 429) Alert.alert('Limit Reached', axErr.response.data?.message ?? 'Monthly token limit reached.');
            else Alert.alert('Error', 'AI assistant unavailable. Try again.');
            setMessages(m => m.slice(0, -1));
            setInput(text);
        } finally {
            setSending(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {/* Token usage bar with label */}
            <View style={styles.usageContainer}>
                <View style={styles.usageBar}>
                    <View style={[styles.usageFill, {
                        width: `${usagePercent}%`,
                        backgroundColor: usagePercent < 70 ? '#22c55e' : usagePercent < 90 ? '#f59e0b' : '#ef4444',
                    }]} />
                </View>
                <Text style={styles.usageLabel}>{usagePercent}% used</Text>
            </View>

            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(_, i) => i.toString()}
                contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name='sparkles' size={32} color='#818cf8' />
                        </View>
                        <Text style={styles.emptyTitle}>SmartLab AI</Text>
                        <Text style={styles.emptyText}>Ask about lab equipment, bookings, or usage insights</Text>
                        <View style={styles.promptGrid}>
                            {QUICK_PROMPTS.map(p => (
                                <TouchableOpacity
                                    key={p}
                                    style={styles.promptChip}
                                    onPress={() => send(p)}
                                    activeOpacity={0.7}>
                                    <Text style={styles.promptText}>{p}</Text>
                                    <Ionicons name='arrow-forward' size={12} color='#818cf8' />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                        {item.role === 'assistant' && (
                            <View style={styles.aiHeader}>
                                <Ionicons name='sparkles' size={12} color='#818cf8' />
                                <Text style={styles.aiLabel}>SmartLab AI</Text>
                            </View>
                        )}
                        <Text style={[styles.bubbleText, item.role === 'user' && { color: '#ffffff' }]}>{item.content}</Text>
                    </View>
                )}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            />
            {sending && (
                <View style={styles.typing}>
                    <ActivityIndicator color='#818cf8' size='small' />
                    <Text style={styles.typingText}>SmartLab AI is thinking…</Text>
                </View>
            )}

            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder='Ask SmartLab AI…'
                    placeholderTextColor='#64748b'
                    multiline
                    returnKeyType='send'
                    onSubmitEditing={() => send()}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, (!input.trim() || sending) && styles.sendDisabled]}
                    onPress={() => send()}
                    disabled={!input.trim() || sending}
                    activeOpacity={0.7}>
                    <Ionicons
                        name='arrow-up'
                        size={20}
                        color={(!input.trim() || sending) ? '#475569' : '#f8fafc'}
                    />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    usageContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
    usageBar: { flex: 1, height: 4, backgroundColor: '#1e293b', borderRadius: 2, overflow: 'hidden' },
    usageFill: { height: 4, borderRadius: 2 },
    usageLabel: { fontSize: 10, color: '#64748b', fontWeight: '500', minWidth: 50 },
    empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
    emptyIconCircle: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#312e8140', justifyContent: 'center', alignItems: 'center',
        marginBottom: 12, borderWidth: 1, borderColor: '#4f46e540',
    },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 6 },
    emptyText: { color: '#64748b', textAlign: 'center', lineHeight: 22, paddingHorizontal: 20, marginBottom: 24 },
    promptGrid: { width: '100%', paddingHorizontal: 8, gap: 8 },
    promptChip: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
        borderWidth: 1, borderColor: '#334155',
    },
    promptText: { fontSize: 13, color: '#94a3b8', fontWeight: '500', flex: 1 },
    bubble: { maxWidth: '82%', borderRadius: 18, padding: 14, marginBottom: 10 },
    userBubble: { backgroundColor: '#4f46e5', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
    aiBubble: { backgroundColor: '#1e293b', alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#334155' },
    aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
    aiLabel: { fontSize: 10, color: '#818cf8', fontWeight: '700', textTransform: 'uppercase' },
    bubbleText: { color: '#f8fafc', fontSize: 14, lineHeight: 21 },
    typing: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingHorizontal: 16 },
    typingText: { color: '#64748b', fontSize: 13 },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#1e293b' },
    input: { flex: 1, backgroundColor: '#1e293b', borderRadius: 16, borderWidth: 1, borderColor: '#334155', color: '#f8fafc', paddingHorizontal: 16, paddingVertical: 11, fontSize: 14, maxHeight: 120 },
    sendBtn: { width: 44, height: 44, backgroundColor: '#4f46e5', borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    sendDisabled: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
});
