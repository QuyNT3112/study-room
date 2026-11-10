package com.studyroom.dto.response;

import java.util.List;

public record StudentDashboardResponse(
        long totalJoinedClassrooms,
        List<ClassroomSummaryResponse> myClassrooms,
        UserResponse account
) {
}
