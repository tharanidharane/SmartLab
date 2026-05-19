// =============================================================
// Zustand store — auth state + booking state + websocket
// =============================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
    userId: string;
    email: string;
    name: string;
    role: 'Student' | 'Faculty' | 'LabAssistant' | 'LabIncharge';
    department: string;
}

interface AuthStore {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    setAuth: (user: User, accessToken: string, refreshToken: string) => void;
    updateAccessToken: (token: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            setAuth: (user, accessToken, refreshToken) =>
                set({ user, accessToken, refreshToken }),
            updateAccessToken: (token) => set({ accessToken: token }),
            logout: () => set({ user: null, accessToken: null, refreshToken: null }),
        }),
        { name: 'smart-lab-auth' }
    )
);

// ── Equipment Store ──────────────────────────────────────────
export interface Equipment {
    equipmentId: string;
    name: string;
    category: string;
    description: string;
    location: string;
    status: 'AVAILABLE' | 'UNDER_MAINTENANCE' | 'RETIRED';
    maxBookingHours: number;
    requiresApproval: boolean;
    photoKey?: string;
    specifications?: Record<string, string>;
}

interface EquipmentStore {
    equipment: Equipment[];
    setEquipment: (items: Equipment[]) => void;
    updateEquipment: (id: string, updates: Partial<Equipment>) => void;
}

export const useEquipmentStore = create<EquipmentStore>()((set) => ({
    equipment: [],
    setEquipment: (items) => set({ equipment: items }),
    updateEquipment: (id, updates) =>
        set((s) => ({
            equipment: s.equipment.map((e) =>
                e.equipmentId === id ? { ...e, ...updates } : e
            ),
        })),
}));

// ── WebSocket Store ──────────────────────────────────────────
interface WsStore {
    isConnected: boolean;
    setConnected: (v: boolean) => void;
}

export const useWsStore = create<WsStore>()((set) => ({
    isConnected: false,
    setConnected: (v) => set({ isConnected: v }),
}));

// ── Notification Store ───────────────────────────────────────
interface Notification {
    id: string;
    type: string;
    message: string;
    timestamp: string;
    read: boolean;
}

interface NotificationStore {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (n: Omit<Notification, 'id' | 'read'>) => void;
    markAllRead: () => void;
}

export const useNotificationStore = create<NotificationStore>()(
    persist(
        (set, get) => ({
            notifications: [],
            unreadCount: 0,
            addNotification: (n) => {
                const notification: Notification = {
                    ...n,
                    id: `${Date.now()}-${Math.random()}`,
                    read: false,
                };
                set((s) => ({
                    notifications: [notification, ...s.notifications].slice(0, 50),
                    unreadCount: s.unreadCount + 1,
                }));
            },
            markAllRead: () =>
                set((s) => ({
                    notifications: s.notifications.map((n) => ({ ...n, read: true })),
                    unreadCount: 0,
                })),
        }),
        { name: 'smart-lab-notifications' }
    )
);
