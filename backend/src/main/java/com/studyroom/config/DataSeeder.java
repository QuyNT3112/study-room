package com.studyroom.config;

import com.studyroom.entity.Classroom;
import com.studyroom.entity.ClassroomStatus;
import com.studyroom.entity.Enrollment;
import com.studyroom.entity.Role;
import com.studyroom.entity.User;
import com.studyroom.repository.ClassroomRepository;
import com.studyroom.repository.EnrollmentRepository;
import com.studyroom.repository.UserRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khởi tạo dữ liệu mẫu khi database còn trống để tiện trải nghiệm và kiểm thử MVP.
 */
@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
public class DataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UserRepository userRepository;
    private final ClassroomRepository classroomRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(
            UserRepository userRepository,
            ClassroomRepository classroomRepository,
            EnrollmentRepository enrollmentRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.classroomRepository = classroomRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            return;
        }

        User teacher1 = userRepository.save(new User(
                "Cô Nguyễn Minh Anh",
                "teacher@studyroom.edu.vn",
                passwordEncoder.encode("Teacher@123"),
                Role.TEACHER
        ));

        User teacher2 = userRepository.save(new User(
                "Thầy Trần Quốc Bảo",
                "teacher2@studyroom.edu.vn",
                passwordEncoder.encode("Teacher@123"),
                Role.TEACHER
        ));

        User student1 = userRepository.save(new User(
                "Nguyễn Hoàng Nam",
                "student@studyroom.edu.vn",
                passwordEncoder.encode("Student@123"),
                Role.STUDENT
        ));

        User student2 = userRepository.save(new User(
                "Trần Thảo Vy",
                "student2@studyroom.edu.vn",
                passwordEncoder.encode("Student@123"),
                Role.STUDENT
        ));

        Classroom javaRoom = classroomRepository.save(new Classroom(
                "Lập trình Java & Spring Boot",
                "Xây dựng RESTful API chuyên nghiệp, Spring Security, JPA và kết nối cơ sở dữ liệu quan hệ.",
                "JAVA25",
                ClassroomStatus.ACTIVE,
                teacher1
        ));

        Classroom reactRoom = classroomRepository.save(new Classroom(
                "Phát triển Giao diện React & TypeScript",
                "Thiết kế giao diện SaaS hiện đại với React, TypeScript, Tailwind CSS và quản lý trạng thái ứng dụng.",
                "REACT9",
                ClassroomStatus.ACTIVE,
                teacher1
        ));

        Classroom sqlRoom = classroomRepository.save(new Classroom(
                "Cơ sở dữ liệu Quan hệ & PostgreSQL",
                "Thiết kế lược đồ chuẩn hóa, khóa ngoại, chỉ mục và tối ưu truy vấn SQL thực chiến.",
                "SQL101",
                ClassroomStatus.ACTIVE,
                teacher2
        ));

        Classroom algoRoom = classroomRepository.save(new Classroom(
                "Cấu trúc dữ liệu & Giải thuật (Khóa trước)",
                "Ôn tập thuật toán nền tảng, cây, đồ thị và phân tích độ phức tạp cho phỏng vấn kỹ thuật.",
                "ALGO88",
                ClassroomStatus.CLOSED,
                teacher1
        ));

        enrollmentRepository.saveAll(List.of(
                new Enrollment(javaRoom, student1),
                new Enrollment(javaRoom, student2),
                new Enrollment(reactRoom, student1),
                new Enrollment(sqlRoom, student2),
                new Enrollment(algoRoom, student1)
        ));

        log.info("StudyRoom sample data seeded successfully (2 teachers, 2 students, 4 classrooms).");
    }
}
