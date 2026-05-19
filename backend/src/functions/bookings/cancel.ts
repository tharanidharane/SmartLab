// =============================================================
// DELETE /bookings/{id} — Cancel a booking (owner or staff)
// Promotes next waitlisted booking on successful cancel
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { auditLog } from '../../middleware/auditLogger';
import { promoteNextWaitlisted } from '../../utils/waitlistPromoter';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    try {
        const bookingId = event.pathParameters?.id;
        if (!bookingId) return respondError(400, 'Missing booking ID.', event as unknown as APIGatewayProxyEvent);

        // Look up booking by bookingId
        const result = await docClient.send(new QueryCommand({
            TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
            IndexName: 'userId-index',
            KeyConditionExpression: 'userId = :uid',
            FilterExpression: 'bookingId = :bid',
            ExpressionAttributeValues: { ':uid': event.userId, ':bid': bookingId },
        }));

        let booking = result.Items?.[0];

        // Staff can cancel any booking
        if (!booking && ['LabAssistant', 'LabIncharge'].includes(event.role)) {
            const staffResult = await docClient.send(new QueryCommand({
                TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
                IndexName: 'status-index',
                KeyConditionExpression: '#s IN (:p, :a)',
                FilterExpression: 'bookingId = :bid',
                ExpressionAttributeNames: { '#s': 'status' },
                ExpressionAttributeValues: { ':p': 'PENDING', ':a': 'APPROVED', ':bid': bookingId },
            }));
            booking = staffResult.Items?.[0];
        }

        if (!booking) return respondError(404, 'Booking not found.', event as unknown as APIGatewayProxyEvent);
        if (['CANCELLED', 'COMPLETED'].includes(booking.status)) {
            return respondError(409, 'Booking cannot be cancelled in its current state.', event as unknown as APIGatewayProxyEvent);
        }

        await docClient.send(new UpdateCommand({
            TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
            Key: { bookingId: booking.bookingId, userId: booking.userId },
            UpdateExpression: 'SET #st = :cancelled, updatedAt = :now, notificationSent = :false',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: {
                ':cancelled': 'CANCELLED',
                ':now': new Date().toISOString(),
                ':false': false,
            },
        }));

        // Promote next waitlisted booking for this slot
        const promoted = await promoteNextWaitlisted(
            booking.equipmentId,
            booking.slot?.date ?? booking.date,
            { startTime: booking.slot?.startTime ?? booking.startTime, endTime: booking.slot?.endTime ?? booking.endTime }
        );

        await auditLog({
            userId: event.userId,
            action: 'CANCEL_BOOKING',
            resource: 'Booking',
            resourceId: bookingId,
            details: { promoted },
        });

        return respond(200, {
            message: 'Booking cancelled.',
            promotedBookingId: promoted,
        }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('bookings/cancel error:', err);
        return respondError(500, 'Failed to cancel booking.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
