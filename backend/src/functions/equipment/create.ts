// =============================================================
// POST /equipment — Create new equipment (LabIncharge only)
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { FirehoseClient, PutRecordCommand } from '@aws-sdk/client-firehose';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { auditLog } from '../../middleware/auditLogger';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);
const firehose = new FirehoseClient({ region: process.env.AWS_REGION });

const schema = z.object({
    name: z.string().min(2).max(200),
    category: z.string().min(1).max(100),
    description: z.string().min(1).max(1000),
    location: z.string().min(1).max(200),
    maxBookingHours: z.number().min(1).max(8).default(4),
    requiresApproval: z.boolean().default(true),
    specifications: z.record(z.string()).optional(),
});

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    if (event.role !== 'LabIncharge') {
        return respondError(403, 'Only Lab In-charge can create equipment.', event as unknown as APIGatewayProxyEvent);
    }
    try {
        const body = schema.parse(JSON.parse(event.body ?? '{}'));
        const now = new Date().toISOString();
        const equipmentId = uuidv4();

        const item = {
            equipmentId,
            ...body,
            status: 'AVAILABLE',
            createdBy: event.userId,
            createdAt: now,
            updatedAt: now,
        };

        await docClient.send(new PutCommand({
            TableName: process.env.DYNAMO_EQUIPMENT_TABLE!,
            Item: item,
            ConditionExpression: 'attribute_not_exists(equipmentId)',
        }));

        await auditLog({
            userId: event.userId,
            action: 'CREATE_EQUIPMENT',
            resource: 'Equipment',
            resourceId: equipmentId,
            details: { name: body.name, category: body.category },
        });

        await firehose.send(new PutRecordCommand({
            DeliveryStreamName: 'smart-lab-usage-logs',
            Record: {
                Data: Buffer.from(JSON.stringify({
                    eventType: 'EQUIPMENT_CREATED', equipmentId, ...body,
                    createdBy: event.userId, timestamp: now,
                }) + '\n'),
            },
        })).catch(e => console.warn('Firehose log failed:', e));

        return respond(201, { equipment: item }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return respondError(400, `Validation error: ${err.errors.map(e => e.message).join(', ')}`, event as unknown as APIGatewayProxyEvent);
        }
        console.error('equipment/create error:', err);
        return respondError(500, 'Failed to create equipment.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
