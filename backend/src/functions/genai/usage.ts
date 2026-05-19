// =============================================================
// GET /genai/usage — Monthly AI token usage for dashboard meter
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { getUsageSummary } from '../analytics/usageCap';
import { AuthenticatedEvent } from '../../types';

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    try {
        const summary = await getUsageSummary(event.userId);
        return respond(200, summary, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('genai/usage error:', err);
        return respondError(500, 'Failed to fetch usage data.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
