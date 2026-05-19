// =============================================================
// POST /auth/refresh — Cognito token refresh
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { z } from 'zod';
import { respond, respondError } from '../../utils/response';

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

const schema = z.object({ refreshToken: z.string().min(1) });

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { refreshToken } = schema.parse(JSON.parse(event.body ?? '{}'));

        const result = await cognito.send(new InitiateAuthCommand({
            AuthFlow: 'REFRESH_TOKEN_AUTH',
            ClientId: process.env.COGNITO_CLIENT_ID!,
            AuthParameters: { REFRESH_TOKEN: refreshToken },
        }));

        const tokens = result.AuthenticationResult;
        if (!tokens) return respondError(401, 'Token refresh failed.', event);

        return respond(200, {
            accessToken: tokens.AccessToken,
            idToken: tokens.IdToken,
            expiresIn: tokens.ExpiresIn,
        }, event);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('NotAuthorizedException')) {
            return respondError(401, 'Refresh token expired. Please log in again.', event);
        }
        return respondError(500, 'Token refresh failed.', event);
    }
};
