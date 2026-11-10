package com.studyroom.dto.response;

import java.time.Instant;

public record MemberResponse(
        Long id,
        String fullName,
        String email,
        Instant enrolledAt
) {
}
