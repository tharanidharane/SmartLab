// =============================================================
// GET /analytics/anomalies — Surface anomalous equipment usage
// Uses Athena to find equipment with usage > 2 stddev from mean
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
        const { days = '7' } = event.queryStringParameters ?? {};
        const daysInt = Math.min(parseInt(days), 90);

        const query = `
      WITH stats AS (
        SELECT
          equipment_id,
          equipment_name,
          COUNT(*) as booking_count,
          AVG(COUNT(*)) OVER () as mean_bookings,
          STDDEV_POP(COUNT(*)) OVER () as stddev_bookings
        FROM "${process.env.ATHENA_DATABASE}"."bookings_parquet"
        WHERE event_date >= date_add('day', -${daysInt}, current_date)
          AND status = 'APPROVED'
        GROUP BY equipment_id, equipment_name
      )
      SELECT
        equipment_id,
        equipment_name,
        booking_count,
        mean_bookings,
        stddev_bookings,
        (booking_count - mean_bookings) / NULLIF(stddev_bookings, 0) as z_score,
        CASE
          WHEN booking_count > mean_bookings + 2 * stddev_bookings THEN 'HIGH_USAGE'
          WHEN booking_count < mean_bookings - 2 * stddev_bookings THEN 'LOW_USAGE'
          ELSE 'NORMAL'
        END as anomaly_type
      FROM stats
      WHERE ABS((booking_count - mean_bookings) / NULLIF(stddev_bookings, 0)) > 2
      ORDER BY ABS((booking_count - mean_bookings) / NULLIF(stddev_bookings, 0)) DESC
    `;

        const { QueryExecutionId } = await athena.send(new StartQueryExecutionCommand({
            QueryString: query,
            QueryExecutionContext: { Database: process.env.ATHENA_DATABASE },
            WorkGroup: process.env.ATHENA_WORKGROUP,
            ResultConfiguration: { OutputLocation: process.env.ATHENA_RESULTS_BUCKET },
        }));

        const rows = await pollAthenaQuery(QueryExecutionId!);
        return respond(200, { anomalies: rows, days: daysInt }, event as unknown as APIGatewayProxyEvent);
    } catch (err) {
        console.error('analytics/anomalies error:', err);
        return respondError(500, 'Failed to fetch anomalies.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
