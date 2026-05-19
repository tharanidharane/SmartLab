// =============================================================
// GET /analytics/embed-url — QuickSight embed URL
// NOTE: QuickSight is currently not subscribed on this account.
// Returns a graceful "unavailable" response instead of crashing.
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    if (!['LabAssistant', 'LabIncharge'].includes(event.role)) {
        return respondError(403, 'Analytics dashboard access restricted.', event as unknown as APIGatewayProxyEvent);
    }

    // QuickSight subscription check
    if (!process.env.QUICKSIGHT_DASHBOARD_ID || process.env.QUICKSIGHT_DASHBOARD_ID === 'YOUR_DASHBOARD_ID') {
        return respond(200, {
            unavailable: true,
            reason: 'QuickSight analytics dashboard is not configured for this environment.',
            message: 'Analytics via QuickSight is not available. Use the /analytics/utilization endpoint for data.',
        }, event as unknown as APIGatewayProxyEvent);
    }

    try {
        // Dynamically import to avoid errors when QS is not subscribed
        const { QuickSightClient, GenerateEmbedUrlForRegisteredUserCommand } = await import('@aws-sdk/client-quicksight');
        const qs = new QuickSightClient({ region: process.env.AWS_REGION });

        const result = await qs.send(new GenerateEmbedUrlForRegisteredUserCommand({
            AwsAccountId: process.env.AWS_ACCOUNT_ID!,
            SessionLifetimeInMinutes: 60,
            UserArn: `arn:aws:quicksight:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:user/default/${event.userId}`,
            ExperienceConfiguration: {
                Dashboard: {
                    InitialDashboardId: process.env.QUICKSIGHT_DASHBOARD_ID!,
                },
            },
        }));

        return respond(200, {
            embedUrl: result.EmbedUrl,
            expiresIn: 3600,
            refreshBefore: 1800,
        }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('analytics/embedUrl error:', err);
        return respond(200, {
            unavailable: true,
            reason: 'QuickSight is not subscribed or configured for this account.',
            message: 'Analytics dashboard is currently unavailable.',
        }, event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
