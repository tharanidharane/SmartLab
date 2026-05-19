// =============================================================
// GET /analytics/audit-logs — Audit trail for LabIncharge
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    if (event.role !== 'LabIncharge') {
        return respondError(403, 'Only Lab In-charge can view audit logs.', event as unknown as APIGatewayProxyEvent);
    }
    try {
        const { userId, action, limit = '50', lastKey } = event.queryStringParameters ?? {};

        let result;
        if (userId) {
            result = await docClient.send(new QueryCommand({
                TableName: process.env.DYNAMO_AUDITLOGS_TABLE!,
                IndexName: 'userId-index',
                KeyConditionExpression: 'userId = :uid',
                FilterExpression: action ? 'action = :action' : undefined,
                ExpressionAttributeValues: {
                    ':uid': userId,
                    ...(action ? { ':action': action } : {}),
                },
                ScanIndexForward: false,
                Limit: Math.min(parseInt(limit), 100),
                ExclusiveStartKey: lastKey
                    ? JSON.parse(Buffer.from(lastKey, 'base64').toString())
                    : undefined,
            }));
        } else {
            result = await docClient.send(new QueryCommand({
                TableName: process.env.DYNAMO_AUDITLOGS_TABLE!,
                IndexName: 'action-index',
                KeyConditionExpression: 'action = :action',
                ExpressionAttributeValues: { ':action': action ?? 'CREATE_BOOKING' },
                ScanIndexForward: false,
                Limit: Math.min(parseInt(limit), 100),
            }));
        }

        const paginationKey = result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
            : null;

        return respond(200, {
            logs: result.Items ?? [],
            lastKey: paginationKey,
            total: result.Count ?? 0,
        }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('analytics/auditLogs error:', err);
        return respondError(500, 'Failed to fetch audit logs.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
