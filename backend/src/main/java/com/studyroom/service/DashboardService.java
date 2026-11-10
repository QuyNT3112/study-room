package com.studyroom.service;

import com.studyroom.dto.response.ClassroomSummaryResponse;
import com.studyroom.dto.response.StudentDashboardResponse;
import com.studyroom.dto.response.TeacherDashboardResponse;
import com.studyroom.dto.response.UserResponse;
import com.studyroom.entity.ClassroomStatus;
import com.studyroom.entity.Role;
import com.studyroom.exception.ForbiddenOperationException;
import com.studyroom.repository.ClassroomRepository;
import com.studyroom.repository.EnrollmentRepository;
import com.studyroom.security.UserPrincipal;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tổng hợp dữ liệu thống kê cho Dashboard Giáo viên và Học sinh.
 */
@Service
public class DashboardService {

    private final ClassroomRepository classroomRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final ClassroomService classroomService;
    private final AuthService authService;

    public DashboardService(
            ClassroomRepository classroomRepository,
            EnrollmentRepository enrollmentRepository,
            ClassroomService classroomService,
            AuthService authService
    ) {
        this.classroomRepository = classroomRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.classroomService = classroomService;
        this.authService = authService;
    }

    @Transactional(readOnly = true)
    public TeacherDashboardResponse getTeacherDashboard(UserPrincipal currentUser) {
        if (currentUser.getRole() != Role.TEACHER) {
            throw new ForbiddenOperationException("Chỉ giáo viên mới có thể xem Dashboard giáo viên");
        }

        long teacherId = currentUser.getId();
        long totalClassrooms = classroomRepository.countByTeacherId(teacherId);
        long activeClassrooms = classroomRepository.countByTeacherIdAndStatus(teacherId, ClassroomStatus.ACTIVE);
        long totalStudents = enrollmentRepository.countDistinctStudentsByTeacherId(teacherId);
        long totalEnrollments = enrollmentRepository.countTotalEnrollmentsByTeacherId(teacherId);
        List<ClassroomSummaryResponse> recentClassrooms =
                classroomService.getRecentClassroomsForTeacher(currentUser, 5);

        return new TeacherDashboardResponse(
                totalClassrooms,
                activeClassrooms,
                totalStudents,
                totalEnrollments,
                recentClassrooms
        );
    }

    @Transactional(readOnly = true)
    public StudentDashboardResponse getStudentDashboard(UserPrincipal currentUser) {
        if (currentUser.getRole() != Role.STUDENT) {
            throw new ForbiddenOperationException("Chỉ học sinh mới có thể xem Dashboard học sinh");
        }

        List<ClassroomSummaryResponse> myClassrooms = classroomService.listMyClassrooms(currentUser);
        UserResponse account = authService.getCurrentUser(currentUser);

        return new StudentDashboardResponse(
                myClassrooms.size(),
                myClassrooms,
                account
        );
    }
}
