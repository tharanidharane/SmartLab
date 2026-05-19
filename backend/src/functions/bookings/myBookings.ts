// =============================================================
// GET /bookings — Get current user's bookings
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const sortByNewest = <T extends { createdAt?: string }>(items: T[]) => (
    [...items].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
);

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { status, limit = '20', lastKey } = event.queryStringParameters ?? {};
        const parsedLimit = Number.parseInt(limit, 10);
        const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;

        let bookings: unknown[] = [];
        let paginationKey: string | null = null;

        try {
            const result = await docClient.send(new QueryCommand({
                TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
                IndexName: 'userId-index',
                KeyConditionExpression: 'userId = :uid',
                FilterExpression: status ? '#st = :status' : undefined,
                ExpressionAttributeNames: status ? { '#st': 'status' } : undefined,
                ExpressionAttributeValues: {
                    ':uid': event.userId,
                    ...(status ? { ':status': status } : {}),
                },
                Limit: safeLimit,
                ScanIndexForward: false,
                ExclusiveStartKey: lastKey ? JSON.parse(Buffer.from(lastKey, 'base64').toString()) : undefined,
            }));

            bookings = result.Items ?? [];
            paginationKey = result.LastEvaluatedKey
                ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
                : null;
        } catch (queryErr) {
            console.warn('bookings/my query failed, falling back to scan:', queryErr);

            const result = await docClient.send(new ScanCommand({
                TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
                FilterExpression: status ? 'userId = :uid AND #st = :status' : 'userId = :uid',
                ExpressionAttributeNames: status ? { '#st': 'status' } : undefined,
                ExpressionAttributeValues: {
                    ':uid': event.userId,
                    ...(status ? { ':status': status } : {}),
                },
            }));

            bookings = sortByNewest(result.Items ?? []).slice(0, safeLimit);
            paginationKey = null;
        }

        return respond(200, {
            bookings,
            lastKey: paginationKey,
        }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('bookings/my error:', err);
        return respondError(500, 'Failed to fetch bookings.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
