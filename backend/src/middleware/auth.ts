// =============================================================
// JWT Auth Middleware — verifies Cognito JWT and extracts role
// In production: uses aws-jwt-verify (remote JWKS signature check)
// In development: decodes JWT locally (no network call needed)
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { JwtPayload, AuthenticatedEvent, Role } from '../types';
import { respondError } from '../utils/response';

const IS_LOCAL = process.env.NODE_ENV === 'development';

// Production verifier (fetches JWKS from Cognito — requires network)
const verifier = IS_LOCAL ? null : CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID!,
    tokenUse: 'id',
    clientId: process.env.COGNITO_CLIENT_ID!,
});

/**
 * Decode + locally validate a JWT without fetching remote JWKS.
 * Used in local dev to avoid network calls to Cognito.
 * Validates: expiry, issuer, audience — skips signature check.
 */
function decodeJwtLocally(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed JWT');

    const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8')
    ) as JwtPayload & { exp: number; iss: string; aud: string };

    // Validate expiry
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
        throw new Error('Token expired');
    }

    // Validate issuer matches our Cognito User Pool
    const expectedIss = `https://cognito-idp.${process.env.AWS_REGION ?? 'us-east-1'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`;
    if (payload.iss && payload.iss !== expectedIss) {
        throw new Error(`Invalid issuer: ${payload.iss}`);
    }

    // Validate audience matches our App Client ID
    if (payload.aud && payload.aud !== process.env.COGNITO_CLIENT_ID) {
        throw new Error(`Invalid audience: ${payload.aud}`);
    }

    return payload;
}

type Handler = (
    event: AuthenticatedEvent
) => Promise<APIGatewayProxyResult>;

export const withAuth = (handler: Handler, requiredRoles?: Role[]) => {
    return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
        try {
            const authHeader = event.headers.Authorization ?? event.headers.authorization ?? '';
            if (!authHeader.startsWith('Bearer ')) {
                return respondError(401, 'Missing authorization token', event);
            }
            const token = authHeader.slice(7);

            let payload: JwtPayload;
            if (IS_LOCAL) {
                // Local dev: decode without remote JWKS fetch
                payload = decodeJwtLocally(token);
            } else {
                // Production: full cryptographic verification
                payload = await verifier!.verify(token) as unknown as JwtPayload;
            }

            const role = payload['custom:role'] as Role;
            if (requiredRoles && !requiredRoles.includes(role)) {
                return respondError(403, `Access denied. Required roles: ${requiredRoles.join(', ')}`, event);
            }

            const authEvent: AuthenticatedEvent = {
                userId: payload.sub,
                email: payload.email,
                role,
                department: payload['custom:department'],
                headers: event.headers,
                pathParameters: event.pathParameters ?? undefined,
                queryStringParameters: event.queryStringParameters ?? undefined,
                path: event.path,
                resource: event.resource,
                body: event.body ?? undefined,
            };

            return await handler(authEvent);
        } catch (err) {
            console.error('Auth error:', err);
            return respondError(401, 'Invalid or expired token', event);
        }
    };
};
