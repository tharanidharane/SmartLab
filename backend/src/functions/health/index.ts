// =============================================================
// GET /health — Health check + EventBridge warm-up handler
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { respond } from '../../utils/response';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler = async (event: APIGatewayProxyEvent | { warmup?: boolean }): Promise<APIGatewayProxyResult | void> => {
    // EventBridge warm-up ping — just return; don't log
    if ((event as { warmup?: boolean }).warmup === true) return;

    try {
        await dynamo.send(new DescribeTableCommand({
            TableName: process.env.DYNAMO_EQUIPMENT_TABLE!,
        }));
        return respond(200, {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version ?? '1.0.0',
        }, event as APIGatewayProxyEvent);
    } catch {
        return respond(503, { status: 'degraded', timestamp: new Date().toISOString() }, event as APIGatewayProxyEvent);
    }
};
