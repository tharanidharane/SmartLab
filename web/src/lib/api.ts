// =============================================================
// Axios API client with auto token refresh
// =============================================================
import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    timeout: 30_000,
});

// ── Request: attach Bearer token ─────────────────────────────
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ── Response: refresh on 401 ─────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (err: unknown, token: string | null) => {
    failedQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token!)));
    failedQueue = [];
};

api.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
        const original = error.config as typeof error.config & { _retry?: boolean };
        if (error.response?.status !== 401 || original?._retry) {
            return Promise.reject(error);
        }
        original._retry = true;

        if (isRefreshing) {
            return new Promise<string>((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then((token) => {
                original.headers!.Authorization = `Bearer ${token}`;
                return api(original);
            });
        }

        isRefreshing = true;
        try {
            const { refreshToken, updateAccessToken, logout } = useAuthStore.getState();
            if (!refreshToken) throw new Error('No refresh token');

            const { data } = await axios.post(
                `${import.meta.env.VITE_API_URL}/auth/refresh`,
                { refreshToken }
            );
            const newToken = data.idToken;
            updateAccessToken(newToken);
            processQueue(null, newToken);
            original.headers!.Authorization = `Bearer ${newToken}`;
            return api(original);
        } catch (err) {
            processQueue(err, null);
            useAuthStore.getState().logout();
            window.location.href = '/';
            return Promise.reject(err);
        } finally {
            isRefreshing = false;
        }
    }
);

export default api;
