// =============================================================
// Zustand auth store for React Native — uses SecureStore
// =============================================================
import { create } from 'zustand';

export interface MobileUser {
    userId: string;
    name: string;
    email: string;
    role: 'Student' | 'Faculty' | 'LabAssistant' | 'LabIncharge';
    department: string;
}

interface AuthStore {
    user: MobileUser | null;
    isAuthenticated: boolean;
    setUser: (user: MobileUser) => void;
    clearUser: () => void;
}

export const useAuthStore = create<AuthStore>()((set) => ({
    user: null,
    isAuthenticated: false,
    setUser: (user) => set({ user, isAuthenticated: true }),
    clearUser: () => set({ user: null, isAuthenticated: false }),
}));

// ── Mobile Booking Store ──────────────────────────────────────
export interface MobileBooking {
    bookingId: string;
    equipmentName: string;
    status: string;
    slot?: { date: string; startTime: string; endTime: string };
    purpose?: string;
    waitlistPosition?: number;
}

interface BookingStore {
    bookings: MobileBooking[];
    setBookings: (b: MobileBooking[]) => void;
}
export const useBookingStore = create<BookingStore>()((set) => ({
    bookings: [],
    setBookings: (bookings) => set({ bookings }),
}));
