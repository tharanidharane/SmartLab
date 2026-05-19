// =============================================================
// analytics/usageCap.ts — Bedrock monthly token usage enforcer
// Uses DynamoDB SmartLab-UsageMetrics with month TTL
// =============================================================
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const CAP = parseInt(process.env.BEDROCK_TOKEN_CAP_MONTHLY ?? '100000');

const getYearMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

const getMonthTTL = (): number => {
    const now = new Date();
    // TTL = first second of the next month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return Math.floor(nextMonth.getTime() / 1000);
};

export interface UsageCheckResult {
    allowed: boolean;
    used: number;
    limit: number;
    resetsAt: string;
}

export const checkUsage = async (userId: string): Promise<UsageCheckResult> => {
    const yearMonth = getYearMonth();
    const { Item } = await docClient.send(new GetCommand({
        TableName: process.env.DYNAMO_USAGE_METRICS_TABLE!,
        Key: { userId, yearMonth },
    }));
    const used = (Item?.tokenCount ?? 0) as number;
    const resetsAt = new Date(getMonthTTL() * 1000).toISOString().slice(0, 10);
    return { allowed: used < CAP, used, limit: CAP, resetsAt };
};

export const incrementUsage = async (userId: string, tokens: number): Promise<number> => {
    const yearMonth = getYearMonth();
    const result = await docClient.send(new UpdateCommand({
        TableName: process.env.DYNAMO_USAGE_METRICS_TABLE!,
        Key: { userId, yearMonth },
        UpdateExpression: 'ADD tokenCount :n SET #ttl = if_not_exists(#ttl, :ttl)',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: { ':n': tokens, ':ttl': getMonthTTL() },
        ReturnValues: 'UPDATED_NEW',
    }));
    return result.Attributes?.tokenCount as number ?? 0;
};

export const getUsageSummary = async (userId: string) => {
    const yearMonth = getYearMonth();
    const { Item } = await docClient.send(new GetCommand({
        TableName: process.env.DYNAMO_USAGE_METRICS_TABLE!,
        Key: { userId, yearMonth },
    }));
    const used = (Item?.tokenCount ?? 0) as number;
    return {
        used,
        limit: CAP,
        remaining: Math.max(0, CAP - used),
        percentUsed: Math.round((used / CAP) * 100),
        resetsAt: new Date(getMonthTTL() * 1000).toISOString().slice(0, 10),
        yearMonth,
    };
};
