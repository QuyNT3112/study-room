package com.studyroom.dto.response;

import com.studyroom.entity.ClassroomStatus;
import java.time.Instant;
import java.util.List;

public record ClassroomDetailResponse(
        Long id,
        String name,
        String description,
        String roomCode,
        ClassroomStatus status,
        TeacherSummaryResponse teacher,
        List<MemberResponse> members,
        int memberCount,
        boolean joined,
        boolean owner,
        boolean liveMeeting,
        int activeMeetingParticipants,
        Instant createdAt,
        Instant updatedAt
) {
}
