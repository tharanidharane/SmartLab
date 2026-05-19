// =============================================================
// Local Express Dev Server — wraps Lambda handlers as HTTP routes
// Usage: npx ts-node -r tsconfig-paths/register local-server.ts
// Reads .env automatically via dotenv
// =============================================================
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// ── Lambda handler imports ───────────────────────────────────
import { handler as healthHandler } from './src/functions/health/index';
import { handler as loginHandler } from './src/functions/auth/login';
import { handler as registerHandler } from './src/functions/auth/register';
import { handler as refreshHandler } from './src/functions/auth/refresh';
import { handler as wsTicketHandler } from './src/functions/auth/wsTicket';
import { handler as equipmentListHandler } from './src/functions/equipment/list';
import { handler as equipmentCreateHandler } from './src/functions/equipment/create';
import { handler as equipmentUpdateHandler } from './src/functions/equipment/update';
import { handler as equipmentDeleteHandler } from './src/functions/equipment/delete';
import { handler as equipmentSlotsHandler } from './src/functions/equipment/slots';
import { handler as bookingCreateHandler } from './src/functions/bookings/create';
import { handler as bookingMyHandler } from './src/functions/bookings/myBookings';
import { handler as bookingPendingHandler } from './src/functions/bookings/pending';
import { handler as bookingUpdateStatusHandler } from './src/functions/bookings/updateStatus';
import { handler as bookingCancelHandler } from './src/functions/bookings/cancel';
import { handler as bookingAllHandler } from './src/functions/bookings/all';
import { handler as analyticsUtilizationHandler } from './src/functions/analytics/utilization';
import { handler as analyticsForecastHandler } from './src/functions/analytics/forecast';
import { handler as analyticsForecastRefreshHandler } from './src/functions/analytics/forecastRefresh';
import { handler as analyticsForecastStatusHandler } from './src/functions/analytics/forecastStatus';
import { handler as analyticsAnomaliesHandler } from './src/functions/analytics/anomalies';
import { handler as analyticsAuditLogsHandler } from './src/functions/analytics/auditLogs';
import { handler as genaiChatHandler } from './src/functions/genai/chat';
import { handler as genaiUsageHandler } from './src/functions/genai/usage';
import { handler as assetPresignHandler } from './src/functions/assets/presign';
import { handler as registerPushTokenHandler } from './src/functions/users/registerPushToken';
import { handler as usersListHandler } from './src/functions/users/list';
import { handler as usersUpdateRoleHandler } from './src/functions/users/updateRole';
import { handler as analyticsEmbedUrlHandler } from './src/functions/analytics/embedUrl';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ── Middleware ───────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map(o => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Lambda adapter ───────────────────────────────────────────
type LambdaHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult | void>;

/**
 * Converts an Express Request into a minimal APIGatewayProxyEvent
 * and pipes the Lambda response back to Express.
 */
function adapt(handler: LambdaHandler) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const event: APIGatewayProxyEvent = {
                httpMethod: req.method,
                path: req.path,
                resource: req.path,
                headers: req.headers as Record<string, string>,
                multiValueHeaders: {},
                queryStringParameters: (Object.keys(req.query).length > 0
                    ? Object.fromEntries(
                        Object.entries(req.query).map(([k, v]) => [k, String(v)])
                    )
                    : null) as Record<string, string> | null,
                multiValueQueryStringParameters: null,
                pathParameters: (Object.keys(req.params).length > 0
                    ? req.params
                    : null) as Record<string, string> | null,
                stageVariables: null,
                requestContext: {
                    accountId: process.env.AWS_ACCOUNT_ID ?? '',
                    apiId: 'local',
                    authorizer: {},
                    protocol: 'HTTP/1.1',
                    httpMethod: req.method,
                    identity: {
                        accessKey: null, accountId: null, apiKey: null,
                        apiKeyId: null, caller: null, clientCert: null,
                        cognitoAuthenticationProvider: null, cognitoAuthenticationType: null,
                        cognitoIdentityId: null, cognitoIdentityPoolId: null,
                        principalOrgId: null, sourceIp: req.ip ?? '127.0.0.1',
                        user: null, userAgent: req.headers['user-agent'] ?? null,
                        userArn: null,
                    },
                    path: req.path,
                    resourceId: '',
                    resourcePath: req.path,
                    requestId: `local-${Date.now()}`,
                    requestTimeEpoch: Date.now(),
                    stage: 'local',
                },
                body: req.body ? JSON.stringify(req.body) : null,
                isBase64Encoded: false,
            };

            const result = await handler(event);
            if (!result) {
                res.status(200).end();
                return;
            }

            // Apply all headers from Lambda response
            Object.entries(result.headers ?? {}).forEach(([k, v]) => {
                if (k.toLowerCase() !== 'access-control-allow-origin' &&
                    k.toLowerCase() !== 'access-control-allow-credentials') {
                    res.setHeader(k, String(v));
                }
            });

            res.status(result.statusCode).send(result.body);
        } catch (err) {
            next(err);
        }
    };
}

// ── Routes ───────────────────────────────────────────────────

// Health
app.get('/health', adapt(healthHandler as LambdaHandler));

// Auth
app.post('/auth/register', adapt(registerHandler as LambdaHandler));
app.post('/auth/login', adapt(loginHandler as LambdaHandler));
app.post('/auth/refresh', adapt(refreshHandler as LambdaHandler));
app.post('/auth/ws-ticket', adapt(wsTicketHandler as LambdaHandler));

// Users
app.get('/users', adapt(usersListHandler as LambdaHandler));
app.put('/users/:id/role', adapt(usersUpdateRoleHandler as LambdaHandler));
app.post('/users/push-token', adapt(registerPushTokenHandler as LambdaHandler));

// Equipment
app.get('/equipment', adapt(equipmentListHandler as LambdaHandler));
app.post('/equipment', adapt(equipmentCreateHandler as LambdaHandler));
app.put('/equipment/:id', adapt(equipmentUpdateHandler as LambdaHandler));
app.delete('/equipment/:id', adapt(equipmentDeleteHandler as LambdaHandler));
app.get('/equipment/:id/slots', adapt(equipmentSlotsHandler as LambdaHandler));

// Bookings
app.post('/bookings', adapt(bookingCreateHandler as LambdaHandler));
app.get('/bookings/all', adapt(bookingAllHandler as LambdaHandler));
app.get('/bookings/pending', adapt(bookingPendingHandler as LambdaHandler));
app.get('/bookings', adapt(bookingMyHandler as LambdaHandler));
app.put('/bookings/:id/status', adapt(bookingUpdateStatusHandler as LambdaHandler));
app.delete('/bookings/:id', adapt(bookingCancelHandler as LambdaHandler));

// Analytics
app.get('/analytics/utilization', adapt(analyticsUtilizationHandler as LambdaHandler));
app.get('/analytics/forecast', adapt(analyticsForecastHandler as LambdaHandler));
app.post('/analytics/forecast/refresh', adapt(analyticsForecastRefreshHandler as LambdaHandler));
app.get('/analytics/forecast/status/:jobId', adapt(analyticsForecastStatusHandler as LambdaHandler));
app.get('/analytics/anomalies', adapt(analyticsAnomaliesHandler as LambdaHandler));
app.get('/analytics/audit-logs', adapt(analyticsAuditLogsHandler as LambdaHandler));
app.get('/analytics/embed-url', adapt(analyticsEmbedUrlHandler as LambdaHandler));

// GenAI
app.post('/genai/chat', adapt(genaiChatHandler as LambdaHandler));
app.get('/genai/usage', adapt(genaiUsageHandler as LambdaHandler));

// Assets
app.get('/assets/upload-url', adapt(assetPresignHandler as LambdaHandler));
app.get('/assets/url', adapt(assetPresignHandler as LambdaHandler));

// ── Error handler ─────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[LocalServer Error]', err.message);
    res.status(500).json({ message: 'Internal server error', error: err.message });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Smart Lab local backend running at http://localhost:${PORT}`);
    console.log(`   Connected to AWS region: ${process.env.AWS_REGION}`);
    console.log(`   DynamoDB: ${process.env.DYNAMO_EQUIPMENT_TABLE}`);
    console.log(`   Cognito:  ${process.env.COGNITO_USER_POOL_ID}`);
    console.log(`   CORS:     ${allowedOrigins.join(', ')}\n`);
});
