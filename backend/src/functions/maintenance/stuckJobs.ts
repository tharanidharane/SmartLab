/**
 * maintenance/stuckJobs.ts
 * EventBridge scheduled rule — runs every 5 minutes
 * Finds RUNNING forecast jobs older than 15 minutes and marks them FAILED.
 *
 * Fix 51: Uses the status-startedAt-index GSI (PK=status, SK=startedAt)
 * instead of a Table Scan to avoid full-table read charges.

 */
import { ScheduledHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    QueryCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Jobs older than 15 minutes without completion are considered stuck
const STUCK_THRESHOLD_MS = 15 * 60 * 1000;

export const handler: ScheduledHandler = async () => {
    const now = Date.now();
    const cutoff = new Date(now - STUCK_THRESHOLD_MS).toISOString();

    // Fix 51 — GSI: status-startedAt-index (matches ForecastJobs table in template.yaml)
    // status=RUNNING AND startedAt < cutoff — avoids full table scan
    const result = await db.send(new QueryCommand({
        TableName: process.env.DYNAMO_FORECAST_JOBS_TABLE!,
        IndexName: 'status-startedAt-index',
        KeyConditionExpression: '#s = :running AND startedAt < :cutoff',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':running': 'RUNNING', ':cutoff': cutoff },
        // Only fetch PK — we just need the jobId to update
        ProjectionExpression: 'jobId, startedAt',
    }));


    const stuckJobs = result.Items ?? [];
    console.log(`Found ${stuckJobs.length} stuck RUNNING job(s) older than 15 min`);

    await Promise.all(
        stuckJobs.map(item =>
            db.send(new UpdateCommand({
                TableName: process.env.DYNAMO_FORECAST_JOBS_TABLE!,
                Key: { jobId: item.jobId },
                UpdateExpression: 'SET #s = :failed, reason = :reason, completedAt = :now',
                ExpressionAttributeNames: { '#s': 'status' },
                ExpressionAttributeValues: {
                    ':failed': 'FAILED',
                    ':reason': 'Stuck job detected by maintenance routine (exceeded 15-min timeout)',
                    ':now': new Date().toISOString(),
                    ':running': 'RUNNING',
                },
                // Conditional — only update if still RUNNING (prevents race condition)
                ConditionExpression: '#s = :running',
            })).catch(err => {
                // ConditionalCheckFailedException means it completed naturally — fine to ignore
                if (err.name !== 'ConditionalCheckFailedException') console.error('stuckJobs update error:', err);
            })
        )
    );

    console.log(`stuckJobs: marked ${stuckJobs.length} job(s) as FAILED`);
};
