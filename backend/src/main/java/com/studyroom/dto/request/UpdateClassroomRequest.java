package com.studyroom.dto.request;

import com.studyroom.entity.ClassroomStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateClassroomRequest(
        @NotBlank(message = "Tên phòng học không được để trống")
        @Size(min = 3, max = 150, message = "Tên phòng học phải từ 3 đến 150 ký tự")
        String name,

        @Size(max = 2000, message = "Mô tả phòng học không vượt quá 2000 ký tự")
        String description,

        @NotNull(message = "Trạng thái phòng học không được để trống")
        ClassroomStatus status
) {
}
