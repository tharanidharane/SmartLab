// =============================================================
// athenaPoller — async poll for Athena query completion
// =============================================================
import {
    AthenaClient,
    GetQueryExecutionCommand,
    GetQueryResultsCommand,
    QueryExecutionState,
} from '@aws-sdk/client-athena';

const athena = new AthenaClient({ region: process.env.AWS_REGION });

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 60;   // 60 seconds max

export interface AthenaRow {
    [key: string]: string;
}

export const pollAthenaQuery = async (queryExecutionId: string): Promise<AthenaRow[]> => {
    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

        const { QueryExecution } = await athena.send(
            new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId })
        );
        const state = QueryExecution?.Status?.State;

        if (state === QueryExecutionState.SUCCEEDED) {
            const results = await athena.send(
                new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId })
            );

            const rows = results.ResultSet?.Rows ?? [];
            if (rows.length < 2) return [];  // header row only = no data

            const headers = rows[0].Data?.map(d => d.VarCharValue ?? '') ?? [];

            return rows.slice(1).map(row => {
                const record: AthenaRow = {};
                row.Data?.forEach((cell, i) => {
                    record[headers[i]] = cell.VarCharValue ?? '';
                });
                return record;
            });
        }

        if (state === QueryExecutionState.FAILED || state === QueryExecutionState.CANCELLED) {
            const reason = QueryExecution?.Status?.StateChangeReason ?? 'Query failed';
            throw new Error(`Athena query ${state}: ${reason}`);
        }
    }

    throw new Error('Athena query timed out after 60 seconds');
};
