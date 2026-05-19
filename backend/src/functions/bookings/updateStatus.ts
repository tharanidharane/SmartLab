// =============================================================
// PUT /bookings/{id}/status — Approve/Reject/Waitlist booking
// DynamoDB Stream handles notifications (no direct push here)
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { auditLog } from '../../middleware/auditLogger';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const schema = z.object({
    status: z.enum(['APPROVED', 'REJECTED', 'WAITLISTED', 'COMPLETED']),
    rejectionReason: z.string().max(500).optional(),
});

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    if (!['LabAssistant', 'LabIncharge'].includes(event.role)) {
        return respondError(403, 'Only Lab staff can update booking status.', event as unknown as APIGatewayProxyEvent);
    }
    try {
        const bookingId = event.pathParameters?.id;
        if (!bookingId) return respondError(400, 'Missing booking ID.', event as unknown as APIGatewayProxyEvent);
        const { status, rejectionReason } = schema.parse(JSON.parse(event.body ?? '{}'));

        // Find booking across all possible statuses using status-index GSI
        const { QueryCommand: QC } = await import('@aws-sdk/lib-dynamodb');
        let booking: Record<string, any> | undefined;
        const allStatuses = ['PENDING', 'APPROVED', 'WAITLISTED', 'REJECTED', 'COMPLETED', 'CANCELLED'];
        for (const s of allStatuses) {
            const qResult = await docClient.send(new (QC)({
                TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
                IndexName: 'status-index',
                KeyConditionExpression: '#s = :s',
                FilterExpression: 'bookingId = :bid',
                ExpressionAttributeNames: { '#s': 'status' },
                ExpressionAttributeValues: { ':s': s, ':bid': bookingId },
            }));
            if (qResult.Items?.[0]) { booking = qResult.Items[0]; break; }
        }
        if (!booking) return respondError(404, 'Booking not found.', event as unknown as APIGatewayProxyEvent);

        const now = new Date().toISOString();
        await docClient.send(new UpdateCommand({
            TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
            Key: { bookingId: booking.bookingId, userId: booking.userId },
            UpdateExpression: 'SET #st = :status, approvedBy = :by, approvedAt = :now, updatedAt = :now, notificationSent = :false'
                + (rejectionReason ? ', rejectionReason = :reason' : ''),
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: {
                ':status': status,
                ':by': event.userId,
                ':now': now,
                ':false': false,
                ...(rejectionReason ? { ':reason': rejectionReason } : {}),
            },
        }));

        await auditLog({
            userId: event.userId,
            action: `BOOKING_${status}`,
            resource: 'Booking',
            resourceId: bookingId,
            details: { status, rejectionReason },
        });

        // Stream processor will fire notification automatically
        return respond(200, { message: `Booking ${status.toLowerCase()}.`, bookingId }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        if (err instanceof z.ZodError) return respondError(400, err.errors[0].message, event as unknown as APIGatewayProxyEvent);
        console.error('bookings/updateStatus error:', err);
        return respondError(500, 'Failed to update booking status.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
