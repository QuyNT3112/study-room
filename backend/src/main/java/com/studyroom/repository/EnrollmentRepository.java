package com.studyroom.repository;

import com.studyroom.entity.Enrollment;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {

    boolean existsByClassroomIdAndStudentId(Long classroomId, Long studentId);

    Optional<Enrollment> findByClassroomIdAndStudentId(Long classroomId, Long studentId);

    @Query("""
            SELECT e FROM Enrollment e
            JOIN FETCH e.student
            WHERE e.classroom.id = :classroomId
            ORDER BY e.enrolledAt DESC
            """)
    List<Enrollment> findByClassroomIdWithStudent(@Param("classroomId") Long classroomId);

    @Query("""
            SELECT e.classroom.id FROM Enrollment e
            WHERE e.student.id = :studentId
            """)
    Set<Long> findJoinedClassroomIdsByStudentId(@Param("studentId") Long studentId);

    @Query("""
            SELECT e.classroom.id, COUNT(e.id)
            FROM Enrollment e
            WHERE e.classroom.id IN :classroomIds
            GROUP BY e.classroom.id
            """)
    List<Object[]> countMembersByClassroomIds(@Param("classroomIds") Collection<Long> classroomIds);

    long countByClassroomId(Long classroomId);

    long countByStudentId(Long studentId);

    @Query("""
            SELECT COUNT(DISTINCT e.student.id)
            FROM Enrollment e
            WHERE e.classroom.teacher.id = :teacherId
            """)
    long countDistinctStudentsByTeacherId(@Param("teacherId") Long teacherId);

    @Query("""
            SELECT COUNT(e.id)
            FROM Enrollment e
            WHERE e.classroom.teacher.id = :teacherId
            """)
    long countTotalEnrollmentsByTeacherId(@Param("teacherId") Long teacherId);
}
