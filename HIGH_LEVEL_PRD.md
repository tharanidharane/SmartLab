# Smart Lab System - High-Level Product Requirements Document (PRD)

## 1. Product Summary

Smart Lab System is a university lab operations platform that combines:

- Equipment discovery and management
- Role-based booking and approval workflows
- Real-time booking updates
- Mobile push notifications
- Usage analytics and forecasting
- AI assistant support grounded in live lab data

The codebase is a monorepo with three product surfaces:

- Backend (TypeScript AWS Lambda APIs + Python ML/Glue jobs)
- Web app (React + Vite)
- Mobile app (Expo React Native)

Core goal: reduce friction in lab equipment booking, improve equipment utilization, and give lab staff operational intelligence.

## 2. Business Goals

- Digitize and enforce booking policies (durations, approvals, conflicts, waitlists)
- Improve transparency for students/faculty on availability and booking status
- Enable assistants/in-charge to manage approvals and equipment lifecycle
- Provide analytics for utilization, anomalies, and demand forecasting
- Maintain secure handling of user data with encrypted storage and masked analytics data

## 3. Users and Roles

- Student
- Faculty
- LabAssistant
- LabIncharge

Primary permissions model:

- Student/Faculty:
  - Browse equipment
  - Create bookings
  - View own bookings/history
  - Use AI assistant
- LabAssistant:
  - Review pending bookings
  - Operate via QR/workflow screens
  - Monitor usage logs
- LabIncharge:
  - Full operational oversight
  - Equipment management
  - Analytics, anomalies, audit logs, forecast controls
  - User role management

Authentication and role claims are Cognito-based and injected into tokens via trigger logic.

## 4. Product Scope and Major Features

### 4.1 Authentication and Identity

- Register, login, refresh, logout endpoints
- Cognito-backed identity lifecycle
- Post-confirmation trigger:
  - Reads domain-to-role mapping from SSM Parameter Store
  - Adds user to Cognito group
  - Creates encrypted user record in DynamoDB
- Pre-token-generation trigger:
  - Injects normalized `custom:role` claim into JWT

### 4.2 Equipment Management

- Equipment CRUD APIs
- Equipment availability status (`AVAILABLE`, `UNDER_MAINTENANCE`, `RETIRED`)
- Role-specific management visibility in mobile/web dashboards
- Supports equipment metadata and optional asset/photo references

### 4.3 Booking Lifecycle

- Create booking with validation:
  - Role restriction (student/faculty)
  - Max duration enforcement (faculty: 8h, student: 4h)
  - Conflict detection by equipment/date/slot
- Auto-state selection:
  - `WAITLISTED` when conflicting slot exists
  - `PENDING` when approval required
  - `APPROVED` when no approval required
- Booking APIs for:
  - My bookings
  - Pending approvals
  - Update status
  - Cancel
  - Fetch by ID / all bookings

### 4.4 Real-Time and Notifications

- WebSocket flow:
  - One-time short-lived WS ticket issued via REST auth endpoint
  - Ticket used to establish WS connection
  - Connection records stored in DynamoDB with TTL
- DynamoDB stream processor on bookings table:
  - Detects booking status transitions
  - Idempotently marks `notificationSent=true`
  - Broadcasts real-time events via WS Lambda
  - Sends push notification when user has Expo token

### 4.5 Analytics and Intelligence

- Utilization analytics:
  - Athena query over Glue-managed Parquet dataset
- Forecast pipeline:
  - Async forecast refresh creates job record
  - Invokes Python ML Lambda (container image)
  - Job status polled through forecast status endpoint
- Anomaly and audit log APIs
- QuickSight embed endpoint exists, but code indicates QuickSight may be unconfigured in some environments

### 4.6 GenAI Assistant

- Conversational assistant endpoint with role-aware live context
- Reads live equipment/bookings context from DynamoDB
- Primary provider: AWS Bedrock (Claude/Nova model failover)
- Fallback provider: OpenAI (`gpt-4o-mini`) when Bedrock fails
- Monthly token cap enforcement per user
- Session history persisted with TTL

### 4.7 Asset Upload

- Presigned S3 PUT URL generation for image uploads
- Presigned S3 GET URL generation for retrieval
- S3 object-created trigger invokes validation Lambda

## 5. Frontend Experience

## 5.1 Web App

- Route-guarded React SPA
- Role-gated pages for dashboard, equipment, approvals, analytics, AI, and role-specific consoles
- Axios client with automatic token refresh and request replay queue
- WebSocket hook for live booking status notifications

## 5.2 Mobile App

- Expo Router tab app with role-aware tab visibility
- Student/faculty flows: equipment, bookings, history, AI
- Assistant flows: approvals, QR, usage logs
- In-charge flows: manage equipment, forecast, anomalies, audit logs, analytics, user management
- Push notification registration (non-Expo-Go environments)
- Axios client with SecureStore token handling and refresh retry logic

## 6. AWS Architecture (What Happens in AWS)

This section summarizes infrastructure and runtime behavior observed from IaC and handlers.

### 6.1 API and Compute

- AWS SAM-based stack (primary production IaC)
- API Gateway REST endpoints for product APIs
- API Gateway WebSocket API for real-time booking events
- Lambda functions segmented by domain:
  - Auth
  - Users
  - Equipment
  - Bookings
  - Analytics
  - GenAI
  - Assets
  - Maintenance
  - WebSocket connect/disconnect/broadcast
- One Python ML Lambda deployed as container image from ECR for forecasting

### 6.2 Identity and Access

- Amazon Cognito user pool authorizer for protected REST APIs
- Cognito triggers:
  - PostConfirmation
  - PreTokenGeneration
- IAM roles are separated per function group (least privilege intent)

### 6.3 Core Data Stores

- DynamoDB tables:
  - SmartLab-Equipment
  - SmartLab-Bookings (with stream enabled)
  - SmartLab-Users
  - SmartLab-AuditLogs
  - SmartLab-WSConnections (TTL)
  - SmartLab-ForecastJobs (TTL)
  - SmartLab-ChatSessions (TTL)
  - SmartLab-UsageMetrics (TTL)

### 6.4 Object Storage and Data Lake

- S3 buckets:
  - Operational bucket (raw usage events)
  - Analytical bucket (processed Parquet, Athena outputs, scripts/temp)
  - Assets bucket (equipment images)
- Kinesis Firehose stream writes usage logs to partitioned S3 prefixes
- Glue crawler catalogs raw data
- Glue ETL job transforms JSON usage events to masked Parquet dataset
- Athena queries analytical Parquet tables for utilization/ML inputs

### 6.5 Messaging and Failure Handling

- DynamoDB stream on bookings table triggers stream processor Lambda
- DLQ (SQS) for stream processor failure destination
- Lambda Insights layer configured

### 6.6 Security Controls

- KMS-backed encryption used for DynamoDB/S3 and app-level field encryption helpers
- WAF Web ACL defined with:
  - Rate-based rule
  - AWS managed common rules
  - Known bad input rules
- CORS configured in API globals
- Public access blocks enabled for S3 buckets

### 6.7 Scheduling and Operations

- Health warm-up schedule
- Nightly ML forecast schedule (EventBridge rule)
- Glue crawler scheduled every 6 hours
- Glue ETL scheduled daily
- Maintenance Lambda scheduled every 5 minutes for stuck jobs

## 7. End-to-End Runtime Flows

### 7.1 Booking Create to Notification

1. Client calls booking create API.
2. Lambda validates role/payload/equipment/conflicts and writes booking.
3. Lambda logs usage event to Firehose (best effort).
4. Booking status changes trigger DynamoDB stream processor.
5. Stream processor sets notification flag, emits WS event, sends push notification (if token exists).

### 7.2 Analytics Data Pipeline

1. Product events are written to Firehose.
2. Firehose stores raw JSON in S3 operational bucket.
3. Glue crawler updates catalog metadata.
4. Glue ETL reads raw logs, applies PII masking, writes Parquet to analytical bucket.
5. Athena queries Parquet for utilization and ML forecasting inputs.

### 7.3 Forecast Job Lifecycle

1. LabIncharge calls forecast refresh endpoint.
2. API writes `STARTED` job in forecast table.
3. API asynchronously invokes ML forecast Lambda.
4. ML Lambda queries Athena historical data and runs Prophet models.
5. Forecast result or failure reason is written back to forecast jobs table.
6. Client polls forecast status endpoint until terminal state.

### 7.4 GenAI Query Lifecycle

1. Client sends chat message with session ID.
2. API checks monthly token cap.
3. API loads session history and live lab context.
4. API calls Bedrock model chain; if failed, falls back to OpenAI.
5. API stores assistant reply and updated session; increments usage metrics.

## 8. Security, Privacy, and Compliance Intent

- JWT verification through Cognito verifier middleware
- Role-based authorization checks in handlers
- Encryption strategy:
  - KMS-managed encryption for DynamoDB and S3 resources
  - Field-level encryption for user PII in app logic
- Analytics protection:
  - PII masking before writing analytical Parquet outputs
- Audit logging in dedicated table for governance traceability

## 9. Non-Functional Requirements (Implied by Implementation)

- Scalability:
  - Serverless compute and on-demand DynamoDB billing
- Reliability:
  - DLQ for stream failures, idempotency handling in notifications
- Performance:
  - Async forecast processing, direct Athena polling utility
- Observability:
  - CloudWatch logs, API log group, tracing enabled in SAM globals
- Security hardening:
  - WAF, KMS, Cognito authorizer, bucket public access blocking

## 10. Known Constraints and Current Gaps

- QuickSight embedding endpoint exists, but code indicates this may be disabled/unconfigured in some accounts.
- Some frontend role checks include `Researcher`, while core backend type definitions mainly enumerate four roles.
- Local development runtime has fallbacks for services not present locally (for example ML Lambda invocation).
- Serverless Framework config exists, but comments indicate SAM template is intended as production source of truth.

## 11. Suggested Success Metrics

- Booking success rate (% requests resulting in valid booking state)
- Approval turnaround time
- Waitlist conversion rate
- Equipment utilization rate by category
- Forecast accuracy (MAPE/MAE tracked offline)
- AI assistant usage and token cap breach rate
- Notification delivery success (WS + push)

## 12. Release and Deployment Notes

- Build backend TypeScript to dist artifacts
- Deploy infra and functions via SAM template in `backend/infrastructure/template.yaml`
- Ensure environment/parameter prerequisites:
  - Cognito pool and client IDs
  - KMS key ID
  - Alert email and allowed origins
  - Optional AI provider settings and QuickSight dashboard values

---

This PRD is intentionally high-level and implementation-grounded from the current repository state so product, engineering, and cloud teams can share a single architecture and scope reference.
