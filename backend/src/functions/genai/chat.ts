// =============================================================
// POST /genai/chat — GenAI Lab Assistant
// Primary: AWS Bedrock (Nova / Claude)
// Fallback: OpenAI GPT-4o-mini
// Injects live equipment + booking context from DynamoDB
// Checks monthly token cap before calling either provider
// =============================================================
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import OpenAI from 'openai';
import { z } from 'zod';
import { withAuth } from '../../middleware/auth';
import { respond, respondError } from '../../utils/response';
import { sanitizeChatMessage } from '../../utils/promptSanitizer';
import { trimContext, estimateTotalTokens } from '../../utils/contextTrimmer';
import { checkUsage, incrementUsage } from '../analytics/usageCap';
import { AuthenticatedEvent, ChatMessage, ChatSession, Equipment, Booking } from '../../types';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynClient);

// OpenAI client — only instantiated if API key is present
const openAiKey = (process.env.OPENAI_API_KEY ?? '').trim();
const hasUsableOpenAiKey = openAiKey.startsWith('sk-') && openAiKey.length > 20;
const openai = hasUsableOpenAiKey
    ? new OpenAI({ apiKey: openAiKey })
    : null;

const schema = z.object({
    message: z.string().min(1).max(2000),
    sessionId: z.string().uuid(),
});

// ── Fetch live lab context from DynamoDB ─────────────────────
async function buildSystemPrompt(userId: string, userRole: string, userEmail: string): Promise<string> {
    const today = new Date().toISOString().split('T')[0];

    let equipmentSection = 'Equipment data unavailable.';
    let bookingSection = 'Booking data unavailable.';
    let myBookingSection = '';

    try {
        // All equipment
        const eqResult = await docClient.send(new ScanCommand({
            TableName: process.env.DYNAMO_EQUIPMENT_TABLE!,
            ProjectionExpression: 'equipmentId, #nm, category, #st, #loc, description, maxBookingHours, requiresApproval',
            ExpressionAttributeNames: { '#nm': 'name', '#st': 'status', '#loc': 'location' },
        }));
        const equipment = (eqResult.Items ?? []) as Equipment[];

        if (equipment.length > 0) {
            const available = equipment.filter(e => e.status === 'AVAILABLE');
            const maintenance = equipment.filter(e => e.status === 'UNDER_MAINTENANCE');
            const retired = equipment.filter(e => e.status === 'RETIRED');

            const lines: string[] = [
                `TOTAL EQUIPMENT: ${equipment.length} (Available: ${available.length}, Under Maintenance: ${maintenance.length}, Retired: ${retired.length})`,
                '',
                'AVAILABLE EQUIPMENT:',
            ];
            for (const eq of available) {
                lines.push(
                    `  - [${eq.equipmentId}] ${eq.name} | Category: ${eq.category} | Location: ${eq.location}` +
                    ` | Max booking: ${eq.maxBookingHours}h | Needs approval: ${eq.requiresApproval ? 'Yes' : 'No'}` +
                    (eq.description ? ` | ${eq.description}` : '')
                );
            }
            if (maintenance.length > 0) {
                lines.push('', 'UNDER MAINTENANCE:');
                for (const eq of maintenance) {
                    lines.push(`  - [${eq.equipmentId}] ${eq.name} | Location: ${eq.location}`);
                }
            }
            equipmentSection = lines.join('\n');
        }
    } catch (err) {
        console.warn('[GenAI] Could not fetch equipment for context:', (err as Error).message);
    }

    try {
        // Today's APPROVED bookings so the assistant knows what's currently booked
        const approvedResult = await docClient.send(new QueryCommand({
            TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
            IndexName: 'status-index',
            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':status': 'APPROVED' },
            Limit: 100,
        }));
        const allApproved = (approvedResult.Items ?? []) as Booking[];
        // Filter to bookings that overlap today
        const todayApproved = allApproved.filter(b => b.slot?.date === today || b.slot?.date >= today);

        if (todayApproved.length > 0) {
            const lines: string[] = ['APPROVED/ACTIVE BOOKINGS (today and upcoming):'];
            for (const b of todayApproved.slice(0, 30)) {
                lines.push(
                    `  - ${b.equipmentName} | User: ${b.userEmail} | Date: ${b.slot?.date} ${b.slot?.startTime}–${b.slot?.endTime}` +
                    ` | Purpose: ${b.purpose}`
                );
            }
            bookingSection = lines.join('\n');
        } else {
            bookingSection = 'No approved bookings for today or upcoming dates.';
        }
    } catch (err) {
        console.warn('[GenAI] Could not fetch bookings for context:', (err as Error).message);
    }

    // User's own bookings (pending + approved)
    if (userRole === 'Student' || userRole === 'Faculty') {
        try {
            const myResult = await docClient.send(new QueryCommand({
                TableName: process.env.DYNAMO_BOOKINGS_TABLE!,
                IndexName: 'userId-index',
                KeyConditionExpression: 'userId = :uid',
                ExpressionAttributeValues: { ':uid': userId },
                ScanIndexForward: false,
                Limit: 20,
            }));
            const myBookings = (myResult.Items ?? []) as Booking[];
            if (myBookings.length > 0) {
                const lines: string[] = ['YOUR BOOKINGS (most recent first):'];
                for (const b of myBookings) {
                    lines.push(
                        `  - [${b.status}] ${b.equipmentName} | Date: ${b.slot?.date} ${b.slot?.startTime}–${b.slot?.endTime}` +
                        (b.rejectionReason ? ` | Rejection reason: ${b.rejectionReason}` : '')
                    );
                }
                myBookingSection = lines.join('\n');
            }
        } catch (err) {
            console.warn('[GenAI] Could not fetch user bookings for context:', (err as Error).message);
        }
    }

    return `You are SmartLab Assistant — an AI integrated into the Smart Lab Equipment Booking System at a university.
You have real-time access to the lab's live data (shown below). Use it to give accurate, specific answers.

CURRENT DATE: ${today}
USER: ${userEmail} | ROLE: ${userRole}

== LIVE LAB DATA ==

${equipmentSection}

${bookingSection}
${myBookingSection ? '\n' + myBookingSection : ''}
== END LIVE DATA ==

INSTRUCTIONS:
- Answer questions about equipment availability, bookings, and lab operations using the live data above.
- When asked "what equipment is available?", list the AVAILABLE equipment from the data above — do NOT say you don't have access.
- When asked about specific equipment, use the exact names and details from the data.
- For booking questions, reference actual slot times and users from the data.
- Be concise, specific, and helpful. Reference exact equipment names and IDs when relevant.
- Booking policies: Students/Faculty can book AVAILABLE equipment. Items marked 'Needs approval: Yes' require LabIncharge/LabAssistant approval before confirmed.
- If a user asks to book equipment, guide them to use the Bookings tab in the app.
- Today's date is ${today}. Use this when answering questions about availability "today".`;
}

// ── Bedrock call — supports both Anthropic Claude and Amazon Nova ────
async function callBedrock(
    messages: ChatMessage[],
    estimatedTokens: number,
    systemPrompt: string,
    modelId: string
): Promise<{ reply: string; tokens: number }> {
    const isAnthropic = modelId.startsWith('anthropic.');
    const isNova = modelId.startsWith('amazon.nova');

    let bedrockBody: unknown;

    if (isAnthropic) {
        // Anthropic Claude format
        bedrockBody = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
        };
    } else if (isNova) {
        // Amazon Nova Converse format
        bedrockBody = {
            system: [{ text: systemPrompt }],
            messages: messages.map(m => ({
                role: m.role,
                content: [{ text: m.content }],
            })),
            inferenceConfig: { maxTokens: 1024, temperature: 0.7 },
        };
    } else {
        throw new Error(`Unsupported Bedrock model format: ${modelId}`);
    }

    const response = await bedrock.send(new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(bedrockBody),
    }));

    const body = JSON.parse(new TextDecoder().decode(response.body));

    let reply: string;
    let tokens: number;

    if (isAnthropic) {
        reply = body.content?.[0]?.text ?? 'Sorry, I could not generate a response.';
        tokens = (body.usage?.input_tokens ?? 0) + (body.usage?.output_tokens ?? 0) || estimatedTokens;
    } else {
        // Nova response: body.output.message.content[0].text
        reply = body.output?.message?.content?.[0]?.text ?? 'Sorry, I could not generate a response.';
        tokens = body.usage?.totalTokens ?? estimatedTokens;
    }

    return { reply, tokens };
}

function getBedrockModelCandidates(): string[] {
    const configured = (process.env.BEDROCK_MODEL_ID ?? '').trim();
    const fallbackRaw = process.env.BEDROCK_FALLBACK_MODELS
        ?? 'amazon.nova-lite-v1:0,amazon.nova-micro-v1:0,amazon.nova-pro-v1:0';

    const models = [
        configured,
        ...fallbackRaw.split(',').map(m => m.trim()),
    ].filter(Boolean);

    return Array.from(new Set(models));
}

async function callBedrockWithFailover(
    messages: ChatMessage[],
    estimatedTokens: number,
    systemPrompt: string
): Promise<{ reply: string; tokens: number; provider: string }> {
    const modelCandidates = getBedrockModelCandidates();
    if (modelCandidates.length === 0) {
        throw new Error('No Bedrock model is configured.');
    }

    let lastError: unknown = null;
    for (const modelId of modelCandidates) {
        try {
            const result = await callBedrock(messages, estimatedTokens, systemPrompt, modelId);
            return { ...result, provider: `bedrock:${modelId}` };
        } catch (err) {
            lastError = err;
            const name = typeof err === 'object' && err !== null && 'name' in err
                ? String((err as { name?: unknown }).name)
                : 'UnknownError';
            const msg = err instanceof Error ? err.message : String(err ?? '');
            console.warn(`[GenAI] Bedrock model ${modelId} failed: ${name} - ${msg}`);
        }
    }

    throw lastError ?? new Error('All Bedrock model candidates failed.');
}

// ── OpenAI fallback ──────────────────────────────────────────
async function callOpenAI(messages: ChatMessage[], estimatedTokens: number, systemPrompt: string): Promise<{ reply: string; tokens: number }> {
    if (!openai) throw new Error('OpenAI API key not configured.');
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 1024,
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ],
    });
    const reply = completion.choices[0]?.message?.content ?? 'Sorry, I could not generate a response.';
    const tokens = completion.usage?.total_tokens ?? estimatedTokens;
    return { reply, tokens };
}

const _handler = async (event: AuthenticatedEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { message, sessionId } = schema.parse(JSON.parse(event.body ?? '{}'));
        const sanitized = sanitizeChatMessage(message);

        // ── Check monthly token cap BEFORE calling any AI provider ──
        const usage = await checkUsage(event.userId);
        if (!usage.allowed) {
            return respond(429, {
                message: `Monthly AI assistant limit reached (${usage.used.toLocaleString()} / ${usage.limit.toLocaleString()} tokens). Resets on ${usage.resetsAt}.`,
                used: usage.used,
                limit: usage.limit,
                resetsAt: usage.resetsAt,
            }, event as unknown as APIGatewayProxyEvent);
        }

        // ── Load session history ──────────────────────────────────────
        const { Item: session } = await docClient.send(new GetCommand({
            TableName: process.env.DYNAMO_CHAT_SESSIONS_TABLE!,
            Key: { userId: event.userId, sessionId },
        })) as { Item?: ChatSession };

        const history: ChatMessage[] = session?.messages ?? [];
        const newMsg: ChatMessage = {
            role: 'user',
            content: sanitized,
            timestamp: new Date().toISOString(),
        };

        const trimmed = trimContext([...history, newMsg]);
        const estimatedTokens = estimateTotalTokens(trimmed);

        // ── Build dynamic system prompt with live lab data ────────────
        const systemPrompt = await buildSystemPrompt(event.userId, event.role, event.email);
        console.log('[GenAI] System prompt length:', systemPrompt.length, 'chars');

        // For Nova models, prepend the live lab context into the first user message
        // so the model reliably sees and uses it (Nova sometimes ignores system prompts)
        const modelId = process.env.BEDROCK_MODEL_ID ?? '';
        const isNova = modelId.startsWith('amazon.nova');
        let messagesForAI = trimmed;
        if (isNova && trimmed.length > 0) {
            const firstMsg = trimmed[0];
            const contextPrefix = `[CONTEXT — use this data to answer my question]\n${systemPrompt}\n[END CONTEXT]\n\nMy question: `;
            messagesForAI = [
                { ...firstMsg, content: contextPrefix + firstMsg.content },
                ...trimmed.slice(1),
            ];
        }

        // ── Call Bedrock first, fall back to OpenAI on any error ─────
        let reply: string;
        let actualTokens: number;
        let provider: string;

        try {
            const result = await callBedrockWithFailover(messagesForAI, estimatedTokens, systemPrompt);
            reply = result.reply;
            actualTokens = result.tokens;
            provider = result.provider;
        } catch (bedrockErr) {
            console.warn('[GenAI] Bedrock unavailable, falling back to OpenAI:', (bedrockErr as Error).message);
            try {
                const result = await callOpenAI(messagesForAI, estimatedTokens, systemPrompt);
                reply = result.reply;
                actualTokens = result.tokens;
                provider = 'openai';
            } catch (openAiErr) {
                console.error('[GenAI] OpenAI also failed:', (openAiErr as Error).message);
                return respondError(500, 'AI assistant is temporarily unavailable. Both providers failed.', event as unknown as APIGatewayProxyEvent);
            }
        }

        const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: reply,
            timestamp: new Date().toISOString(),
        };

        // ── Persist usage + session ───────────────────────────────────
        await incrementUsage(event.userId, actualTokens);

        const updatedMessages = [...history, newMsg, assistantMsg].slice(-50);
        const ttl = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

        await docClient.send(new PutCommand({
            TableName: process.env.DYNAMO_CHAT_SESSIONS_TABLE!,
            Item: {
                userId: event.userId,
                sessionId,
                messages: updatedMessages,
                createdAt: session?.createdAt ?? new Date().toISOString(),
                ttl,
            },
        }));

        return respond(200, {
            reply,
            sessionId,
            tokensUsed: actualTokens,
            provider,
            usage: { used: usage.used + actualTokens, limit: usage.limit },
        }, event as unknown as APIGatewayProxyEvent);

    } catch (err) {
        if (err instanceof z.ZodError) return respondError(400, err.errors[0].message, event as unknown as APIGatewayProxyEvent);
        console.error('genai/chat error:', err);
        return respondError(500, 'AI assistant is temporarily unavailable.', event as unknown as APIGatewayProxyEvent);
    }
};

export const handler = (event: APIGatewayProxyEvent) => withAuth(_handler)(event);
