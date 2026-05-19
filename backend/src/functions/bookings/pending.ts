// =============================================================
// GET /bookings/pending — Pending bookings for LabAssistant review
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    if (!['LabAssistant', 'LabIncharge'].includes(event.role)) {
        return respondError(403, 'Access denied.', event as unknown as APIGatewayProxyEvent);
    }
    try {
        const result = await docClient.send(new QueryCommand({
            TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
            IndexName: 'status-index',
            KeyConditionExpression: '#status = :pending',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':pending': 'PENDING' },
            ScanIndexForward: true,   // oldest first — FIFO review queue
        }));

        return respond(200, {
            bookings: result.Items ?? [],
            total: result.Count ?? 0,
        }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('bookings/pending error:', err);
        return respondError(500, 'Failed to fetch pending bookings.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
