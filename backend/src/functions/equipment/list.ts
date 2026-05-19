// =============================================================
// GET /equipment — List all equipment with optional filters
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    ScanCommand,
    QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { category, status, search } = event.queryStringParameters ?? {};

        let items;
        if (category) {
            const result = await docClient.send(new QueryCommand({
                TableName: process.env.DYNAMO_EQUIPMENT_TABLE!,
                IndexName: 'category-index',
                KeyConditionExpression: 'category = :cat',
                FilterExpression: status ? '#st = :status' : undefined,
                ExpressionAttributeNames: status ? { '#st': 'status' } : undefined,
                ExpressionAttributeValues: {
                    ':cat': category,
                    ...(status ? { ':status': status } : {}),
                },
            }));
            items = result.Items ?? [];
        } else {
            const scanParams: Parameters<typeof docClient.send>[0] extends ScanCommand ? never : ConstructorParameters<typeof ScanCommand>[0] = {
                TableName: process.env.DYNAMO_EQUIPMENT_TABLE!,
            };
            if (status) {
                Object.assign(scanParams, {
                    FilterExpression: '#st = :status',
                    ExpressionAttributeNames: { '#st': 'status' },
                    ExpressionAttributeValues: { ':status': status },
                });
            }
            const result = await docClient.send(new ScanCommand(scanParams));
            items = result.Items ?? [];
        }

        // Client-side search filter
        if (search) {
            const q = search.toLowerCase();
            items = items.filter(i =>
                i.name?.toLowerCase().includes(q) ||
                i.description?.toLowerCase().includes(q) ||
                i.location?.toLowerCase().includes(q)
            );
        }

        return respond(200, { items, total: items.length }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('equipment/list error:', err);
        return respondError(500, 'Failed to fetch equipment.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
