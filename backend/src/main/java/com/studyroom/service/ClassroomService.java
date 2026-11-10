package com.studyroom.service;

import com.studyroom.dto.request.CreateClassroomRequest;
import com.studyroom.dto.request.UpdateClassroomRequest;
import com.studyroom.dto.response.ClassroomDetailResponse;
import com.studyroom.dto.response.ClassroomSummaryResponse;
import com.studyroom.dto.response.MemberResponse;
import com.studyroom.dto.response.TeacherSummaryResponse;
import com.studyroom.entity.Classroom;
import com.studyroom.entity.ClassroomStatus;
import com.studyroom.entity.Enrollment;
import com.studyroom.entity.MeetingStatus;
import com.studyroom.entity.Role;
import com.studyroom.entity.User;
import com.studyroom.exception.BadRequestException;
import com.studyroom.exception.DuplicateResourceException;
import com.studyroom.exception.ForbiddenOperationException;
import com.studyroom.exception.ResourceNotFoundException;
import com.studyroom.repository.ClassroomRepository;
import com.studyroom.repository.EnrollmentRepository;
import com.studyroom.repository.MeetingSessionRepository;
import com.studyroom.repository.UserRepository;
import com.studyroom.security.UserPrincipal;
import java.security.SecureRandom;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Xử lý nghiệp vụ quản lý phòng học (CRUD cho Giáo viên, tham gia/rời phòng cho Học sinh).
 */
@Service
public class ClassroomService {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ClassroomRepository classroomRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final UserRepository userRepository;
    private final MeetingSessionRepository meetingSessionRepository;
    private final MeetingRoomRegistry meetingRoomRegistry;

    public ClassroomService(
            ClassroomRepository classroomRepository,
            EnrollmentRepository enrollmentRepository,
            UserRepository userRepository,
            MeetingSessionRepository meetingSessionRepository,
            MeetingRoomRegistry meetingRoomRegistry
    ) {
        this.classroomRepository = classroomRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.userRepository = userRepository;
        this.meetingSessionRepository = meetingSessionRepository;
        this.meetingRoomRegistry = meetingRoomRegistry;
    }

    @Transactional(readOnly = true)
    public List<ClassroomSummaryResponse> listAllClassrooms(
            UserPrincipal currentUser,
            String keyword,
            ClassroomStatus status
    ) {
        String cleanKeyword = (keyword == null || keyword.isBlank()) ? null : keyword.trim();
        List<Classroom> classrooms = classroomRepository.searchAllWithTeacher(cleanKeyword, status);
        return toSummaryList(classrooms, currentUser);
    }

    @Transactional(readOnly = true)
    public List<ClassroomSummaryResponse> listMyClassrooms(UserPrincipal currentUser) {
        List<Classroom> classrooms = currentUser.getRole() == Role.TEACHER
                ? classroomRepository.findByTeacherIdWithTeacher(currentUser.getId())
                : classroomRepository.findJoinedByStudentIdWithTeacher(currentUser.getId());
        return toSummaryList(classrooms, currentUser);
    }

    @Transactional(readOnly = true)
    public List<ClassroomSummaryResponse> getRecentClassroomsForTeacher(UserPrincipal teacher, int limit) {
        List<Classroom> classrooms = classroomRepository.findByTeacherIdWithTeacher(teacher.getId());
        List<Classroom> limited = classrooms.size() > limit ? classrooms.subList(0, limit) : classrooms;
        return toSummaryList(limited, teacher);
    }

    @Transactional(readOnly = true)
    public ClassroomDetailResponse getClassroomDetail(UserPrincipal currentUser, Long classroomId) {
        Classroom classroom = classroomRepository.findByIdWithTeacher(classroomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng học"));
        return buildDetailResponse(classroom, currentUser);
    }

    @Transactional
    public ClassroomDetailResponse createClassroom(UserPrincipal currentUser, CreateClassroomRequest request) {
        requireTeacher(currentUser);
        User teacher = userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản giáo viên"));

        Classroom classroom = new Classroom(
                request.name().trim(),
                normalizeDescription(request.description()),
                generateUniqueRoomCode(),
                request.status() != null ? request.status() : ClassroomStatus.ACTIVE,
                teacher
        );

        Classroom saved = classroomRepository.save(classroom);
        return buildDetailResponse(saved, currentUser);
    }

    @Transactional
    public ClassroomDetailResponse updateClassroom(
            UserPrincipal currentUser,
            Long classroomId,
            UpdateClassroomRequest request
    ) {
        requireTeacher(currentUser);
        Classroom classroom = classroomRepository.findByIdWithTeacher(classroomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng học"));

        if (!classroom.getTeacher().getId().equals(currentUser.getId())) {
            throw new ForbiddenOperationException("Bạn không có quyền chỉnh sửa phòng học của giáo viên khác");
        }

        classroom.setName(request.name().trim());
        classroom.setDescription(normalizeDescription(request.description()));
        classroom.setStatus(request.status());

        Classroom updated = classroomRepository.save(classroom);
        return buildDetailResponse(updated, currentUser);
    }

    @Transactional
    public void deleteClassroom(UserPrincipal currentUser, Long classroomId) {
        requireTeacher(currentUser);
        Classroom classroom = classroomRepository.findByIdWithTeacher(classroomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng học"));

        if (!classroom.getTeacher().getId().equals(currentUser.getId())) {
            throw new ForbiddenOperationException("Bạn không có quyền xóa phòng học của giáo viên khác");
        }

        meetingRoomRegistry.broadcastMeetingEnded(classroomId, currentUser.getId());
        classroomRepository.delete(classroom);
    }

    @Transactional
    public ClassroomDetailResponse joinClassroomById(UserPrincipal currentUser, Long classroomId) {
        requireStudent(currentUser);
        Classroom classroom = classroomRepository.findByIdWithTeacher(classroomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng học"));
        return enrollStudent(currentUser, classroom);
    }

    @Transactional
    public ClassroomDetailResponse joinClassroomByCode(UserPrincipal currentUser, String rawRoomCode) {
        requireStudent(currentUser);
        String normalizedCode = rawRoomCode.trim().toUpperCase(Locale.ROOT);
        Classroom classroom = classroomRepository.findByRoomCodeIgnoreCaseWithTeacher(normalizedCode)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy phòng học với mã: " + normalizedCode));
        return enrollStudent(currentUser, classroom);
    }

    @Transactional
    public void leaveClassroom(UserPrincipal currentUser, Long classroomId) {
        requireStudent(currentUser);
        if (!classroomRepository.existsById(classroomId)) {
            throw new ResourceNotFoundException("Không tìm thấy phòng học");
        }
        Enrollment enrollment = enrollmentRepository.findByClassroomIdAndStudentId(classroomId, currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Bạn chưa tham gia phòng học này"));
        enrollmentRepository.delete(enrollment);
    }

    private ClassroomDetailResponse enrollStudent(UserPrincipal currentUser, Classroom classroom) {
        if (classroom.getStatus() != ClassroomStatus.ACTIVE) {
            throw new BadRequestException("Phòng học này đã đóng, hiện không thể tham gia");
        }
        if (enrollmentRepository.existsByClassroomIdAndStudentId(classroom.getId(), currentUser.getId())) {
            throw new DuplicateResourceException("Bạn đã tham gia phòng học này rồi");
        }

        User student = userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản học sinh"));

        enrollmentRepository.save(new Enrollment(classroom, student));
        return buildDetailResponse(classroom, currentUser);
    }

    private List<ClassroomSummaryResponse> toSummaryList(List<Classroom> classrooms, UserPrincipal currentUser) {
        if (classrooms.isEmpty()) {
            return List.of();
        }

        List<Long> classroomIds = classrooms.stream().map(Classroom::getId).toList();
        Map<Long, Long> memberCounts = new HashMap<>();
        for (Object[] row : enrollmentRepository.countMembersByClassroomIds(classroomIds)) {
            memberCounts.put((Long) row[0], (Long) row[1]);
        }

        Set<Long> joinedIds = currentUser.getRole() == Role.STUDENT
                ? enrollmentRepository.findJoinedClassroomIdsByStudentId(currentUser.getId())
                : Collections.emptySet();

        Set<Long> liveClassroomIds = meetingSessionRepository.findLiveClassroomIds(classroomIds, MeetingStatus.LIVE);
        Map<Long, Integer> meetingCounts = meetingRoomRegistry.getParticipantCountsByClassroomIds(liveClassroomIds);

        return classrooms.stream()
                .map(c -> {
                    boolean liveMeeting = liveClassroomIds.contains(c.getId());
                    return new ClassroomSummaryResponse(
                            c.getId(),
                            c.getName(),
                            c.getDescription(),
                            c.getRoomCode(),
                            c.getStatus(),
                            new TeacherSummaryResponse(
                                    c.getTeacher().getId(),
                                    c.getTeacher().getFullName(),
                                    c.getTeacher().getEmail()
                            ),
                            memberCounts.getOrDefault(c.getId(), 0L),
                            joinedIds.contains(c.getId()),
                            c.getTeacher().getId().equals(currentUser.getId()),
                            liveMeeting,
                            liveMeeting ? meetingCounts.getOrDefault(c.getId(), 0) : 0,
                            c.getCreatedAt(),
                            c.getUpdatedAt()
                    );
                })
                .toList();
    }

    private ClassroomDetailResponse buildDetailResponse(Classroom classroom, UserPrincipal currentUser) {
        List<Enrollment> enrollments = enrollmentRepository.findByClassroomIdWithStudent(classroom.getId());
        List<MemberResponse> members = enrollments.stream()
                .map(e -> new MemberResponse(
                        e.getStudent().getId(),
                        e.getStudent().getFullName(),
                        e.getStudent().getEmail(),
                        e.getEnrolledAt()
                ))
                .toList();

        boolean joined = currentUser.getRole() == Role.STUDENT
                && members.stream().anyMatch(m -> m.id().equals(currentUser.getId()));
        boolean owner = classroom.getTeacher().getId().equals(currentUser.getId());
        boolean liveMeeting = meetingSessionRepository.existsByClassroomIdAndStatus(
                classroom.getId(), MeetingStatus.LIVE);
        int activeMeetingParticipants = liveMeeting
                ? meetingRoomRegistry.getParticipantCount(classroom.getId())
                : 0;

        return new ClassroomDetailResponse(
                classroom.getId(),
                classroom.getName(),
                classroom.getDescription(),
                classroom.getRoomCode(),
                classroom.getStatus(),
                new TeacherSummaryResponse(
                        classroom.getTeacher().getId(),
                        classroom.getTeacher().getFullName(),
                        classroom.getTeacher().getEmail()
                ),
                members,
                members.size(),
                joined,
                owner,
                liveMeeting,
                activeMeetingParticipants,
                classroom.getCreatedAt(),
                classroom.getUpdatedAt()
        );
    }

    private String generateUniqueRoomCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            }
            String candidate = sb.toString();
            if (!classroomRepository.existsByRoomCodeIgnoreCase(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Không thể tạo mã phòng học duy nhất");
    }

    private String normalizeDescription(String description) {
        return description == null ? "" : description.trim();
    }

    private void requireTeacher(UserPrincipal user) {
        if (user.getRole() != Role.TEACHER) {
            throw new ForbiddenOperationException("Chỉ giáo viên mới có quyền thực hiện thao tác này");
        }
    }

    private void requireStudent(UserPrincipal user) {
        if (user.getRole() != Role.STUDENT) {
            throw new ForbiddenOperationException("Chỉ học sinh mới có quyền thực hiện thao tác này");
        }
    }
}
