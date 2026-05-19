import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    // Only Lab In-charge can view all users
    if (event.role !== 'LabIncharge') {
        return respondError(403, 'User management access restricted to Lab In-charge.', event as unknown as APIGatewayProxyEvent);
    }

    try {
        const result = await cognito.send(new ListUsersCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID!,
            Limit: 60,
        }));

        const users = (result.Users ?? []).map(u => {
            const attrs = Object.fromEntries(u.Attributes?.map(a => [a.Name, a.Value]) ?? []);
            return {
                userId: u.Username,
                email: attrs['email'],
                name: attrs['given_name'] ? `${attrs['given_name']} ${attrs['family_name'] || ''}`.trim() : (attrs['name'] || attrs['email']),
                role: attrs['custom:role'] || 'Student',
                department: attrs['custom:department'] || 'CSE',
                status: u.UserStatus,
            };
        });

        return respond(200, { users }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('users/list error:', err);
        return respondError(500, 'Failed to list users.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
