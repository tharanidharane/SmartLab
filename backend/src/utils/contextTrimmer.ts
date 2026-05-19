// =============================================================
// contextTrimmer — trims LLM context to stay under token limit
// Uses conservative estimate safe for multilingual text (Tamil, Hindi, etc.)
// =============================================================

import { ChatMessage } from '../types';

const MAX_CONTEXT_TOKENS = 6000;

// Conservative multilingual token estimate:
// - Math.ceil(length / 2) is the base (conservative for ASCII)
// - TOKEN_ESTIMATE_MULTIPLIER adds safety margin for non-Latin scripts (e.g. Tamil = 2-4x tokens/char)
// - Net result with default MULTIPLIER=2: effectively length/1 — very conservative
const MULTIPLIER = parseFloat(process.env.TOKEN_ESTIMATE_MULTIPLIER ?? '2');

const estimateTokens = (text: string): number =>
    Math.ceil((text.length / 2) * MULTIPLIER);

export const trimContext = (messages: ChatMessage[]): ChatMessage[] => {
    const trimmed: ChatMessage[] = [];
    let totalTokens = 0;

    // Walk messages newest-first to keep most recent context
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const tokens = estimateTokens(msg.content);
        if (totalTokens + tokens > MAX_CONTEXT_TOKENS) break;
        trimmed.unshift(msg);
        totalTokens += tokens;
    }

    return trimmed;
};

export const estimateTotalTokens = (messages: ChatMessage[]): number =>
    messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
