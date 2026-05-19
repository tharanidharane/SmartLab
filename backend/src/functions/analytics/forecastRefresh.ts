// =============================================================
// POST /analytics/forecast/refresh — Kick off async ML forecast
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { v4 as uuidv4 } from 'uuid';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);
const lambda = new LambdaClient({ region: process.env.AWS_REGION });

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    if (event.role !== 'LabIncharge') {
        return respondError(403, 'Only Lab In-charge can trigger forecast refresh.', event as unknown as APIGatewayProxyEvent);
    }
    try {
        const jobId = uuidv4();
        const now = new Date().toISOString();
        const ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7-day TTL

        await docClient.send(new PutCommand({
            TableName: process.env.DYNAMO_FORECAST_JOBS_TABLE!,
            Item: { jobId, status: 'STARTED', startedAt: now, ttl },
        }));

        // Fire-and-forget: invoke ML Lambda asynchronously
        // In local dev the ML Lambda won't exist — skip gracefully
        try {
            await lambda.send(new InvokeCommand({
                FunctionName: 'smart-lab-ml-forecast',
                InvocationType: 'Event',  // async — no wait
                Payload: JSON.stringify({ jobId, trigger: 'manual' }),
            }));
        } catch (lambdaErr) {
            console.warn('ML Lambda invoke skipped (not available locally):', (lambdaErr as Error).message);
            // Mark job as failed immediately so the UI doesn't poll forever
            await docClient.send(new PutCommand({
                TableName: process.env.DYNAMO_FORECAST_JOBS_TABLE!,
                Item: {
                    jobId, status: 'FAILED',
                    startedAt: now,
                    reason: 'ML Lambda not available in local dev environment.',
                    ttl,
                },
            }));
        }

        return respond(202, {
            jobId,
            message: 'Forecast job started. Poll /analytics/forecast/status/:jobId for progress.',
            pollUrl: `/analytics/forecast/status/${jobId}`,
        }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('analytics/forecastRefresh error:', err);
        return respondError(500, 'Failed to start forecast job.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
