// =============================================================
// promptSanitizer — strips injection patterns from user input
// Used for booking purpose field and GenAI chat messages
// =============================================================

const BLOCKED_PATTERNS = [
    /ignore previous instructions/gi,
    /forget all previous/gi,
    /system prompt/gi,
    /<script[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,        // onerror=, onclick=, etc.
    /\{\{.*?\}\}/g,       // template injection
    /\$\{.*?\}/g,         // JS template literals injection
    /SELECT\s+.*FROM/gi,  // SQL injection
    /DROP\s+TABLE/gi,
    /INSERT\s+INTO/gi,
    /UNION\s+SELECT/gi,
];

const MAX_LENGTH = 500;

export const sanitizePrompt = (input: string): string => {
    let sanitized = input.trim().slice(0, MAX_LENGTH);
    for (const pattern of BLOCKED_PATTERNS) {
        sanitized = sanitized.replace(pattern, '[REMOVED]');
    }
    return sanitized;
};

export const sanitizeChatMessage = (input: string): string => {
    // Allow longer messages for chat (2000 chars) but still strip injections
    let sanitized = input.trim().slice(0, 2000);
    for (const pattern of BLOCKED_PATTERNS) {
        sanitized = sanitized.replace(pattern, '[REMOVED]');
    }
    return sanitized;
};
