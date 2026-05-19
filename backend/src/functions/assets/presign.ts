// =============================================================
// GET /assets/upload-url — Pre-signed S3 PUT URL for equipment photos
// GET /assets/url — Pre-signed S3 GET URL for viewing
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { AuthenticatedEvent } from '../../types';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.ASSETS_BUCKET!;

// Allowed MIME types — prevents web shell uploads
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    const path = event.path ?? event.resource ?? '';

    if (path.endsWith('/upload-url')) {
        // ── Generate pre-signed PUT URL ──
        const { contentType, filename } = event.queryStringParameters ?? {};
        if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
            return respondError(400, `Allowed types: ${ALLOWED_TYPES.join(', ')}`, event as unknown as APIGatewayProxyEvent);
        }
        const ext = filename?.split('.').pop() ?? 'jpg';
        const key = `equipment-photos/${uuidv4()}.${ext}`;

        const url = await getSignedUrl(
            s3,
            new PutObjectCommand({
                Bucket: BUCKET,
                Key: key,
                ContentType: contentType,
            }),
            { expiresIn: 300 }  // 5 minutes
        );

        return respond(200, { url, key, expiresIn: 300 }, event as unknown as APIGatewayProxyEvent);
    }

    if (path.endsWith('/url')) {
        // ── Generate pre-signed GET URL ──
        const { key } = event.queryStringParameters ?? {};
        if (!key) return respondError(400, 'Missing key.', event as unknown as APIGatewayProxyEvent);

        const url = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: BUCKET, Key: key }),
            { expiresIn: 3600 }  // 1 hour
        );
        return respond(200, { url, expiresIn: 3600 }, event as unknown as APIGatewayProxyEvent);
    }

    return respondError(404, 'Not found.', event as unknown as APIGatewayProxyEvent);
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
