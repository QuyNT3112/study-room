-- ============================================================
-- StudyRoom MVP - Relational Database Schema (PostgreSQL)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('TEACHER', 'STUDENT')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classrooms (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    room_code VARCHAR(12) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
    teacher_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_classrooms_teacher FOREIGN KEY (teacher_id)
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS enrollments (
    id BIGSERIAL PRIMARY KEY,
    classroom_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_enrollments_classroom FOREIGN KEY (classroom_id)
        REFERENCES classrooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_enrollments_classroom_student UNIQUE (classroom_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_room_code ON classrooms(room_code);
CREATE INDEX IF NOT EXISTS idx_enrollments_classroom_id ON enrollments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);

CREATE TABLE IF NOT EXISTS meeting_sessions (
    id BIGSERIAL PRIMARY KEY,
    classroom_id BIGINT NOT NULL,
    host_id BIGINT NOT NULL,
    title VARCHAR(180) NOT NULL,
    meeting_code VARCHAR(16) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'LIVE' CHECK (status IN ('LIVE', 'ENDED')),
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    CONSTRAINT fk_meeting_sessions_classroom FOREIGN KEY (classroom_id)
        REFERENCES classrooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_meeting_sessions_host FOREIGN KEY (host_id)
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_classroom_status ON meeting_sessions(classroom_id, status);
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_code ON meeting_sessions(meeting_code);
