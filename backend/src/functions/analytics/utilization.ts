// =============================================================
// GET /analytics/utilization — Equipment utilization from Athena
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AthenaClient, StartQueryExecutionCommand } from '@aws-sdk/client-athena';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { pollAthenaQuery } from '../../utils/athenaPoller';
import { AuthenticatedEvent } from '../../types';

const athena = new AthenaClient({ region: process.env.AWS_REGION });

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    if (!['LabAssistant', 'LabIncharge'].includes(event.role)) {
        return respondError(403, 'Access denied.', event as unknown as APIGatewayProxyEvent);
    }
    try {
        const { days = '30' } = event.queryStringParameters ?? {};
        const daysInt = Math.min(parseInt(days), 365);

        const query = `
      SELECT
        equipment_id,
        equipment_name,
        COUNT(*) as total_bookings,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved_bookings,
        AVG(duration_hours) as avg_duration_hours,
        100.0 * SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) / COUNT(*) as utilization_rate
      FROM "${process.env.ATHENA_DATABASE}"."bookings_parquet"
      WHERE event_date >= date_add('day', -${daysInt}, current_date)
      GROUP BY equipment_id, equipment_name
      ORDER BY utilization_rate DESC
    `;

        const { QueryExecutionId } = await athena.send(new StartQueryExecutionCommand({
            QueryString: query,
            QueryExecutionContext: { Database: process.env.ATHENA_DATABASE },
            WorkGroup: process.env.ATHENA_WORKGROUP,
            ResultConfiguration: { OutputLocation: process.env.ATHENA_RESULTS_BUCKET },
        }));

        const rows = await pollAthenaQuery(QueryExecutionId!);
        const staleSince = new Date().toISOString();

        return {
            ...respond(200, { utilization: rows, days: daysInt }, event as unknown as APIGatewayProxyEvent),
            // staleSince header lets the frontend show amber "data may be stale" banner
            headers: {
                ...respond(200, {}, event as unknown as APIGatewayProxyEvent).headers,
                'X-Data-Stale-Since': staleSince,
            },
        };
    } catch (err) {
        console.error('analytics/utilization error:', err);
        return respondError(500, 'Failed to fetch utilization data.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
