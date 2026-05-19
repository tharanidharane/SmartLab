# Fix for Windows Git Bash path mangling
export MSYS_NO_PATHCONV=1

set -e
set -o pipefail

# Load environment variables
if [ -f "$(dirname "$0")/../.env" ]; then
  source "$(dirname "$0")/../.env"
else
  echo "❌ Error: .env file not found in parent directory."
  exit 1
fi

STACK_NAME="smart-lab-system"
ALARMS_STACK_NAME="smart-lab-system-alarms"
SAM_TEMPLATE="infrastructure/template.yaml"
ALARMS_TEMPLATE="infrastructure/alarms.yaml"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION" --no-cli-pager)

S3_OPERATIONAL_BUCKET="sl-system-operational-${ACCOUNT_ID}"
S3_ANALYTICAL_BUCKET="sl-system-analytical-${ACCOUNT_ID}"
S3_ASSETS_BUCKET="sl-system-assets-${ACCOUNT_ID}"
ATHENA_RESULTS_BUCKET="s3://${S3_ANALYTICAL_BUCKET}/athena-results/"

echo "============================================"
echo " Smart Lab — AWS Infrastructure Deploy"
echo " Region: $REGION | Stack: $STACK_NAME"
echo "============================================"

# ── Step 1: Managed S3 Buckets ────────────────────────────────
echo ""
echo "📦 Step 1/7 — S3 Buckets (Managed by SAM)..."
# We skip manual creation to avoid 'EarlyValidation' conflicts during sam deploy.

# ── Step 2: Create KMS Key ──────────────────────────────────
echo ""
echo "🔑 Step 2/7 — Creating KMS key..."
# Discovery logic: check for existing key by alias
echo "  Checking for existing KMS key..."
KEY_ID=$(aws kms list-aliases --query "Aliases[?AliasName=='alias/smart-lab-key'].TargetKeyId" --output text --region "$REGION" --no-cli-pager)

if [ "$KEY_ID" != "None" ] && [ -n "$KEY_ID" ]; then
  KMS_KEY_ID=$KEY_ID
  echo "  ✓ Found existing KMS key (via alias): $KMS_KEY_ID"
else
  echo "  Creating new KMS key..."
  KMS_KEY_ID=$(aws kms create-key --description "KMS key for Smart Lab environmental data" --region "$REGION" --query 'KeyMetadata.KeyId' --output text --no-cli-pager)
  aws kms create-alias --alias-name "alias/smart-lab-key" --target-key-id "$KMS_KEY_ID" --region "$REGION" --no-cli-pager
  echo "  ✓ Created KMS Key: $KMS_KEY_ID"
fi
export KMS_KEY_ID=$KMS_KEY_ID

# ── Step 3: Create Cognito User Pool ─────────────────────────
echo ""
echo "👤 Step 3/7 — Creating Cognito User Pool..."
# Discovery logic: check if pool already exists by name
echo "  Checking for existing User Pool..."
POOL_ID=$(aws cognito-idp list-user-pools --max-results 60 --query "UserPools[?Name=='smart-lab-user-pool'].Id" --output text --region "$REGION" --no-cli-pager)

if [ "$POOL_ID" != "None" ] && [ -n "$POOL_ID" ]; then
  USER_POOL_ID=$POOL_ID
  echo "  ✓ Found existing User Pool: $USER_POOL_ID"
else
  echo "  Creating new User Pool..."
  USER_POOL_ID=$(aws cognito-idp create-user-pool \
    --pool-name "smart-lab-user-pool" \
    --region "$REGION" \
    --auto-verified-attributes email \
    --schema '[
      {"Name":"email","Required":true,"Mutable":true},
      {"Name":"role","AttributeDataType":"String","Mutable":true},
      {"Name":"department","AttributeDataType":"String","Mutable":true}
    ]' \
    --password-policy '{
      "MinimumLength":8,"RequireUppercase":true,
      "RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false
    }' \
    --query 'UserPool.Id' --output text --region "$REGION" --no-cli-pager)
  echo "  ✓ Created User Pool: $USER_POOL_ID"
fi
export COGNITO_USER_POOL_ID=$USER_POOL_ID

# Discovery logic: check if client already exists
echo "  Checking for existing App Client..."
CLIENT_ID_EXISTING=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" --query "UserPoolClients[?ClientName=='smart-lab-web-client'].ClientId" --output text --region "$REGION" --no-cli-pager)

if [ "$CLIENT_ID_EXISTING" != "None" ] && [ -n "$CLIENT_ID_EXISTING" ]; then
  CLIENT_ID=$CLIENT_ID_EXISTING
  echo "  ✓ Found existing App Client: $CLIENT_ID"
else
  echo "  Creating new App Client..."
  CLIENT_ID=$(aws cognito-idp create-user-pool-client \
    --user-pool-id "$USER_POOL_ID" \
    --client-name "smart-lab-web-client" \
    --region "$REGION" \
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
    --query 'UserPoolClient.ClientId' --output text --region "$REGION" --no-cli-pager)
  echo "  ✓ Created App Client: $CLIENT_ID"
fi
export COGNITO_CLIENT_ID=$CLIENT_ID

for GROUP in Students Faculty LabAssistant LabIncharge; do
  aws cognito-idp create-group \
    --group-name "$GROUP" \
    --user-pool-id "$USER_POOL_ID" \
    --region "$REGION" --no-cli-pager 2>/dev/null || true
  echo "  ✓ Group: $GROUP"
done

# ── Step 4: Seed SSM Parameters ──────────────────────────────
echo ""
echo "⚙️  Step 4/7 — Seeding SSM parameters..."
aws ssm put-parameter \
  --name "/smartlab/role-domains" \
  --value '{"@student.university.edu":"Student","@faculty.university.edu":"Faculty","@lab.university.edu":"LabAssistant"}' \
  --type String --overwrite --region "$REGION" --no-cli-pager
aws ssm put-parameter \
  --name "/smartlab/allowed-origin" \
  --value "$ALLOWED_ORIGIN" \
  --type String --overwrite --region "$REGION" --no-cli-pager
echo "  ✓ SSM parameters seeded"

# ── Step 5: SAM Build & Deploy ───────────────────────────────
echo ""
echo "🚀 Step 5/7 — Building and deploying Lambda functions..."
cd "$(dirname "$0")/.."

# Auto-detect SAM on Windows if not in PATH
if ! command -v sam &> /dev/null; then
  if [ -f "/c/Program Files/Amazon/AWSSAMCLI/runtime/python.exe" ]; then
    echo "  ✓ Auto-detected SAM at default Windows path."
    alias sam='"/c/Program Files/Amazon/AWSSAMCLI/runtime/python.exe" -m samcli'
    sam() { "/c/Program Files/Amazon/AWSSAMCLI/runtime/python.exe" -m samcli "$@"; }
  else
    echo "❌ Error: AWS SAM CLI is not installed or not in PATH."
    echo "Please install it from: https://github.com/aws/aws-sam-cli/releases/download/v1.154.0/AWS_SAM_CLI_64_PY3.msi"
    exit 1
  fi
fi

echo "  📦 Installing dependencies and building project..."
npm install
npm run build

sam build --template "$SAM_TEMPLATE" --no-cached
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --resolve-s3 \
  --resolve-image-repos \
  --parameter-overrides \
    "AllowedOrigin=${ALLOWED_ORIGIN}" \
    "AlertEmail=${ALERT_EMAIL}" \
    "KmsKeyId=${KMS_KEY_ID}" \
    "CognitoUserPoolId=${USER_POOL_ID}" \
    "CognitoClientId=${CLIENT_ID}"

echo "  ✓ Main stack deployed"

# ── Step 6: Post-Deployment Config ───────────────────────────
echo ""
echo "⚙️  Step 6/7 — Post-Deployment Configuration..."

GLUE_DB="smart_lab_db_${ACCOUNT_ID}"
echo "  🔍 Syncing Athena DDL..."
ATHENA_DDL="CREATE EXTERNAL TABLE IF NOT EXISTS ${GLUE_DB}.bookings_parquet (
  eventType      STRING,
  bookingId      STRING,
  userId         STRING,
  userEmail      STRING,
  equipmentId    STRING,
  equipmentName  STRING,
  status         STRING,
  timestamp      STRING,
  duration_hours DOUBLE,
  slot           STRING,
  event_date     DATE
)
PARTITIONED BY (event_year STRING, event_month STRING, event_day STRING)
STORED AS PARQUET
LOCATION 's3://${S3_ANALYTICAL_BUCKET}/bookings_parquet/'
TBLPROPERTIES ('parquet.compress'='SNAPPY', 'classification'='parquet');"

aws athena start-query-execution \
  --query-string "$ATHENA_DDL" \
  --result-configuration "OutputLocation=${ATHENA_RESULTS_BUCKET}" \
  --query-execution-context "Database=${GLUE_DB}" \
  --region "$REGION" --no-cli-pager 2>/dev/null || echo "  ⚠️  Athena DDL skipped"

echo "  📋 Enabling CloudTrail..."
aws cloudtrail create-trail \
  --name "smart-lab-trail" \
  --s3-bucket-name "$S3_ANALYTICAL_BUCKET" \
  --s3-key-prefix "cloudtrail" \
  --region "$REGION" --no-cli-pager 2>/dev/null || true
aws cloudtrail start-logging \
  --name "smart-lab-trail" \
  --region "$REGION" --no-cli-pager 2>/dev/null || true

echo "  📊 Setting up Athena Workgroup..."
aws athena create-work-group \
  --name "primary" \
  --configuration "ResultConfiguration={OutputLocation=${ATHENA_RESULTS_BUCKET}}" \
  --region "$REGION" --no-cli-pager 2>/dev/null || true

echo "  🐳 Ensuring ECR repository..."
aws ecr create-repository \
  --repository-name "smart-lab-ml" \
  --region "$REGION" --no-cli-pager 2>/dev/null || true

echo "  📡 Enabling DynamoDB Streams on Bookings table..."
BOOKINGS_TABLE=$(aws cloudformation describe-stack-resource \
  --stack-name "$STACK_NAME" \
  --logical-resource-id BookingsTable \
  --region "$REGION" --no-cli-pager \
  --query 'StackResourceDetail.PhysicalResourceId' --output text 2>/dev/null || echo "")

if [ -n "$BOOKINGS_TABLE" ] && [ "$BOOKINGS_TABLE" != "None" ]; then
  aws dynamodb update-table \
    --table-name "$BOOKINGS_TABLE" \
    --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
    --region "$REGION" --no-cli-pager 2>/dev/null || true
  echo "  ✓ DynamoDB Streams enabled"
fi

# ── Step 7: Deploy Alarms Stack ──────────────────────────────
echo ""
echo "🔔 Step 7/7 — Deploying CloudWatch Alarms..."
sam deploy \
  --template-file "$ALARMS_TEMPLATE" \
  --stack-name "$ALARMS_STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "AlertEmail=${ALERT_EMAIL}" \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset
echo "  ✓ Alarms stack deployed"

# ── Final Resource Summary ──────────────────────────────────
echo ""
echo "📝 Writing Resource Summary..."
cat > .env.deployed <<EOF
# Auto-generated by deploy.sh — $(date -u +"%Y-%m-%dT%H:%M:%SZ")
COGNITO_USER_POOL_ID=${USER_POOL_ID}
COGNITO_CLIENT_ID=${CLIENT_ID}
KMS_KEY_ID=${KMS_KEY_ID}
EOF

API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" \
  --output text --no-cli-pager 2>/dev/null || echo "PENDING")
WS_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='WebSocketUrl'].OutputValue" \
  --output text --no-cli-pager 2>/dev/null || echo "PENDING")
echo "API_GATEWAY_URL=${API_URL}" >> .env.deployed
echo "WEBSOCKET_API_URL=${WS_URL}" >> .env.deployed

echo ""
echo "============================================"
echo "✅  Deployment Complete!"
echo "============================================"
echo "  API Gateway URL : $API_URL"
echo "  WebSocket URL   : $WS_URL"
echo "  User Pool ID    : $USER_POOL_ID"
echo "  Resource IDs    : .env.deployed"
echo "============================================"
