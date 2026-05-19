// =============================================================
// WebSocket $connect — validates one-time ticket, stores connection
// =============================================================
import { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand,
    PutCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResult> => {
    try {
        const ticket = (event as any).queryStringParameters?.ticket;
        if (!ticket) return { statusCode: 401, body: 'Missing ticket' };

        const ticketKey = `ticket#${ticket}`;
        const { Item } = await docClient.send(new GetCommand({
            TableName: process.env.DYNAMO_CONNECTIONS_TABLE!,
            Key: { connectionId: ticketKey },
        }));

        if (!Item) return { statusCode: 401, body: 'Invalid ticket' };
        if (Item.used) return { statusCode: 401, body: 'Ticket already used' };
        if (Item.ttl < Math.floor(Date.now() / 1000)) {
            return { statusCode: 401, body: 'Ticket expired' };
        }

        // Mark ticket as used (atomic — prevents replay)
        await docClient.send(new UpdateCommand({
            TableName: process.env.DYNAMO_CONNECTIONS_TABLE!,
            Key: { connectionId: ticketKey },
            UpdateExpression: 'SET used = :true',
            ConditionExpression: 'used = :false',
            ExpressionAttributeValues: { ':true': true, ':false': false },
        }));

        // Store the real WebSocket connection
        const ttl = Math.floor(Date.now() / 1000) + 2 * 60 * 60; // 2-hour TTL
        await docClient.send(new PutCommand({
            TableName: process.env.DYNAMO_CONNECTIONS_TABLE!,
            Item: {
                connectionId: event.requestContext.connectionId,
                userId: Item.userId,
                role: Item.role,
                connectedAt: new Date().toISOString(),
                ttl,
            },
        }));

        return { statusCode: 200, body: 'Connected' };
    } catch (err: unknown) {
        const errName = (err as { name?: string }).name;
        if (errName === 'ConditionalCheckFailedException') {
            return { statusCode: 401, body: 'Ticket already used' };
        }
        console.error('ws/$connect error:', err);
        return { statusCode: 500, body: 'Connection failed' };
    }
};
