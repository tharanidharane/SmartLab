// =============================================================
// POST /auth/logout — Cognito GlobalSignOut
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
    CognitoIdentityProviderClient,
    GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { respond, respondError } from '../../utils/response';

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const authHeader = event.headers.Authorization ?? event.headers.authorization ?? '';
        if (!authHeader.startsWith('Bearer ')) {
            return respondError(401, 'Missing token', event);
        }
        const accessToken = authHeader.slice(7);
        await cognito.send(new GlobalSignOutCommand({ AccessToken: accessToken }));
        return respond(200, { message: 'Logged out successfully.' }, event);
    } catch (err) {
        console.error('Logout error:', err);
        return respond(200, { message: 'Logged out.' }, event); // non-fatal
    }
};
