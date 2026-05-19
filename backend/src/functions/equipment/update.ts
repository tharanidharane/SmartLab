// =============================================================
// PUT /equipment/{id} — Update equipment (LabIncharge only)
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { auditLog } from '../../middleware/auditLogger';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const schema = z.object({
    name: z.string().min(1).max(200).optional(),
    category: z.string().min(1).max(100).optional(),
    description: z.string().min(1).max(1000).optional(),
    status: z.enum(['AVAILABLE', 'UNDER_MAINTENANCE', 'RETIRED']).optional(),
    location: z.string().min(1).max(200).optional(),
    maxBookingHours: z.number().min(1).max(8).optional(),
    requiresApproval: z.boolean().optional(),
    specifications: z.record(z.string()).optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: 'At least one field required.' });

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    if (event.role !== 'LabIncharge') {
        return respondError(403, 'Only Lab In-charge can update equipment.', event as unknown as APIGatewayProxyEvent);
    }
    try {
        const equipmentId = event.pathParameters?.id;
        if (!equipmentId) return respondError(400, 'Missing equipment ID.', event as unknown as APIGatewayProxyEvent);

        // Verify equipment exists
        const { Item } = await docClient.send(new GetCommand({
            TableName: process.env.DYNAMO_EQUIPMENT_TABLE!,
            Key: { equipmentId },
        }));
        if (!Item) return respondError(404, 'Equipment not found.', event as unknown as APIGatewayProxyEvent);

        const body = schema.parse(JSON.parse(event.body ?? '{}'));
        const now = new Date().toISOString();

        // Build dynamic update expression
        const updates = Object.entries(body);
        const setExpr = updates.map(([k]) => `#${k} = :${k}`).join(', ');
        const names: Record<string, string> = Object.fromEntries(updates.map(([k]) => [`#${k}`, k]));
        const values: Record<string, unknown> = Object.fromEntries(updates.map(([k, v]) => [`:${k}`, v]));
        names['#ua'] = 'updatedAt'; values[':ua'] = now;

        await docClient.send(new UpdateCommand({
            TableName: process.env.DYNAMO_EQUIPMENT_TABLE!,
            Key: { equipmentId },
            UpdateExpression: `SET ${setExpr}, #ua = :ua`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
        }));

        await auditLog({
            userId: event.userId,
            action: 'UPDATE_EQUIPMENT',
            resource: 'Equipment',
            resourceId: equipmentId,
            details: body as Record<string, unknown>,
        });

        return respond(200, { message: 'Equipment updated.', equipmentId }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        if (err instanceof z.ZodError) return respondError(400, err.errors[0].message, event as unknown as APIGatewayProxyEvent);
        console.error('equipment/update error:', err);
        return respondError(500, 'Failed to update equipment.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
