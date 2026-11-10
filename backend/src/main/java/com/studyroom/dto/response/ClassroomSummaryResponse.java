package com.studyroom.dto.response;

import com.studyroom.entity.ClassroomStatus;
import java.time.Instant;

public record ClassroomSummaryResponse(
        Long id,
        String name,
        String description,
        String roomCode,
        ClassroomStatus status,
        TeacherSummaryResponse teacher,
        long memberCount,
        boolean joined,
        boolean owner,
        boolean liveMeeting,
        int activeMeetingParticipants,
        Instant createdAt,
        Instant updatedAt
) {
}
