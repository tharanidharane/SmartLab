/**
 * GET /analytics/forecast
 * Lists all completed forecast results — most recent job per equipment.
 * Returns the forecast data array from the latest COMPLETED ForecastJob.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Query the most recent COMPLETED jobs via status-index GSI
        const result = await db.send(new QueryCommand({
            TableName: process.env.DYNAMO_FORECAST_JOBS_TABLE!,
            IndexName: 'status-index',
            KeyConditionExpression: '#s = :completed',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: { ':completed': 'COMPLETED' },
            ScanIndexForward: false, // newest first
            Limit: 10,
        }));

        const jobs = result.Items ?? [];

        // Parse forecastData from each job — null-safe
        const forecasts = jobs.map(job => {
            let forecastData: unknown[] = [];
            if (job.forecastData) {
                try {
                    forecastData = typeof job.forecastData === 'string'
                        ? JSON.parse(job.forecastData)
                        : job.forecastData;
                } catch {
                    forecastData = [];
                }
            }
            return {
                jobId: job.jobId ?? null,
                status: job.status ?? 'COMPLETED',
                createdAt: job.createdAt ?? null,
                completedAt: job.completedAt ?? null,
                forecastData,
            };
        });

        return respond(200, {
            forecasts,
            count: forecasts.length,
        }, event as unknown as APIGatewayProxyEvent);

    } catch (err) {
        console.error('analytics/forecast GET error:', err);
        return respondError(500, 'Failed to fetch forecast data.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
