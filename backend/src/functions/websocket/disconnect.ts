// =============================================================
// WebSocket $disconnect — clean up connection from DynamoDB
// =============================================================
import { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResult> => {
    try {
        await docClient.send(new DeleteCommand({
            TableName: process.env.DYNAMO_CONNECTIONS_TABLE!,
            Key: { connectionId: event.requestContext.connectionId },
        }));
        return { statusCode: 200, body: 'Disconnected' };
    } catch (err) {
        console.error('ws/$disconnect error:', err);
        return { statusCode: 500, body: 'Disconnect failed' };
    }
};
