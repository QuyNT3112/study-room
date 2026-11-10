package com.studyroom.dto.response;

import com.studyroom.entity.MeetingStatus;
import java.time.Instant;
import java.util.List;

public record MeetingSessionResponse(
        Long id,
        Long classroomId,
        String classroomName,
        String roomCode,
        String title,
        String meetingCode,
        MeetingStatus status,
        TeacherSummaryResponse host,
        List<MeetingParticipantResponse> activeParticipants,
        int participantCount,
        Instant startedAt,
        Instant endedAt,
        boolean canManage,
        boolean canJoin
) {
}
