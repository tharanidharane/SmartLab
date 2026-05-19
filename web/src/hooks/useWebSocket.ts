// =============================================================
// WebSocket hook — auto-reconnect, one-time ticket, message routing
// =============================================================
import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore, useWsStore, useNotificationStore } from '../store';
import api from '../lib/api';

const WS_URL = import.meta.env.VITE_WS_URL;
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export const useWebSocket = () => {
    const ws = useRef<WebSocket | null>(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { accessToken } = useAuthStore();
    const { setConnected } = useWsStore();
    const { addNotification } = useNotificationStore();

    const connect = useCallback(async () => {
        if (!accessToken) return;
        try {
            // Get one-time ticket
            const { data } = await api.post('/auth/ws-ticket');
            const socket = new WebSocket(`${WS_URL}?ticket=${data.ticket}`);

            socket.onopen = () => {
                console.log('WS connected');
                setConnected(true);
                reconnectAttempts.current = 0;
            };

            socket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'BOOKING_STATUS_CHANGED') {
                        addNotification({
                            type: msg.type,
                            message: `Booking ${msg.bookingId} is now ${msg.status}`,
                            timestamp: new Date().toISOString(),
                        });
                    }
                } catch (e) {
                    console.warn('Invalid WS message', e);
                }
            };

            socket.onclose = () => {
                setConnected(false);
                if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts.current++;
                    reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
                }
            };

            socket.onerror = (e) => console.error('WS error:', e);
            ws.current = socket;
        } catch (err) {
            console.error('WS connect failed:', err);
        }
    }, [accessToken, setConnected, addNotification]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            ws.current?.close();
        };
    }, [connect]);
};
