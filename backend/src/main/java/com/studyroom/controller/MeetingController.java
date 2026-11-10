package com.studyroom.controller;

import com.studyroom.dto.request.StartMeetingRequest;
import com.studyroom.dto.response.MeetingOverviewResponse;
import com.studyroom.dto.response.MeetingSessionResponse;
import com.studyroom.security.UserPrincipal;
import com.studyroom.service.MeetingService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST API điều khiển buổi họp trực tuyến gắn với từng phòng học.
 */
@RestController
@RequestMapping("/api")
public class MeetingController {

    private final MeetingService meetingService;

    public MeetingController(MeetingService meetingService) {
        this.meetingService = meetingService;
    }

    @GetMapping("/meetings/live")
    public ResponseEntity<List<MeetingSessionResponse>> listMyLiveMeetings(
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        return ResponseEntity.ok(meetingService.listMyLiveMeetings(currentUser));
    }

    @GetMapping("/classrooms/{classroomId}/meeting")
    public ResponseEntity<MeetingOverviewResponse> getOverview(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable Long classroomId
    ) {
        return ResponseEntity.ok(meetingService.getMeetingOverview(currentUser, classroomId));
    }

    @PostMapping("/classrooms/{classroomId}/meeting/start")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<MeetingSessionResponse> startMeeting(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable Long classroomId,
            @Valid @RequestBody(required = false) StartMeetingRequest request
    ) {
        return ResponseEntity.ok(meetingService.startMeeting(currentUser, classroomId, request));
    }

    @PostMapping("/classrooms/{classroomId}/meeting/end")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<MeetingSessionResponse> endMeeting(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable Long classroomId
    ) {
        return ResponseEntity.ok(meetingService.endMeeting(currentUser, classroomId));
    }
}
