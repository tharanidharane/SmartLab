// =============================================================
// DynamoDB Stream Processor — sends push notifications on booking status changes
// Critical ordering: write notificationSent=true BEFORE sending push
// This prevents duplicate notifications on stream retry
// =============================================================
import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    UpdateCommand,
    GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { sendPushNotification } from '../../utils/sendPushNotification';

const dynClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynClient);
const lambda = new LambdaClient({ region: process.env.AWS_REGION });

const NOTIFY_STATUSES = ['APPROVED', 'REJECTED', 'WAITLISTED', 'CANCELLED'];

const processRecord = async (record: DynamoDBRecord): Promise<void> => {
    if (record.eventName !== 'MODIFY') return;

    const newImage = record.dynamodb?.NewImage;
    const oldImage = record.dynamodb?.OldImage;
    if (!newImage || !oldImage) return;

    const { unmarshall } = await import('@aws-sdk/util-dynamodb');
    const newItem = unmarshall(newImage as Parameters<typeof unmarshall>[0]);
    const oldItem = unmarshall(oldImage as Parameters<typeof unmarshall>[0]);

    // Only process status changes that we should notify on
    if (!NOTIFY_STATUSES.includes(newItem.status)) return;
    if (newItem.status === oldItem.status && newItem.notificationSent !== false) return;
    if (newItem.notificationSent === true) return;  // already sent

    const { bookingId, userId, equipmentName, status, rejectionReason } = newItem;

    // ── CRITICAL: Write flag BEFORE push (prevents duplicate on retry) ──
    try {
        await docClient.send(new UpdateCommand({
            TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
            Key: { bookingId, userId },
            UpdateExpression: 'SET notificationSent = :true',
            ConditionExpression: 'attribute_not_exists(notificationSent) OR notificationSent = :false',
            ExpressionAttributeValues: { ':true': true, ':false': false },
        }));
    } catch (err: unknown) {
        const errName = (err as { name?: string }).name;
        if (errName === 'ConditionalCheckFailedException') {
            // Another invocation already set the flag — skip silently
            console.log(`Notification already sent for booking ${bookingId}, skipping.`);
            return;
        }
        throw err;  // unexpected error — let DLQ catch it
    }

    // ── Fetch user's push token ──
    const { Item: user } = await docClient.send(new GetCommand({
        TableName: process.env.DYNAMO_USERS_TABLE!,
        Key: { userId },
    }));

    const notifBody = status === 'APPROVED'
        ? `Your booking for ${equipmentName} has been approved!`
        : status === 'REJECTED'
            ? `Your booking for ${equipmentName} was rejected. ${rejectionReason ?? ''}`
            : status === 'WAITLISTED'
                ? `You are on the waitlist for ${equipmentName}.`
                : `Your booking for ${equipmentName} has been cancelled.`;

    // ── Send WebSocket broadcast ──
    await lambda.send(new InvokeCommand({
        FunctionName: `smart-lab-ws-broadcast`,
        InvocationType: 'Event',
        Payload: JSON.stringify({
            targetUserId: userId,
            event: { type: 'BOOKING_STATUS_CHANGED', bookingId, status, equipmentName },
        }),
    })).catch(e => console.warn('WS broadcast failed:', e));

    // ── Send push if token exists ──
    if (user?.expoPushToken) {
        await sendPushNotification(userId, user.expoPushToken, {
            title: 'Booking Update',
            body: notifBody,
            data: { bookingId, status, screen: 'bookings' },
        });
    }
};

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
    const results = await Promise.allSettled(event.Records.map(processRecord));
    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            console.error(`Failed to process stream record ${i}:`, r.reason);
            throw r.reason;  // Causes partial batch failure + DLQ for this record
        }
    });
};
