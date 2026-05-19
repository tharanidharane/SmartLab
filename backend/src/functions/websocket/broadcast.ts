// =============================================================
// WebSocket Broadcaster — sends events to connected clients
// Invoked async by stream processor and status update handlers
// Handles stale 410 connections by pruning them from DynamoDB
// =============================================================
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    QueryCommand,
    DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';

const dynClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynClient);

interface BroadcastPayload {
    targetUserId?: string;  // null = broadcast to all
    event: Record<string, unknown>;
}

export const handler = async (payload: BroadcastPayload): Promise<void> => {
    const { targetUserId, event } = payload;

    const apiGw = new ApiGatewayManagementApiClient({
        endpoint: process.env.WEBSOCKET_ENDPOINT!,
    });

    // Fetch connections for this specific user
    let connections: { connectionId: string }[] = [];
    if (targetUserId) {
        const result = await docClient.send(new QueryCommand({
            TableName: process.env.DYNAMO_CONNECTIONS_TABLE!,
            IndexName: 'userId-index',
            KeyConditionExpression: 'userId = :uid',
            ExpressionAttributeValues: { ':uid': targetUserId },
        }));
        connections = (result.Items ?? []) as { connectionId: string }[];
    }

    const message = Buffer.from(JSON.stringify(event));

    await Promise.allSettled(connections.map(async ({ connectionId }) => {
        try {
            await apiGw.send(new PostToConnectionCommand({
                ConnectionId: connectionId,
                Data: message,
            }));
        } catch (err: unknown) {
            const statusCode = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
            if (statusCode === 410) {
                // Stale connection — prune it
                await docClient.send(new DeleteCommand({
                    TableName: process.env.DYNAMO_CONNECTIONS_TABLE!,
                    Key: { connectionId },
                }));
                console.log(`Pruned stale WS connection: ${connectionId}`);
            } else {
                console.error(`WS send failed for ${connectionId}:`, err);
            }
        }
    }));
};
