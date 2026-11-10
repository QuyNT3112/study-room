package com.studyroom.dto.response;

import java.util.List;

public record MeetingOverviewResponse(
        boolean active,
        boolean canStart,
        boolean canJoin,
        MeetingSessionResponse currentSession,
        List<MeetingSessionResponse> recentSessions
) {
}
