// =============================================================
// GET /equipment/{id}/slots — Available booking slots for a date
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

// Lab operating hours 8AM–8PM, 1-hour slots
const generateSlots = (date: string) => {
    const slots = [];
    for (let h = 8; h < 20; h++) {
        slots.push({
            date,
            startTime: `${String(h).padStart(2, '0')}:00`,
            endTime: `${String(h + 1).padStart(2, '0')}:00`,
        });
    }
    return slots;
};

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    try {
        const equipmentId = event.pathParameters?.id;
        const date = event.queryStringParameters?.date;
        if (!equipmentId) return respondError(400, 'Missing equipment ID.', event as unknown as APIGatewayProxyEvent);
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return respondError(400, 'Query param ?date=YYYY-MM-DD required.', event as unknown as APIGatewayProxyEvent);
        }

        // Fetch all APPROVED/PENDING bookings for this equipment on this date
        const result = await docClient.send(new QueryCommand({
            TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
            IndexName: 'equipment-date-index',
            KeyConditionExpression: 'equipmentId = :eid AND #date = :date',
            FilterExpression: '#status IN (:approved, :pending)',
            ExpressionAttributeNames: { '#date': 'date', '#status': 'status' },
            ExpressionAttributeValues: {
                ':eid': equipmentId,
                ':date': date,
                ':approved': 'APPROVED',
                ':pending': 'PENDING',
            },
        }));

        const bookedSlots = new Set(
            (result.Items ?? []).map(b => `${b.slot?.startTime}-${b.slot?.endTime}`)
        );

        const allSlots = generateSlots(date);
        const slots = allSlots.map(s => ({
            ...s,
            available: !bookedSlots.has(`${s.startTime}-${s.endTime}`),
        }));

        // Faculty get longer max booking duration
        const maxHours = event.role === 'Faculty' ? 4 : 2;

        return respond(200, { slots, maxHours, date, timezone: 'Asia/Kolkata' }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('equipment/slots error:', err);
        return respondError(500, 'Failed to fetch slots.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
