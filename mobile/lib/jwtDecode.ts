// Safe JWT payload decoder for React Native
// Neither atob() nor Buffer exist in the React Native JS runtime (Hermes).
// This uses a pure-JS base64 decode.

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function base64Decode(input: string): string {
    let output = '';
    let buffer: number;
    let bits: number;
    let padding = 0;

    // Replace URL-safe chars and strip whitespace
    const str = input
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .replace(/\s/g, '');

    // Pad to multiple of 4
    const padded = str.padEnd(str.length + (4 - (str.length % 4)) % 4, '=');

    for (let i = 0; i < padded.length; i++) {
        if (padded[i] === '=') { padding++; continue; }
        const idx = BASE64_CHARS.indexOf(padded[i]);
        if (idx === -1) continue;

        if (i % 4 === 0) {
            buffer = idx << 2;
        } else if (i % 4 === 1) {
            buffer! |= idx >> 4;
            output += String.fromCharCode(buffer!);
            buffer = (idx & 0x0f) << 4;
        } else if (i % 4 === 2) {
            buffer! |= idx >> 2;
            output += String.fromCharCode(buffer!);
            buffer = (idx & 0x03) << 6;
        } else {
            buffer! |= idx;
            output += String.fromCharCode(buffer!);
        }
    }

    return output;
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid JWT');
        const json = base64Decode(parts[1]);
        return JSON.parse(json);
    } catch (e) {
        throw new Error('Failed to decode JWT payload');
    }
}
