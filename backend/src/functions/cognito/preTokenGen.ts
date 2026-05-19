// =============================================================
// Cognito PreTokenGeneration Trigger — injects custom:role into JWT
// =============================================================
import {
    PreTokenGenerationTriggerEvent,
    PreTokenGenerationTriggerHandler,
} from 'aws-lambda';

export const handler: PreTokenGenerationTriggerHandler = async (
    event: PreTokenGenerationTriggerEvent
) => {
    const groups = event.request.groupConfiguration?.groupsToOverride ?? [];
    // Determine primary role from first Cognito group
    const roleMap: Record<string, string> = {
        Students: 'Student',
        Faculty: 'Faculty',
        LabAssistant: 'LabAssistant',
        LabIncharge: 'LabIncharge',
    };
    const primaryGroup = groups[0] ?? 'Students';
    const role = roleMap[primaryGroup] ?? 'Student';

    event.response = {
        claimsOverrideDetails: {
            claimsToAddOrOverride: {
                'custom:role': role,
            },
        },
    };

    return event;
};
