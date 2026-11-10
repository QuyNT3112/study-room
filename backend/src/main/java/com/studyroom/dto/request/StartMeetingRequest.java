package com.studyroom.dto.request;

import jakarta.validation.constraints.Size;

public record StartMeetingRequest(
        @Size(max = 180, message = "Tiêu đề buổi họp tối đa 180 ký tự")
        String title
) {
}
