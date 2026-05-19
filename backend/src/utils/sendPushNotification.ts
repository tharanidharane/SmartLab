// =============================================================
// sendPushNotification — Expo Push API with DeviceNotRegistered cleanup
// =============================================================
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
    to: string;           // Expo push token
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: 'default' | null;
    badge?: number;
}

export const sendPushNotification = async (
    userId: string,
    expoPushToken: string,
    message: Omit<PushMessage, 'to'>
): Promise<boolean> => {
    try {
        const payload: PushMessage = { to: expoPushToken, sound: 'default', ...message };

        const res = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload),
        });

        const json = await res.json() as { data?: { status: string; details?: { error?: string } } };
        const ticket = json.data;

        if (ticket?.details?.error === 'DeviceNotRegistered') {
            // Token is stale — null it out so next launch upserts a fresh one
            await docClient.send(new UpdateCommand({
                TableName: process.env.DYNAMO_USERS_TABLE!,
                Key: { userId },
                UpdateExpression: 'REMOVE expoPushToken',
            }));
            console.warn(`Removed stale push token for user ${userId}`);
            return false;
        }

        return ticket?.status === 'ok';
    } catch (err) {
        console.error(`Push notification failed for user ${userId}:`, err);
        return false;
    }
};
