import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    // Only Lab In-charge can modify roles
    if (event.role !== 'LabIncharge') {
        return respondError(403, 'Role management restricted to Lab In-charge.', event as unknown as APIGatewayProxyEvent);
    }

    const targetUserId = event.pathParameters?.id;
    if (!targetUserId) return respondError(400, 'User ID is required.', event as unknown as APIGatewayProxyEvent);

    let body;
    try {
        body = JSON.parse(event.body ?? '{}');
    } catch {
        return respondError(400, 'Invalid JSON body.', event as unknown as APIGatewayProxyEvent);
    }

    const { role } = body;
    if (!['Student', 'Faculty', 'Researcher', 'LabAssistant', 'LabIncharge'].includes(role)) {
        return respondError(400, 'Invalid role provided.', event as unknown as APIGatewayProxyEvent);
    }

    try {
        await cognito.send(new AdminUpdateUserAttributesCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID!,
            Username: targetUserId,
            UserAttributes: [
                { Name: 'custom:role', Value: role },
            ],
        }));

        return respond(200, { message: `Role updated to ${role}.` }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('users/updateRole error:', err);
        return respondError(500, 'Failed to update user role.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
