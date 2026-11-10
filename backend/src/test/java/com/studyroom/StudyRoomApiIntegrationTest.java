package com.studyroom;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studyroom.entity.User;
import com.studyroom.repository.ClassroomRepository;
import com.studyroom.repository.EnrollmentRepository;
import com.studyroom.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
class StudyRoomApiIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ClassroomRepository classroomRepository;

    @Autowired
    private EnrollmentRepository enrollmentRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        enrollmentRepository.deleteAll();
        classroomRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void fullStudyRoomWorkflowAndAuthorizationShouldWork() throws Exception {
        // 1. Register Teacher 1, Teacher 2, Student 1
        String teacher1Token = registerAndGetToken("Cô Lan", "lan@studyroom.vn", "Secret123", "TEACHER");
        String teacher2Token = registerAndGetToken("Thầy Hùng", "hung@studyroom.vn", "Secret123", "TEACHER");
        String student1Token = registerAndGetToken("Em Nam", "nam@studyroom.vn", "Secret123", "STUDENT");

        // Verify password is BCrypt-encoded in DB and never leaked in API
        User teacherInDb = userRepository.findByEmailIgnoreCase("lan@studyroom.vn").orElseThrow();
        assertThat(teacherInDb.getPasswordHash()).startsWith("$2");
        assertThat(teacherInDb.getPasswordHash()).isNotEqualTo("Secret123");

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + teacher1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("lan@studyroom.vn"))
                .andExpect(content().string(not(containsString("passwordHash"))));

        // Duplicate email registration fails with 409
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Duplicate",
                                  "email": "LAN@studyroom.vn",
                                  "password": "Password123",
                                  "role": "STUDENT"
                                }
                                """))
                .andExpect(status().isConflict());

        // Validation error returns 400 with fieldErrors
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "",
                                  "email": "not-an-email",
                                  "password": "123",
                                  "role": "STUDENT"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.email").exists());

        // 2. Teacher creates classroom; Student is forbidden from creating
        mockMvc.perform(post("/api/classrooms")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + student1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Unauthorized Room",
                                  "description": "Should fail"
                                }
                                """))
                .andExpect(status().isForbidden());

        MvcResult createResult = mockMvc.perform(post("/api/classrooms")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + teacher1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Java Spring Boot MVP",
                                  "description": "Khóa học thực hành"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Java Spring Boot MVP"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.roomCode").isNotEmpty())
                .andReturn();

        JsonNode createdRoom = objectMapper.readTree(createResult.getResponse().getContentAsString());
        long roomId = createdRoom.get("id").asLong();
        String roomCode = createdRoom.get("roomCode").asText();

        // Teacher 2 cannot update or delete Teacher 1's classroom
        mockMvc.perform(put("/api/classrooms/" + roomId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + teacher2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Hijacked",
                                  "description": "Nope",
                                  "status": "ACTIVE"
                                }
                                """))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/classrooms/" + roomId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + teacher2Token))
                .andExpect(status().isForbidden());

        // 3. Student joins by roomCode (case-insensitive)
        mockMvc.perform(post("/api/classrooms/join-by-code")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + student1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomCode\": \"" + roomCode.toLowerCase() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.memberCount").value(1))
                .andExpect(jsonPath("$.joined").value(true))
                .andExpect(jsonPath("$.members", hasSize(1)))
                .andExpect(jsonPath("$.members[0].fullName").value("Em Nam"));

        // Duplicate enrollment fails with 409
        mockMvc.perform(post("/api/classrooms/" + roomId + "/join")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + student1Token))
                .andExpect(status().isConflict());

        // Teacher cannot join a classroom as student
        mockMvc.perform(post("/api/classrooms/" + roomId + "/join")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + teacher2Token))
                .andExpect(status().isForbidden());

        // 4. Dashboards & Role access controls
        mockMvc.perform(get("/api/dashboard/teacher")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + teacher1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalClassrooms").value(1))
                .andExpect(jsonPath("$.activeClassrooms").value(1))
                .andExpect(jsonPath("$.totalStudents").value(1))
                .andExpect(jsonPath("$.recentClassrooms", hasSize(1)));

        mockMvc.perform(get("/api/dashboard/teacher")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + student1Token))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/dashboard/student")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + student1Token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalJoinedClassrooms").value(1))
                .andExpect(jsonPath("$.myClassrooms", hasSize(1)))
                .andExpect(jsonPath("$.account.email").value("nam@studyroom.vn"));

        mockMvc.perform(get("/api/dashboard/student")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + teacher1Token))
                .andExpect(status().isForbidden());

        // 5. Student leaves classroom, Teacher closes room, Student cannot rejoin closed room
        mockMvc.perform(delete("/api/classrooms/" + roomId + "/leave")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + student1Token))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/classrooms/" + roomId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + teacher1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Java Spring Boot MVP (Closed)",
                                  "description": "Đã kết thúc khóa",
                                  "status": "CLOSED"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.memberCount").value(0));

        mockMvc.perform(post("/api/classrooms/" + roomId + "/join")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + student1Token))
                .andExpect(status().isBadRequest());

        // 6. Teacher deletes classroom
        mockMvc.perform(delete("/api/classrooms/" + roomId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + teacher1Token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/classrooms/" + roomId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + teacher1Token))
                .andExpect(status().isNotFound());

        // 7. Logout revokes JWT token
        mockMvc.perform(post("/api/auth/logout")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + student1Token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + student1Token))
                .andExpect(status().isUnauthorized());

        // Login with valid and invalid password
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "nam@studyroom.vn",
                                  "password": "WrongPassword"
                                }
                                """))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "nam@studyroom.vn",
                                  "password": "Secret123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    private String registerAndGetToken(String fullName, String email, String password, String role)
            throws Exception {
        String body = """
                {
                  "fullName": "%s",
                  "email": "%s",
                  "password": "%s",
                  "role": "%s"
                }
                """.formatted(fullName, email, password, role);

        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.get("accessToken").asText();
    }
}
