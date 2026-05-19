// =============================================================
// AuditLogger — writes to DynamoDB SmartLab-AuditLogs
// =============================================================
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
});

export interface AuditEntry {
    userId: string;
    action: string;
    resource: string;
    resourceId: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
}

export const auditLog = async (entry: AuditEntry): Promise<void> => {
    const timestamp = new Date().toISOString();
    try {
        await docClient.send(new PutCommand({
            TableName: process.env.DYNAMO_AUDITLOGS_TABLE!,
            Item: {
                logId: uuidv4(),
                timestamp,
                userId: entry.userId,
                action: entry.action,
                resource: entry.resource,
                resourceId: entry.resourceId,
                details: entry.details ?? {},
                ipAddress: entry.ipAddress ?? 'unknown',
            },
        }));
    } catch (err) {
        // Non-fatal — log to CloudWatch but don't fail the main operation
        console.error('AuditLog write failed:', err);
    }
};
