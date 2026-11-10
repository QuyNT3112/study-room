package com.studyroom.dto.response;

import com.studyroom.entity.Role;
import java.time.Instant;

public record MeetingParticipantResponse(
        Long userId,
        String fullName,
        String email,
        Role role,
        boolean audioEnabled,
        boolean videoEnabled,
        boolean screenSharing,
        boolean handRaised,
        Instant joinedAt
) {
}
