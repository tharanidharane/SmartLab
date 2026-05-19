"""
Glue PII Masking Helper
Imported by etl_job.py — masks email, phone, and other PII columns
before writing to the analytics S3 bucket.

Rules:
- email:  user@example.com  → u***@example.com  (domain visible, local masked)
- phone:  +91-9876543210    → +91-XXXXXXX210    (last 3 digits visible)
- userId: unchanged          (not PII in this context — internal UUID)
"""
import re
from pyspark.sql import DataFrame
from pyspark.sql import functions as F
from pyspark.sql.types import StringType


# ── Email masking UDF ────────────────────────────────────────────────
def _mask_email(email: str) -> str:
    if not email:
        return email
    try:
        local, domain = email.split('@', 1)
        masked_local = local[0] + '***' if len(local) > 1 else '***'
        return f'{masked_local}@{domain}'
    except Exception:
        return '***@***.***'


# ── Phone masking UDF — keeps country code prefix + last 3 digits ────
def _mask_phone(phone: str) -> str:
    if not phone:
        return phone
    # Strip non-digit chars except leading +
    digits = re.sub(r'[^\d]', '', phone)
    if len(digits) <= 3:
        return 'X' * len(digits)
    # Reconstruct: keep country code (first 2-3 digits), mask middle, keep last 3
    prefix = phone[:phone.find(digits[0])]  # leading + or +91
    masked = digits[:-3].replace(r'\d', 'X')
    masked_middle = 'X' * len(digits[:-3])
    return f'{prefix}{masked_middle}{digits[-3:]}'


mask_email_udf = F.udf(_mask_email, StringType())
mask_phone_udf = F.udf(_mask_phone, StringType())


def apply_pii_masking(df: DataFrame) -> DataFrame:
    """
    Apply column-level PII masking to the DataFrame.
    Safely handles missing columns — only masks columns that exist.
    """
    existing_cols = set(df.columns)

    if 'userEmail' in existing_cols:
        df = df.withColumn('userEmail', mask_email_udf(F.col('userEmail')))

    if 'phone' in existing_cols:
        df = df.withColumn('phone', mask_phone_udf(F.col('phone')))

    # Drop any raw PII columns that should not reach analytics
    pii_columns_to_drop = [c for c in ['rawEmail', 'rawPhone', 'ipAddress'] if c in existing_cols]
    if pii_columns_to_drop:
        df = df.drop(*pii_columns_to_drop)

    return df
