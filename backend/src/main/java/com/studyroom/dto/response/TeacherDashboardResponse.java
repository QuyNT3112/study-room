package com.studyroom.dto.response;

import java.util.List;

public record TeacherDashboardResponse(
        long totalClassrooms,
        long activeClassrooms,
        long totalStudents,
        long totalEnrollments,
        List<ClassroomSummaryResponse> recentClassrooms
) {
}
