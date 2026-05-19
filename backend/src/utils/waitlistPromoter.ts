// =============================================================
// waitlistPromoter — promotes next waitlisted booking on cancel
// =============================================================
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    QueryCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

export const promoteNextWaitlisted = async (
    equipmentId: string,
    date: string,
    slot: { startTime: string; endTime: string }
): Promise<string | null> => {
    // Query for waitlisted bookings on same equipment/date/slot, sorted by position
    const result = await docClient.send(new QueryCommand({
        TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
        IndexName: 'equipment-date-index',
        KeyConditionExpression: 'equipmentId = :eid AND #date = :date',
        FilterExpression: '#status = :waitlisted AND startTime = :start AND endTime = :end',
        ExpressionAttributeNames: { '#date': 'date', '#status': 'status' },
        ExpressionAttributeValues: {
            ':eid': equipmentId,
            ':date': date,
            ':waitlisted': 'WAITLISTED',
            ':start': slot.startTime,
            ':end': slot.endTime,
        },
    }));

    const items = result.Items ?? [];
    if (items.length === 0) return null;

    // Sort by waitlistPosition FIFO
    items.sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));
    const next = items[0];

    await docClient.send(new UpdateCommand({
        TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
        Key: { bookingId: next.bookingId, userId: next.userId },
        UpdateExpression: 'SET #status = :approved, updatedAt = :now REMOVE waitlistPosition',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
            ':approved': 'APPROVED',
            ':now': new Date().toISOString(),
        },
    }));

    return next.bookingId;
};
