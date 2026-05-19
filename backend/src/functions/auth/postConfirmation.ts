// =============================================================
// Cognito PostConfirmation Trigger — assigns user to correct group
// based on email domain mapping stored in SSM Parameter Store
// =============================================================
import {
    PostConfirmationTriggerEvent,
    PostConfirmationTriggerHandler,
} from 'aws-lambda';
import {
    CognitoIdentityProviderClient,
    AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { encryptField } from '../../middleware/encryption';

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const ssm = new SSMClient({ region: process.env.AWS_REGION });
const dynClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynClient);

export const handler: PostConfirmationTriggerHandler = async (
    event: PostConfirmationTriggerEvent
) => {
    try {
        const email = event.request.userAttributes.email;
        const userId = event.request.userAttributes.sub;
        const name = event.request.userAttributes.name ?? email.split('@')[0];
        const department = event.request.userAttributes['custom:department'] ?? 'General';

        // Read domain-to-role mapping from SSM (seeded by deploy.sh before stack creation)
        const param = await ssm.send(new GetParameterCommand({
            Name: process.env.SSM_ROLE_DOMAINS_PATH!,
        }));
        const domainMap: Record<string, string> = JSON.parse(param.Parameter?.Value ?? '{}');

        // Determine group from email domain
        const domain = '@' + email.split('@')[1].toLowerCase();
        const group = domainMap[domain] ?? 'Students'; // Default to Student for unrecognized domains

        // Add user to Cognito group
        await cognito.send(new AdminAddUserToGroupCommand({
            UserPoolId: event.userPoolId,
            Username: event.userName,
            GroupName: group,
        }));

        // Persist user record to DynamoDB with encrypted PII
        const encryptedEmail = await encryptField(email);
        const now = new Date().toISOString();

        await docClient.send(new PutCommand({
            TableName: process.env.DYNAMO_USERS_TABLE!,
            Item: {
                userId,
                email: encryptedEmail,
                name,
                role: group.replace('s', '').replace(/ies$/, 'y'),  // Students→Student, Faculty→Faculty
                department,
                createdAt: now,
                updatedAt: now,
            },
            ConditionExpression: 'attribute_not_exists(userId)',  // prevent overwrites
        }));

        console.log(`User ${userId} (${email}) assigned to group: ${group}`);
        return event;
    } catch (err) {
        console.error('PostConfirmation error:', err);
        // Return event even on error — don't block confirmation
        return event;
    }
};
