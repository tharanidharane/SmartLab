// =============================================================
// POST /auth/register — Cognito SignUp
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { z } from 'zod';
import { respond, respondError } from '../../utils/response';

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2).max(100),
    department: z.string().min(2).max(100),
    role: z.enum(['Student', 'Faculty', 'LabAssistant', 'LabIncharge']).default('Student')
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const body = schema.parse(JSON.parse(event.body ?? '{}'));

        // Use Admin API to create user, set custom attributes, and auto-verify email
        await cognito.send(new AdminCreateUserCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID!,
            Username: body.email,
            UserAttributes: [
                { Name: 'email', Value: body.email },
                { Name: 'name', Value: body.name },
                { Name: 'custom:department', Value: body.department },
                { Name: 'custom:role', Value: body.role },
                { Name: 'email_verified', Value: 'true' }
            ],
            MessageAction: 'SUPPRESS' // Do not send email
        }));

        // Immediately set a permanent password
        await cognito.send(new AdminSetUserPasswordCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID!,
            Username: body.email,
            Password: body.password,
            Permanent: true
        }));

        return respond(201, {
            message: 'Registration successful!',
        }, event);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Registration failed';
        if (msg.includes('UsernameExistsException')) {
            return respondError(409, 'An account with this email already exists.', event);
        }
        if (msg.includes('ZodError') || msg.includes('parse')) {
            return respondError(400, 'Invalid request body.', event);
        }
        console.error('Register error:', err);
        return respondError(500, 'Registration failed. Please try again.', event);
    }
};
