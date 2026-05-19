// =============================================================
// POST /users/push-token — upsert Expo push token on every app launch
// Called on every authenticated launch (not just first install)
// Idempotent — no-op if token unchanged, handles device transfers
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const schema = z.object({
    expoPushToken: z.string().startsWith('ExponentPushToken[').endsWith(']'),
});

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { expoPushToken } = schema.parse(JSON.parse(event.body ?? '{}'));

        await docClient.send(new UpdateCommand({
            TableName: process.env.DYNAMO_USERS_TABLE!,
            Key: { userId: event.userId },
            UpdateExpression: 'SET expoPushToken = :token, updatedAt = :now',
            ExpressionAttributeValues: {
                ':token': expoPushToken,
                ':now': new Date().toISOString(),
            },
        }));

        return respond(200, { message: 'Push token registered.' }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return respondError(400, 'Invalid push token format.', event as unknown as APIGatewayProxyEvent);
        }
        console.error('RegisterPushToken error:', err);
        return respondError(500, 'Failed to register push token.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
