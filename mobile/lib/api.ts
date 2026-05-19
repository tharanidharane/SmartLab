// =============================================================
// Axios API client for React Native — uses SecureStore for tokens
// =============================================================
import axios from 'axios';
import * as SecureStore from './storage';
import { router } from 'expo-router';
import { API_URL } from './runtimeConfig';

const api = axios.create({
    baseURL: API_URL,
    timeout: 45_000,   // 45s — handles cold Lambda starts (default 30s is too short)
});

api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (err: unknown, token: string | null) => {
    failedQueue.forEach(p => err ? p.reject(err) : p.resolve(token!));
    failedQueue = [];
};

api.interceptors.response.use(
    r => r,
    async (error) => {
        const original = error.config;
        if (error.response?.status !== 401 || original._retry) return Promise.reject(error);
        original._retry = true;

        if (isRefreshing) {
            return new Promise<string>((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then(token => {
                original.headers.Authorization = `Bearer ${token}`;
                return api(original);
            });
        }

        isRefreshing = true;
        try {
            const refreshToken = await SecureStore.getItemAsync('refreshToken');
            if (!refreshToken) throw new Error('No refresh token');
            const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
            // Lambda authorizer expects idToken — store it as the 'accessToken' key
            const newIdToken = data.idToken ?? data.accessToken;
            await SecureStore.setItemAsync('accessToken', newIdToken);
            await SecureStore.setItemAsync('idToken', newIdToken);
            processQueue(null, newIdToken);
            original.headers.Authorization = `Bearer ${newIdToken}`;
            return api(original);
        } catch (err) {
            processQueue(err, null);
            await SecureStore.deleteItemAsync('accessToken');
            await SecureStore.deleteItemAsync('refreshToken');
            router.replace('/login');
            return Promise.reject(err);
        } finally {
            isRefreshing = false;
        }
    }
);

export default api;
