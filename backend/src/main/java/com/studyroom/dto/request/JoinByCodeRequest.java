package com.studyroom.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record JoinByCodeRequest(
        @NotBlank(message = "Vui lòng nhập mã phòng học")
        @Size(min = 4, max = 12, message = "Mã phòng học không hợp lệ")
        String roomCode
) {
}
