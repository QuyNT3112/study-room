package com.studyroom.dto.response;

import com.studyroom.entity.Role;
import java.time.Instant;

public record UserResponse(
        Long id,
        String fullName,
        String email,
        Role role,
        Instant createdAt,
        Instant updatedAt
) {
}
