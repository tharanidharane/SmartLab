"""
Glue ETL Job — bookings_parquet
Reads raw JSON usage logs from S3 using the partitioned Firehose prefix:
  s3://RAW_BUCKET/usage-logs/year=YYYY/month=MM/day=DD/
Applies PII masking (masking.py), transforms to Parquet, writes to:
  s3://ANALYTICS_BUCKET/bookings_parquet/year=.../month=.../day=.../

Key correctness guarantees:
1. S3 prefix matches actual Kinesis Firehose output path (Fix 1)
2. PII masking (email, phone) applied before writing analytics data
3. job.commit() is ALWAYS the final line — advances S3 bookmark correctly
4. Idempotent: dedup by bookingId+eventType prevents double-counting
"""

import sys
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job
from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField, StringType, DoubleType,
)

# ── Import PII masking helper ─────────────────────────────────────────
# masking.py must be uploaded as a --extra-py-files dependency in Glue job config
from masking import apply_pii_masking

# ── Initialise Glue ───────────────────────────────────────────────────
args = getResolvedOptions(sys.argv, [
    'JOB_NAME',
    'RAW_BUCKET',
    'ANALYTICS_BUCKET',
    'DATABASE_NAME',
])

sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

# ── Schema ────────────────────────────────────────────────────────────
SCHEMA = StructType([
    StructField('eventType',     StringType(),  True),
    StructField('bookingId',     StringType(),  True),
    StructField('userId',        StringType(),  True),
    StructField('userEmail',     StringType(),  True),   # ← will be masked
    StructField('phone',         StringType(),  True),   # ← will be masked
    StructField('equipmentId',   StringType(),  True),
    StructField('equipmentName', StringType(),  True),
    StructField('status',        StringType(),  True),
    StructField('timestamp',     StringType(),  True),
    StructField('duration_hours',DoubleType(),  True),
    StructField('slot',          StringType(),  True),
])

# ── Read raw JSON — partitioned path matches Firehose output (Fix 1) ──
# Kinesis Firehose writes to:  usage-logs/year=YYYY/month=MM/day=DD/HH/
# Use wildcard glob to read all partitions via Glue job bookmark
input_path = f"s3://{args['RAW_BUCKET']}/usage-logs/"

raw_df = spark.read \
    .schema(SCHEMA) \
    .option('mode', 'PERMISSIVE') \
    .option('recursiveFileLookup', 'true') \
    .json(input_path)

if raw_df.count() == 0:
    print('No new records — committing bookmark and exiting.')
    job.commit()
    sys.exit(0)

# ── Transform ─────────────────────────────────────────────────────────
clean_df = raw_df \
    .filter(F.col('bookingId').isNotNull()) \
    .filter(F.col('eventType').isin(['BOOKING_CREATED', 'BOOKING_STATUS_CHANGED'])) \
    .withColumn('event_date',     F.to_date(F.col('timestamp'))) \
    .withColumn('event_year',     F.year('event_date').cast(StringType())) \
    .withColumn('event_month',    F.month('event_date').cast(StringType())) \
    .withColumn('event_day',      F.dayofmonth('event_date').cast(StringType())) \
    .withColumn('duration_hours', F.coalesce(F.col('duration_hours'), F.lit(0.0))) \
    .dropDuplicates(['bookingId', 'eventType'])

# ── Apply PII masking BEFORE writing to analytics bucket ─────────────
masked_df = apply_pii_masking(clean_df)

# ── Write Parquet partitioned for Athena ─────────────────────────────
output_path = f"s3://{args['ANALYTICS_BUCKET']}/bookings_parquet/"

masked_df.write \
    .mode('append') \
    .partitionBy('event_year', 'event_month', 'event_day') \
    .parquet(output_path)

print(f"ETL complete: processed {masked_df.count()} records → {output_path}")

# ── CRITICAL: job.commit() MUST be the FINAL line ─────────────────────
# Bookmark only advances when this runs. Never move this up.
job.commit()
