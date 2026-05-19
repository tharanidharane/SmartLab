// =============================================================
// DELETE /equipment/{id} — Soft-delete (set status=RETIRED)
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { auditLog } from '../../middleware/auditLogger';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    if (event.role !== 'LabIncharge') {
        return respondError(403, 'Only Lab In-charge can retire equipment.', event as unknown as APIGatewayProxyEvent);
    }
    try {
        const equipmentId = event.pathParameters?.id;
        if (!equipmentId) return respondError(400, 'Missing equipment ID.', event as unknown as APIGatewayProxyEvent);

        const { Item } = await docClient.send(new GetCommand({
            TableName: process.env.DYNAMO_EQUIPMENT_TABLE!,
            Key: { equipmentId },
        }));
        if (!Item) return respondError(404, 'Equipment not found.', event as unknown as APIGatewayProxyEvent);
        if (Item.status === 'RETIRED') return respondError(409, 'Equipment is already retired.', event as unknown as APIGatewayProxyEvent);

        await docClient.send(new UpdateCommand({
            TableName: process.env.DYNAMO_EQUIPMENT_TABLE!,
            Key: { equipmentId },
            UpdateExpression: 'SET #st = :retired, updatedAt = :now',
            ExpressionAttributeNames: { '#st': 'status' },
            ExpressionAttributeValues: { ':retired': 'RETIRED', ':now': new Date().toISOString() },
        }));

        await auditLog({
            userId: event.userId,
            action: 'RETIRE_EQUIPMENT',
            resource: 'Equipment',
            resourceId: equipmentId,
        });

        return respond(200, { message: 'Equipment retired successfully.' }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('equipment/delete error:', err);
        return respondError(500, 'Failed to retire equipment.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
