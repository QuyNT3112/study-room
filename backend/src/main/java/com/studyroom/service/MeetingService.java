package com.studyroom.service;

import com.studyroom.dto.request.StartMeetingRequest;
import com.studyroom.dto.response.MeetingOverviewResponse;
import com.studyroom.dto.response.MeetingParticipantResponse;
import com.studyroom.dto.response.MeetingSessionResponse;
import com.studyroom.dto.response.TeacherSummaryResponse;
import com.studyroom.entity.Classroom;
import com.studyroom.entity.ClassroomStatus;
import com.studyroom.entity.MeetingSession;
import com.studyroom.entity.MeetingStatus;
import com.studyroom.entity.Role;
import com.studyroom.entity.User;
import com.studyroom.exception.BadRequestException;
import com.studyroom.exception.ForbiddenOperationException;
import com.studyroom.exception.ResourceNotFoundException;
import com.studyroom.repository.ClassroomRepository;
import com.studyroom.repository.EnrollmentRepository;
import com.studyroom.repository.MeetingSessionRepository;
import com.studyroom.repository.UserRepository;
import com.studyroom.security.UserPrincipal;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Xử lý nghiệp vụ cuộc họp trực tuyến (khởi tạo, kết thúc, kiểm tra quyền vào phòng họp và lịch sử họp).
 */
@Service
public class MeetingService {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int MEETING_CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final MeetingSessionRepository meetingSessionRepository;
    private final ClassroomRepository classroomRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final UserRepository userRepository;
    private final MeetingRoomRegistry meetingRoomRegistry;

    public MeetingService(
            MeetingSessionRepository meetingSessionRepository,
            ClassroomRepository classroomRepository,
            EnrollmentRepository enrollmentRepository,
            UserRepository userRepository,
            MeetingRoomRegistry meetingRoomRegistry
    ) {
        this.meetingSessionRepository = meetingSessionRepository;
        this.classroomRepository = classroomRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.userRepository = userRepository;
        this.meetingRoomRegistry = meetingRoomRegistry;
    }

    @Transactional(readOnly = true)
    public MeetingOverviewResponse getMeetingOverview(UserPrincipal currentUser, Long classroomId) {
        Classroom classroom = findClassroomOrThrow(classroomId);
        boolean isOwner = isClassroomOwner(currentUser, classroom);
        boolean isEnrolled = isEnrolledStudent(currentUser, classroomId);

        if (!isOwner && !isEnrolled) {
            throw new ForbiddenOperationException(
                    "Bạn cần là giáo viên phụ trách hoặc học sinh đã tham gia lớp để truy cập phòng họp");
        }

        List<MeetingSession> history = meetingSessionRepository.findHistoryByClassroomIdWithDetails(classroomId);
        MeetingSession activeSession = history.stream()
                .filter(s -> s.getStatus() == MeetingStatus.LIVE)
                .findFirst()
                .orElse(null);

        boolean canStart = isOwner && classroom.getStatus() == ClassroomStatus.ACTIVE;
        boolean canJoin = activeSession != null && (isOwner || isEnrolled);

        MeetingSessionResponse currentResponse = activeSession != null
                ? toResponse(activeSession, isOwner, canJoin)
                : null;

        List<MeetingSessionResponse> recentResponses = history.stream()
                .limit(8)
                .map(session -> toResponse(
                        session,
                        isOwner,
                        session.getStatus() == MeetingStatus.LIVE && (isOwner || isEnrolled)
                ))
                .toList();

        return new MeetingOverviewResponse(
                activeSession != null,
                canStart,
                canJoin,
                currentResponse,
                recentResponses
        );
    }

    @Transactional
    public MeetingSessionResponse startMeeting(
            UserPrincipal currentUser,
            Long classroomId,
            StartMeetingRequest request
    ) {
        if (currentUser.getRole() != Role.TEACHER) {
            throw new ForbiddenOperationException("Chỉ giáo viên mới có thể mở buổi họp trực tuyến");
        }

        Classroom classroom = findClassroomOrThrow(classroomId);
        if (!classroom.getTeacher().getId().equals(currentUser.getId())) {
            throw new ForbiddenOperationException("Bạn không có quyền mở buổi họp cho phòng học của giáo viên khác");
        }
        if (classroom.getStatus() != ClassroomStatus.ACTIVE) {
            throw new BadRequestException("Phòng học đã đóng, không thể mở buổi họp mới");
        }

        MeetingSession existing = meetingSessionRepository.findActiveByClassroomId(classroomId).orElse(null);
        if (existing != null) {
            return toResponse(existing, true, true);
        }

        User host = userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản giáo viên"));

        String rawTitle = request != null ? request.title() : null;
        String cleanTitle = (rawTitle == null || rawTitle.isBlank())
                ? "Buổi học trực tuyến - " + classroom.getName()
                : rawTitle.trim();
        if (cleanTitle.length() > 180) {
            cleanTitle = cleanTitle.substring(0, 180);
        }

        MeetingSession created = new MeetingSession(
                classroom,
                host,
                cleanTitle,
                generateUniqueMeetingCode()
        );
        MeetingSession saved = meetingSessionRepository.save(created);
        return toResponse(saved, true, true);
    }

    @Transactional
    public MeetingSessionResponse endMeeting(UserPrincipal currentUser, Long classroomId) {
        if (currentUser.getRole() != Role.TEACHER) {
            throw new ForbiddenOperationException("Chỉ giáo viên mới có thể kết thúc buổi họp");
        }

        Classroom classroom = findClassroomOrThrow(classroomId);
        if (!classroom.getTeacher().getId().equals(currentUser.getId())) {
            throw new ForbiddenOperationException("Bạn không có quyền kết thúc buổi họp của giáo viên khác");
        }

        MeetingSession activeSession = meetingSessionRepository.findActiveByClassroomId(classroomId)
                .orElseThrow(() -> new ResourceNotFoundException("Hiện không có buổi họp nào đang diễn ra trong phòng này"));

        activeSession.setStatus(MeetingStatus.ENDED);
        activeSession.setEndedAt(Instant.now());
        MeetingSession saved = meetingSessionRepository.save(activeSession);

        meetingRoomRegistry.broadcastMeetingEnded(classroomId, currentUser.getId());
        return toResponse(saved, true, false);
    }

    @Transactional(readOnly = true)
    public List<MeetingSessionResponse> listMyLiveMeetings(UserPrincipal currentUser) {
        List<MeetingSession> sessions = currentUser.getRole() == Role.TEACHER
                ? meetingSessionRepository.findLiveByTeacherId(currentUser.getId())
                : meetingSessionRepository.findLiveByStudentId(currentUser.getId());

        return sessions.stream()
                .map(session -> toResponse(
                        session,
                        session.getClassroom().getTeacher().getId().equals(currentUser.getId()),
                        true
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public MeetingSession verifyMeetingJoinAccess(UserPrincipal currentUser, Long classroomId) {
        Classroom classroom = findClassroomOrThrow(classroomId);
        boolean isOwner = isClassroomOwner(currentUser, classroom);
        boolean isEnrolled = isEnrolledStudent(currentUser, classroomId);

        if (!isOwner && !isEnrolled) {
            throw new ForbiddenOperationException("Bạn không phải thành viên của phòng học này");
        }

        return meetingSessionRepository.findActiveByClassroomId(classroomId)
                .orElseThrow(() -> new BadRequestException("Buổi họp hiện chưa bắt đầu hoặc đã kết thúc"));
    }

    private MeetingSessionResponse toResponse(MeetingSession session, boolean canManage, boolean canJoin) {
        Classroom classroom = session.getClassroom();
        List<MeetingParticipantResponse> participants = session.getStatus() == MeetingStatus.LIVE
                ? meetingRoomRegistry.getActiveParticipants(classroom.getId())
                : List.of();

        return new MeetingSessionResponse(
                session.getId(),
                classroom.getId(),
                classroom.getName(),
                classroom.getRoomCode(),
                session.getTitle(),
                session.getMeetingCode(),
                session.getStatus(),
                new TeacherSummaryResponse(
                        session.getHost().getId(),
                        session.getHost().getFullName(),
                        session.getHost().getEmail()
                ),
                participants,
                participants.size(),
                session.getStartedAt(),
                session.getEndedAt(),
                canManage,
                canJoin
        );
    }

    private Classroom findClassroomOrThrow(Long classroomId) {
        return classroomRepository.findByIdWithTeacher(classroomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng học"));
    }

    private boolean isClassroomOwner(UserPrincipal user, Classroom classroom) {
        return user.getRole() == Role.TEACHER && classroom.getTeacher().getId().equals(user.getId());
    }

    private boolean isEnrolledStudent(UserPrincipal user, Long classroomId) {
        return user.getRole() == Role.STUDENT
                && enrollmentRepository.existsByClassroomIdAndStudentId(classroomId, user.getId());
    }

    private String generateUniqueMeetingCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder("MT-");
            for (int i = 0; i < MEETING_CODE_LENGTH; i++) {
                sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            }
            String candidate = sb.toString();
            if (!meetingSessionRepository.existsByMeetingCodeIgnoreCase(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Không thể tạo mã buổi họp duy nhất");
    }
}
