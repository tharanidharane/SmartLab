// =============================================================
// respond() — Standard Lambda response helper with CORS headers
// Supports multiple origins (comma-separated ALLOWED_ORIGIN env)
// =============================================================
import { APIGatewayProxyEvent } from 'aws-lambda';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176')
    .split(',')
    .map(o => o.trim());

export const getCorsOrigin = (event: APIGatewayProxyEvent | { headers?: Record<string, string | undefined> }): string => {
    const requestOrigin = event.headers?.origin ?? event.headers?.Origin ?? '';
    return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
};

export const respond = (
    statusCode: number,
    body: unknown,
    event: APIGatewayProxyEvent | { headers?: Record<string, string | undefined> } = {}
) => ({
    statusCode,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': getCorsOrigin(event),
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*',
    },
    body: JSON.stringify(body),
});

export const respondError = (
    statusCode: number,
    message: string,
    event: APIGatewayProxyEvent | { headers?: Record<string, string | undefined> } = {}
) => respond(statusCode, { message, statusCode }, event);
