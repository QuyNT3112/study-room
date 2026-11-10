package com.studyroom.controller;

import com.studyroom.dto.request.CreateClassroomRequest;
import com.studyroom.dto.request.JoinByCodeRequest;
import com.studyroom.dto.request.UpdateClassroomRequest;
import com.studyroom.dto.response.ClassroomDetailResponse;
import com.studyroom.dto.response.ClassroomSummaryResponse;
import com.studyroom.dto.response.MessageResponse;
import com.studyroom.entity.ClassroomStatus;
import com.studyroom.security.UserPrincipal;
import com.studyroom.service.ClassroomService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/classrooms")
public class ClassroomController {

    private final ClassroomService classroomService;

    public ClassroomController(ClassroomService classroomService) {
        this.classroomService = classroomService;
    }

    @GetMapping
    public ResponseEntity<List<ClassroomSummaryResponse>> listAll(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ClassroomStatus status
    ) {
        return ResponseEntity.ok(classroomService.listAllClassrooms(currentUser, search, status));
    }

    @GetMapping("/my")
    public ResponseEntity<List<ClassroomSummaryResponse>> listMine(
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        return ResponseEntity.ok(classroomService.listMyClassrooms(currentUser));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClassroomDetailResponse> getDetail(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(classroomService.getClassroomDetail(currentUser, id));
    }

    @PostMapping
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<ClassroomDetailResponse> create(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestBody CreateClassroomRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(classroomService.createClassroom(currentUser, request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<ClassroomDetailResponse> update(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable Long id,
            @Valid @RequestBody UpdateClassroomRequest request
    ) {
        return ResponseEntity.ok(classroomService.updateClassroom(currentUser, id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<MessageResponse> delete(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable Long id
    ) {
        classroomService.deleteClassroom(currentUser, id);
        return ResponseEntity.ok(new MessageResponse("Đã xóa phòng học thành công"));
    }

    @PostMapping("/join-by-code")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ClassroomDetailResponse> joinByCode(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestBody JoinByCodeRequest request
    ) {
        return ResponseEntity.ok(classroomService.joinClassroomByCode(currentUser, request.roomCode()));
    }

    @PostMapping("/{id}/join")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ClassroomDetailResponse> joinById(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(classroomService.joinClassroomById(currentUser, id));
    }

    @DeleteMapping("/{id}/leave")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<MessageResponse> leave(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable Long id
    ) {
        classroomService.leaveClassroom(currentUser, id);
        return ResponseEntity.ok(new MessageResponse("Đã rời khỏi phòng học"));
    }
}
