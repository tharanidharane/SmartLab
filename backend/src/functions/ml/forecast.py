"""
ML Forecast Lambda — Prophet/ARIMA for equipment demand forecasting
Called async by forecastRefresh.ts via Event invocation
Updates DynamoDB ForecastJobs table on completion/failure
"""
import json
import os
import boto3
import pandas as pd
from datetime import datetime, timedelta
from prophet import Prophet

dynamo = boto3.resource('dynamodb')
table = dynamo.Table(os.environ['DYNAMO_FORECAST_JOBS_TABLE'])
athena = boto3.client('athena')

def update_job(job_id: str, status: str, data=None, reason=None):
    update_expr  = 'SET #s = :s, updatedAt = :now'
    attr_names   = {'#s': 'status'}
    attr_values  = {':s': status, ':now': datetime.utcnow().isoformat()}
    if data   is not None: update_expr += ', forecastData = :d'; attr_values[':d'] = json.dumps(data)
    if reason is not None: update_expr += ', reason = :r';       attr_values[':r'] = reason
    if status == 'COMPLETED': update_expr += ', completedAt = :ca'; attr_values[':ca'] = datetime.utcnow().isoformat()
    table.update_item(
        Key={'jobId': job_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=attr_names,
        ExpressionAttributeValues=attr_values,
    )

def run_athena_query(query: str) -> pd.DataFrame:
    resp = athena.start_query_execution(
        QueryString=query,
        QueryExecutionContext={'Database': os.environ['ATHENA_DATABASE']},
        WorkGroup=os.environ.get('ATHENA_WORKGROUP', 'primary'),
        ResultConfiguration={'OutputLocation': os.environ['ATHENA_RESULTS_BUCKET']},
    )
    query_id = resp['QueryExecutionId']
    # Poll
    import time
    for _ in range(60):
        time.sleep(1)
        status = athena.get_query_execution(QueryExecutionId=query_id)
        state = status['QueryExecution']['Status']['State']
        if state == 'SUCCEEDED':
            break
        if state in ('FAILED', 'CANCELLED'):
            raise RuntimeError(f"Athena query {state}: {status['QueryExecution']['Status'].get('StateChangeReason')}")

    result = athena.get_query_results(QueryExecutionId=query_id)
    rows  = result['ResultSet']['Rows']
    if len(rows) < 2:
        return pd.DataFrame()
    headers = [c.get('VarCharValue', '') for c in rows[0]['Data']]
    records = [[c.get('VarCharValue', '') for c in row['Data']] for row in rows[1:]]
    return pd.DataFrame(records, columns=headers)

def handler(event, context):
    job_id = event.get('jobId')
    if not job_id:
        print('Missing jobId — skipping')
        return

    try:
        # ── Fetch last 90 days of approved bookings ──
        query = """
        SELECT
            equipment_id,
            equipment_name,
            DATE_FORMAT(event_date, '%Y-%m-%d') as ds,
            COUNT(*) as y
        FROM "{db}"."bookings_parquet"
        WHERE event_date >= date_add('day', -90, current_date)
          AND status = 'APPROVED'
        GROUP BY equipment_id, equipment_name, DATE_FORMAT(event_date, '%Y-%m-%d')
        ORDER BY equipment_id, ds
        """.format(db=os.environ['ATHENA_DATABASE'])

        df = run_athena_query(query)

        if df.empty:
            update_job(job_id, 'COMPLETED', data=[], reason='No historical data found')
            return

        df['ds'] = pd.to_datetime(df['ds'])
        df['y'] = pd.to_numeric(df['y'], errors='coerce').fillna(0)

        forecasts = []
        for equip_id, group in df.groupby('equipment_id'):
            equip_name = group['equipment_name'].iloc[0]
            ts_df = group[['ds', 'y']].copy()

            # Require at least 14 data points for meaningful forecast
            if len(ts_df) < 14:
                continue

            model = Prophet(
                yearly_seasonality=False,
                weekly_seasonality=True,
                daily_seasonality=False,
                changepoint_prior_scale=0.05,
            )
            model.fit(ts_df)

            future = model.make_future_dataframe(periods=14)  # 2-week forecast
            forecast = model.predict(future)

            forecast_rows = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]\
                .tail(14)\
                .to_dict('records')

            # Serialize dates for JSON
            for row in forecast_rows:
                row['ds'] = row['ds'].strftime('%Y-%m-%d')
                row['yhat'] = max(0, round(row['yhat'], 2))
                row['yhat_lower'] = max(0, round(row['yhat_lower'], 2))
                row['yhat_upper'] = max(0, round(row['yhat_upper'], 2))

            forecasts.append({
                'equipmentId': equip_id,
                'equipmentName': equip_name,
                'horizon': '14d',
                'forecast': forecast_rows,
            })

        update_job(job_id, 'COMPLETED', data=forecasts)
        print(f'Forecast complete: {len(forecasts)} equipment items processed')

    except Exception as e:
        print(f'Forecast failed for job {job_id}: {e}')
        update_job(job_id, 'FAILED', reason=str(e))
        raise  # Re-raise so Lambda marks as error in CloudWatch
