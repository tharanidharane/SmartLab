// =============================================================
// POST /auth/ws-ticket — one-time 30-second WebSocket ticket
// Prevents token exposure in WS query params or CloudWatch logs
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { withAuth } from '../../middleware/auth';
import { respond } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    const ticket = uuidv4();
    const ttl = Math.floor(Date.now() / 1000) + 30; // 30-second expiry

    await docClient.send(new PutCommand({
        TableName: process.env.DYNAMO_CONNECTIONS_TABLE!,
        Item: {
            connectionId: `ticket#${ticket}`,
            userId: event.userId,
            role: event.role,
            used: false,
            ttl,
        },
    }));

    return respond(200, { ticket, expiresIn: 30 }, event as unknown as APIGatewayProxyEvent);
};

export const handler = (event: APIGatewayProxyEvent) =>
    withAuth(_handler)(event);
