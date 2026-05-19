// =============================================================
// GET /bookings/{id} — Fetch a single booking by ID
// Used by Lab Assistant QR scanner to look up a scanned booking
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
    try {
        const bookingId = event.pathParameters?.id;
        if (!bookingId) return respondError(400, 'Missing booking ID.', event as unknown as APIGatewayProxyEvent);

        // Query via status-index to find the booking regardless of userId
        // Try each active status — APPROVED is most likely for check-in
        const statuses = ['APPROVED', 'PENDING', 'WAITLISTED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
        let booking = null;

        for (const status of statuses) {
            const result = await docClient.send(new QueryCommand({
                TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
                IndexName: 'status-index',
                KeyConditionExpression: '#s = :status',
                FilterExpression: 'bookingId = :bid',
                ExpressionAttributeNames: { '#s': 'status' },
                ExpressionAttributeValues: { ':status': status, ':bid': bookingId },
                Limit: 1,
            }));
            if (result.Items && result.Items.length > 0) {
                booking = result.Items[0];
                break;
            }
        }

        if (!booking) return respondError(404, 'Booking not found.', event as unknown as APIGatewayProxyEvent);

        // Students can only see their own bookings; lab staff can see any
        const isLabStaff = ['LabAssistant', 'LabIncharge'].includes(event.role);
        if (!isLabStaff && booking.userId !== event.userId) {
            return respondError(403, 'Access denied.', event as unknown as APIGatewayProxyEvent);
        }

        return respond(200, { booking }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('bookings/getById error:', err);
        return respondError(500, 'Failed to fetch booking.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
