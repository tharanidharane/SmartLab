// =============================================================
// All TypeScript interfaces for the Smart Lab system
// =============================================================

export type Role = 'Student' | 'Faculty' | 'LabAssistant' | 'LabIncharge';

export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WAITLISTED' | 'COMPLETED';

export type EquipmentStatus = 'AVAILABLE' | 'UNDER_MAINTENANCE' | 'RETIRED';

export interface JwtPayload {
    sub: string;         // userId (Cognito sub)
    email: string;
    'custom:role': Role;
    'custom:department': string;
    'cognito:groups': string[];
    exp: number;
    iat: number;
}

export interface AuthenticatedEvent {
    userId: string;
    email: string;
    role: Role;
    department: string;
    headers: Record<string, string | undefined>;
    pathParameters?: Record<string, string | undefined>;
    queryStringParameters?: Record<string, string | undefined>;
    path?: string;
    resource?: string;
    body?: string;
}

export interface Equipment {
    equipmentId: string;
    name: string;
    category: string;
    description: string;
    status: EquipmentStatus;
    location: string;
    imageUrl?: string;
    specifications?: Record<string, string>;
    maxBookingHours: number;      // Faculty can have up to 8, Students up to 4
    requiresApproval: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface TimeSlot {
    date: string;             // ISO date YYYY-MM-DD
    startTime: string;        // HH:mm
    endTime: string;          // HH:mm
    timezone: string;         // IANA tz e.g. Asia/Kolkata
}

export interface Booking {
    bookingId: string;
    userId: string;
    userEmail: string;
    userName: string;
    equipmentId: string;
    equipmentName: string;
    status: BookingStatus;
    slot: TimeSlot;
    purpose: string;
    notes?: string;
    approvedBy?: string;
    approvedAt?: string;
    rejectionReason?: string;
    notificationSent?: boolean;
    waitlistPosition?: number;
    createdAt: string;
    updatedAt: string;
}

export interface User {
    userId: string;
    email: string;            // KMS encrypted
    name: string;
    phone?: string;           // KMS encrypted
    role: Role;
    department: string;
    expoPushToken?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AuditLog {
    logId: string;
    timestamp: string;
    userId: string;
    action: string;
    resource: string;
    resourceId: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
}

export interface WSConnection {
    connectionId: string;
    userId: string;
    role: Role;
    connectedAt: string;
    ttl: number;            // Unix timestamp — auto-expire after 2h
}

export interface ForecastJob {
    jobId: string;
    status: 'STARTED' | 'COMPLETED' | 'FAILED';
    startedAt: string;
    completedAt?: string;
    reason?: string;
    forecastData?: EquipmentForecast[];
    ttl: number;            // 7-day TTL
}

export interface EquipmentForecast {
    equipmentId: string;
    equipmentName: string;
    predictions: Array<{
        date: string;
        predictedBookings: number;
        upperBound: number;
        lowerBound: number;
    }>;
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
}

export interface ChatSession {
    userId: string;
    sessionId: string;
    messages: ChatMessage[];
    createdAt: string;
    ttl: number;            // 24-hour TTL
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface UsageMetric {
    userId: string;
    yearMonth: string;          // YYYY-MM
    tokenCount: number;
    ttl: number;                // First day of next month
}

export interface UtilizationData {
    equipmentId: string;
    equipmentName: string;
    totalBookings: number;
    approvedBookings: number;
    utilizationRate: number;    // 0–100
    avgDurationHours: number;
    peakHour: string;
}

export interface AnomalyRecord {
    equipmentId: string;
    equipmentName: string;
    date: string;
    actualBookings: number;
    expectedBookings: number;
    zScore: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface LambdaResponse {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    lastEvaluatedKey?: string;
}
