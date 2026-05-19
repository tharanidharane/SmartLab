import Constants from 'expo-constants';
import { Platform } from 'react-native';

type ExtraConfig = {
    apiUrl?: string;
    wsUrl?: string;
};

function trimTrailingSlash(url: string): string {
    return url.replace(/\/+$/, '');
}

function getExtraConfig(): ExtraConfig {
    const fromExpoConfig = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
    const fromManifest = ((Constants as any).manifest?.extra ?? {}) as ExtraConfig;
    const fromManifest2 = ((Constants as any).manifest2?.extra?.expoClient ?? {}) as ExtraConfig;

    return {
        ...fromManifest,
        ...fromManifest2,
        ...fromExpoConfig,
    };
}

function deriveDevApiUrl(): string | null {
    if (!__DEV__) return null;

    const hostUri = Constants.expoConfig?.hostUri
        ?? ((Constants as any).manifest?.debuggerHost as string | undefined)
        ?? ((Constants as any).manifest2?.extra?.expoGo?.debuggerHost as string | undefined);

    if (hostUri) {
        const host = hostUri.split(':')[0];
        return `http://${host}:3001`;
    }

    if (Platform.OS === 'android') {
        // Android emulators cannot reach host localhost directly.
        return 'http://10.0.2.2:3001';
    }

    return 'http://localhost:3001';
}

function resolveApiUrl(): string {
    const envApi = process.env.EXPO_PUBLIC_API_URL?.trim();
    const extraApi = getExtraConfig().apiUrl?.trim();
    const devApi = deriveDevApiUrl();
    const chosen = __DEV__
        ? (devApi || envApi || extraApi || '')
        : (envApi || extraApi || '');
    return chosen ? trimTrailingSlash(chosen) : '';
}

export const API_URL = resolveApiUrl();

export function getAuthFailureMessage(action: 'Login' | 'Registration', fallback = 'Request failed.'): string {
    if (!API_URL) {
        return `${action} failed. API URL is not configured.`;
    }
    return fallback;
}
