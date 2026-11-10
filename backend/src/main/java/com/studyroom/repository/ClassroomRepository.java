package com.studyroom.repository;

import com.studyroom.entity.Classroom;
import com.studyroom.entity.ClassroomStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClassroomRepository extends JpaRepository<Classroom, Long> {

    boolean existsByRoomCodeIgnoreCase(String roomCode);

    @Query("""
            SELECT c FROM Classroom c
            JOIN FETCH c.teacher
            WHERE (:status IS NULL OR c.status = :status)
              AND (:keyword IS NULL
                   OR LOWER(c.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(c.roomCode) LIKE LOWER(CONCAT('%', :keyword, '%')))
            ORDER BY c.updatedAt DESC
            """)
    List<Classroom> searchAllWithTeacher(
            @Param("keyword") String keyword,
            @Param("status") ClassroomStatus status
    );

    @Query("""
            SELECT c FROM Classroom c
            JOIN FETCH c.teacher
            WHERE c.teacher.id = :teacherId
            ORDER BY c.updatedAt DESC
            """)
    List<Classroom> findByTeacherIdWithTeacher(@Param("teacherId") Long teacherId);

    @Query("""
            SELECT c FROM Classroom c
            JOIN FETCH c.teacher
            JOIN Enrollment e ON e.classroom.id = c.id
            WHERE e.student.id = :studentId
            ORDER BY e.enrolledAt DESC
            """)
    List<Classroom> findJoinedByStudentIdWithTeacher(@Param("studentId") Long studentId);

    @Query("""
            SELECT c FROM Classroom c
            JOIN FETCH c.teacher
            WHERE c.id = :id
            """)
    Optional<Classroom> findByIdWithTeacher(@Param("id") Long id);

    @Query("""
            SELECT c FROM Classroom c
            JOIN FETCH c.teacher
            WHERE UPPER(c.roomCode) = UPPER(:roomCode)
            """)
    Optional<Classroom> findByRoomCodeIgnoreCaseWithTeacher(@Param("roomCode") String roomCode);

    long countByTeacherId(Long teacherId);

    long countByTeacherIdAndStatus(Long teacherId, ClassroomStatus status);
}
