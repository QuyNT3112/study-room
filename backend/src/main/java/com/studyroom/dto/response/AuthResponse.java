package com.studyroom.dto.response;

public record AuthResponse(
        String accessToken,
        String tokenType,
        UserResponse user
) {
}
