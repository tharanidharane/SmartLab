// =============================================================
// GET /analytics/forecast/status/:jobId — Poll ML forecast job status
// Null-safe: returns NOT_FOUND for TTL-expired records
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    try {
        const jobId = event.pathParameters?.jobId;
        if (!jobId) return respondError(400, 'Missing jobId.', event as unknown as APIGatewayProxyEvent);

        const { Item } = await docClient.send(new GetCommand({
            TableName: process.env.DYNAMO_FORECAST_JOBS_TABLE!,
            Key: { jobId },
        }));

        // Null-safe: DynamoDB TTL deletes records silently — GetItem returns null
        if (!Item) {
            return respond(200, {
                status: 'NOT_FOUND',
                message: 'Forecast job has expired or does not exist. Please run a new forecast.',
            }, event as unknown as APIGatewayProxyEvent);
        }

        return respond(200, {
            status: Item.status,
            startedAt: Item.startedAt,
            completedAt: Item.completedAt,
            reason: Item.reason,
            forecastData: Item.forecastData,
        }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('analytics/forecastStatus error:', err);
        return respondError(500, 'Failed to fetch forecast status.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
