// =============================================================
// POST /bookings — Create a booking (Student/Faculty)
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { FirehoseClient, PutRecordCommand } from '@aws-sdk/client-firehose';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { auditLog } from '../../middleware/auditLogger';
import { sanitizePrompt } from '../../utils/promptSanitizer';
import { AuthenticatedEvent } from '../../types';

const dynClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynClient);
const firehose = new FirehoseClient({ region: process.env.AWS_REGION });

const schema = z.object({
    equipmentId: z.string().uuid(),
    slot: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        timezone: z.string().default('Asia/Kolkata'),
    }),
    purpose: z.string().min(10).max(500),
    notes: z.string().max(300).optional(),
});

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    if (!['Student', 'Faculty'].includes(event.role)) {
        return respondError(403, 'Only students and faculty can create bookings.', event as unknown as APIGatewayProxyEvent);
    }
    try {
        const body = schema.parse(JSON.parse(event.body ?? '{}'));
        body.purpose = sanitizePrompt(body.purpose);

        // Verify equipment exists and is available
        const { Item: equip } = await docClient.send(new GetCommand({
            TableName: process.env.DYNAMO_EQUIPMENT_TABLE!,
            Key: { equipmentId: body.equipmentId },
        }));
        if (!equip) return respondError(404, 'Equipment not found.', event as unknown as APIGatewayProxyEvent);
        if (equip.status !== 'AVAILABLE') return respondError(409, 'Equipment is not available for booking.', event as unknown as APIGatewayProxyEvent);

        // Enforce max booking hours by role
        const maxHours = event.role === 'Faculty' ? 8 : 4;
        const [sh, sm] = body.slot.startTime.split(':').map(Number);
        const [eh, em] = body.slot.endTime.split(':').map(Number);
        const durationHours = (eh * 60 + em - sh * 60 - sm) / 60;
        if (durationHours > maxHours) {
            return respondError(400, `Max booking duration is ${maxHours} hours for your role.`, event as unknown as APIGatewayProxyEvent);
        }

        // Check for slot conflict → may create waitlist
        const existing = await docClient.send(new QueryCommand({
            TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
            IndexName: 'equipment-date-index',
            KeyConditionExpression: 'equipmentId = :eid AND #date = :date',
            FilterExpression: '#status IN (:approved, :pending) AND startTime = :st AND endTime = :et',
            ExpressionAttributeNames: { '#date': 'date', '#status': 'status' },
            ExpressionAttributeValues: {
                ':eid': body.equipmentId,
                ':date': body.slot.date,
                ':approved': 'APPROVED',
                ':pending': 'PENDING',
                ':st': body.slot.startTime,
                ':et': body.slot.endTime,
            },
        }));

        const isConflict = (existing.Items?.length ?? 0) > 0;
        const waitlistItems = await docClient.send(new QueryCommand({
            TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
            IndexName: 'equipment-date-index',
            KeyConditionExpression: 'equipmentId = :eid AND #date = :date',
            FilterExpression: '#status = :waitlisted',
            ExpressionAttributeNames: { '#date': 'date', '#status': 'status' },
            ExpressionAttributeValues: {
                ':eid': body.equipmentId, ':date': body.slot.date, ':waitlisted': 'WAITLISTED',
            },
        }));
        const waitlistPosition = isConflict ? (waitlistItems.Items?.length ?? 0) + 1 : undefined;

        const now = new Date().toISOString();
        const bookingId = uuidv4();
        const status = isConflict ? 'WAITLISTED' : (equip.requiresApproval ? 'PENDING' : 'APPROVED');

        const booking = {
            bookingId,
            userId: event.userId,
            userEmail: event.email,
            equipmentId: body.equipmentId,
            equipmentName: equip.name,
            status,
            slot: body.slot,
            purpose: body.purpose,
            notes: body.notes,
            waitlistPosition,
            notificationSent: false,
            createdAt: now,
            updatedAt: now,
            // GSI support fields
            date: body.slot.date,
            startTime: body.slot.startTime,
            endTime: body.slot.endTime,
        };

        await docClient.send(new PutCommand({
            TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
            Item: booking,
        }));

        await auditLog({
            userId: event.userId,
            action: 'CREATE_BOOKING',
            resource: 'Booking',
            resourceId: bookingId,
            details: { equipmentId: body.equipmentId, status, slot: body.slot },
        });

        await firehose.send(new PutRecordCommand({
            DeliveryStreamName: 'smart-lab-usage-logs',
            Record: {
                Data: Buffer.from(JSON.stringify({
                    eventType: 'BOOKING_CREATED', bookingId, userId: event.userId,
                    equipmentId: body.equipmentId, status, slot: body.slot, timestamp: now,
                }) + '\n'),
            },
        })).catch(e => console.warn('Firehose log failed:', e));

        return respond(201, { booking }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        if (err instanceof z.ZodError) return respondError(400, err.errors[0].message, event as unknown as APIGatewayProxyEvent);
        console.error('bookings/create error:', err);
        return respondError(500, 'Failed to create booking.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
