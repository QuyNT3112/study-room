package com.studyroom.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.Objects;

/**
 * Thực thể ghi danh học sinh vào phòng học.
 * Ràng buộc UNIQUE (classroom_id, student_id) ngăn tham gia trùng lặp.
 */
@Entity
@Table(
    name = "enrollments",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_enrollments_classroom_student", columnNames = {"classroom_id", "student_id"})
    }
)
public class Enrollment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(name = "enrolled_at", nullable = false, updatable = false)
    private Instant enrolledAt;

    public Enrollment() {
    }

    public Enrollment(Classroom classroom, User student) {
        this.classroom = classroom;
        this.student = student;
    }

    @PrePersist
    void onCreate() {
        this.enrolledAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Classroom getClassroom() {
        return classroom;
    }

    public void setClassroom(Classroom classroom) {
        this.classroom = classroom;
    }

    public User getStudent() {
        return student;
    }

    public void setStudent(User student) {
        this.student = student;
    }

    public Instant getEnrolledAt() {
        return enrolledAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Enrollment other)) return false;
        return id != null && Objects.equals(id, other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
