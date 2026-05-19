// =============================================================
// GET /bookings/all — All bookings for LabIncharge overview
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'WAITLISTED', 'COMPLETED'];

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    if (!['LabAssistant', 'LabIncharge'].includes(event.role)) {
        return respondError(403, 'Access denied.', event as unknown as APIGatewayProxyEvent);
    }
    try {
        const { status = 'PENDING', limit = '50' } = event.queryStringParameters ?? {};
        if (!VALID_STATUSES.includes(status)) {
            return respondError(400, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, event as unknown as APIGatewayProxyEvent);
        }

        const result = await docClient.send(new QueryCommand({
            TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
            IndexName: 'status-index',
            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':status': status },
            ScanIndexForward: false,
            Limit: Math.min(parseInt(limit), 200),
        }));

        return respond(200, {
            bookings: result.Items ?? [],
            total: result.Count ?? 0,
            status,
        }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('bookings/all error:', err);
        return respondError(500, 'Failed to fetch bookings.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
