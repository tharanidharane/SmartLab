// =============================================================
// POST /auth/login — Cognito InitiateAuth
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { z } from 'zod';
import { respond, respondError } from '../../utils/response';

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (event.body === '{"warmup":true}') return respond(200, { status: 'warm' }, event);

        console.log('RAW EVENT BODY TYPE:', typeof event.body);
        console.log('RAW EVENT BODY:', event.body);
        console.log('IS BASE64:', event.isBase64Encoded);

        const rawBody = event.isBase64Encoded && event.body
            ? Buffer.from(event.body, 'base64').toString('utf8')
            : event.body;

        console.log('DECODED BODY:', rawBody);

        const parsedBody = typeof rawBody === 'string' ? JSON.parse(rawBody || '{}') : (rawBody || {});
        const { email, password } = schema.parse(parsedBody);

        const result = await cognito.send(new InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: process.env.COGNITO_CLIENT_ID!,
            AuthParameters: { USERNAME: email, PASSWORD: password },
        }));

        const tokens = result.AuthenticationResult;
        if (!tokens) return respondError(401, 'Authentication failed.', event);

        return respond(200, {
            accessToken: tokens.AccessToken,
            refreshToken: tokens.RefreshToken,
            idToken: tokens.IdToken,
            expiresIn: tokens.ExpiresIn,
        }, event);
    } catch (err: unknown) {
        const errorName = typeof err === 'object' && err !== null && 'name' in err
            ? String((err as { name?: unknown }).name)
            : '';
        const msg = err instanceof Error ? err.message : String(err ?? '');

        if (
            errorName === 'NotAuthorizedException'
            || errorName === 'UserNotFoundException'
            || msg.includes('NotAuthorizedException')
            || msg.includes('UserNotFoundException')
            || msg.includes('User does not exist')
        ) {
            return respondError(401, 'Invalid email or password.', event);
        }
        if (errorName === 'UserNotConfirmedException' || msg.includes('UserNotConfirmedException')) {
            return respondError(403, 'Please verify your email before logging in.', event);
        }
        if (errorName === 'InvalidParameterException' && msg.includes('USER_PASSWORD_AUTH')) {
            return respondError(500, 'Auth flow USER_PASSWORD_AUTH is not enabled for this Cognito app client.', event);
        }
        console.error('Login error:', err);
        return respondError(500, 'Login failed. Please try again.', event);
    }
};
