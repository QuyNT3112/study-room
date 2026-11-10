package com.studyroom.repository;

import com.studyroom.entity.MeetingSession;
import com.studyroom.entity.MeetingStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MeetingSessionRepository extends JpaRepository<MeetingSession, Long> {

    boolean existsByMeetingCodeIgnoreCase(String meetingCode);

    @Query("""
            SELECT m FROM MeetingSession m
            JOIN FETCH m.classroom c
            JOIN FETCH c.teacher
            JOIN FETCH m.host
            WHERE m.classroom.id = :classroomId AND m.status = :status
            ORDER BY m.startedAt DESC
            """)
    List<MeetingSession> findByClassroomIdAndStatusWithDetails(
            @Param("classroomId") Long classroomId,
            @Param("status") MeetingStatus status
    );

    default Optional<MeetingSession> findActiveByClassroomId(Long classroomId) {
        return findByClassroomIdAndStatusWithDetails(classroomId, MeetingStatus.LIVE).stream().findFirst();
    }

    @Query("""
            SELECT m FROM MeetingSession m
            JOIN FETCH m.classroom c
            JOIN FETCH c.teacher
            JOIN FETCH m.host
            WHERE m.classroom.id = :classroomId
            ORDER BY m.startedAt DESC
            """)
    List<MeetingSession> findHistoryByClassroomIdWithDetails(@Param("classroomId") Long classroomId);

    @Query("""
            SELECT m.classroom.id FROM MeetingSession m
            WHERE m.classroom.id IN :classroomIds AND m.status = :status
            """)
    Set<Long> findLiveClassroomIds(
            @Param("classroomIds") Collection<Long> classroomIds,
            @Param("status") MeetingStatus status
    );

    @Query("""
            SELECT m FROM MeetingSession m
            JOIN FETCH m.classroom c
            JOIN FETCH c.teacher
            JOIN FETCH m.host
            WHERE m.status = com.studyroom.entity.MeetingStatus.LIVE
              AND c.teacher.id = :teacherId
            ORDER BY m.startedAt DESC
            """)
    List<MeetingSession> findLiveByTeacherId(@Param("teacherId") Long teacherId);

    @Query("""
            SELECT m FROM MeetingSession m
            JOIN FETCH m.classroom c
            JOIN FETCH c.teacher
            JOIN FETCH m.host
            JOIN Enrollment e ON e.classroom.id = c.id
            WHERE m.status = com.studyroom.entity.MeetingStatus.LIVE
              AND e.student.id = :studentId
            ORDER BY m.startedAt DESC
            """)
    List<MeetingSession> findLiveByStudentId(@Param("studentId") Long studentId);

    boolean existsByClassroomIdAndStatus(Long classroomId, MeetingStatus status);
}
