package com.studyroom;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyroom.repository.ClassroomRepository;
import com.studyroom.repository.EnrollmentRepository;
import com.studyroom.repository.MeetingSessionRepository;
import com.studyroom.repository.UserRepository;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class StudyRoomMeetingIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ClassroomRepository classroomRepository;

    @Autowired
    private EnrollmentRepository enrollmentRepository;

    @Autowired
    private MeetingSessionRepository meetingSessionRepository;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @BeforeEach
    void setUp() {
        meetingSessionRepository.deleteAll();
        enrollmentRepository.deleteAll();
        classroomRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void fullOnlineMeetingLifecycleAndWebSocketSignalingShouldWork() throws Exception {
        // 1. Đăng ký Giáo viên 1, Giáo viên 2, Học sinh 1 (đã vào lớp) và Học sinh 2 (chưa vào lớp)
        AuthInfo teacher1 = register("Cô Mai", "mai@studyroom.vn", "Secret123", "TEACHER");
        AuthInfo teacher2 = register("Thầy Minh", "minh@studyroom.vn", "Secret123", "TEACHER");
        AuthInfo student1 = register("Em An", "an@studyroom.vn", "Secret123", "STUDENT");
        AuthInfo student2 = register("Em Bình", "binh@studyroom.vn", "Secret123", "STUDENT");

        // 2. Tạo lớp học và cho student1 tham gia
        JsonNode createdRoom = postJson("/api/classrooms", teacher1.token(), """
                {
                  "name": "Toán Rời Rạc Online",
                  "description": "Lớp có họp trực tuyến"
                }
                """, 201);
        long classroomId = createdRoom.get("id").asLong();
        String roomCode = createdRoom.get("roomCode").asText();

        postJson("/api/classrooms/join-by-code", student1.token(), """
                { "roomCode": "%s" }
                """.formatted(roomCode), 200);

        // 3. Phân quyền: student1, student2, teacher2 không được mở họp; student2 chưa vào lớp không được xem overview
        postJson("/api/classrooms/" + classroomId + "/meeting/start", student1.token(), "{}", 403);
        postJson("/api/classrooms/" + classroomId + "/meeting/start", teacher2.token(), "{}", 403);
        getJson("/api/classrooms/" + classroomId + "/meeting", student2.token(), 403);

        // 4. Trước khi mở họp, WebSocket phải bị từ chối
        StandardWebSocketClient wsClient = new StandardWebSocketClient();
        assertThatThrownBy(() -> wsClient.execute(
                new RecordingWsHandler(),
                new WebSocketHttpHeaders(),
                URI.create(wsUrl(classroomId, teacher1.token()))
        ).get(5, TimeUnit.SECONDS)).isInstanceOf(Exception.class);

        // 5. Giáo viên bắt đầu buổi họp
        JsonNode started = postJson("/api/classrooms/" + classroomId + "/meeting/start", teacher1.token(), """
                { "title": "Buổi 1: Ôn tập Đồ thị" }
                """, 200);
        assertThat(started.get("status").asString()).isEqualTo("LIVE");
        assertThat(started.get("title").asString()).isEqualTo("Buổi 1: Ôn tập Đồ thị");
        assertThat(started.get("meetingCode").asString()).startsWith("MT-");

        // Classroom detail & /api/meetings/live phản ánh trạng thái đang họp
        JsonNode detail = getJson("/api/classrooms/" + classroomId, student1.token(), 200);
        assertThat(detail.get("liveMeeting").asBoolean()).isTrue();

        JsonNode liveList = getJson("/api/meetings/live", student1.token(), 200);
        assertThat(liveList.size()).isEqualTo(1);
        assertThat(liveList.get(0).get("classroomId").asLong()).isEqualTo(classroomId);

        // Token sai và học sinh chưa ghi danh bị từ chối kết nối WebSocket
        assertThatThrownBy(() -> wsClient.execute(
                new RecordingWsHandler(),
                new WebSocketHttpHeaders(),
                URI.create(wsUrl(classroomId, "invalid-token"))
        ).get(5, TimeUnit.SECONDS)).isInstanceOf(Exception.class);

        assertThatThrownBy(() -> wsClient.execute(
                new RecordingWsHandler(),
                new WebSocketHttpHeaders(),
                URI.create(wsUrl(classroomId, student2.token()))
        ).get(5, TimeUnit.SECONDS)).isInstanceOf(Exception.class);

        // 6. Giáo viên và Học sinh 1 kết nối WebSocket vào phòng họp
        RecordingWsHandler teacherWsHandler = new RecordingWsHandler();
        RecordingWsHandler studentWsHandler = new RecordingWsHandler();

        WebSocketSession teacherWs = wsClient.execute(
                teacherWsHandler,
                new WebSocketHttpHeaders(),
                URI.create(wsUrl(classroomId, teacher1.token()))
        ).get(5, TimeUnit.SECONDS);

        JsonNode teacherRoomState = teacherWsHandler.awaitType("ROOM_STATE", objectMapper);
        assertThat(teacherRoomState.get("self").get("userId").asLong()).isEqualTo(teacher1.userId());
        assertThat(teacherRoomState.get("participants").size()).isZero();

        WebSocketSession studentWs = wsClient.execute(
                studentWsHandler,
                new WebSocketHttpHeaders(),
                URI.create(wsUrl(classroomId, student1.token()))
        ).get(5, TimeUnit.SECONDS);

        JsonNode studentRoomState = studentWsHandler.awaitType("ROOM_STATE", objectMapper);
        assertThat(studentRoomState.get("participants").size()).isEqualTo(1);
        assertThat(studentRoomState.get("participants").get(0).get("userId").asLong()).isEqualTo(teacher1.userId());

        JsonNode joinedNotification = teacherWsHandler.awaitType("PARTICIPANT_JOINED", objectMapper);
        assertThat(joinedNotification.get("participant").get("userId").asLong()).isEqualTo(student1.userId());

        // 7. Trao đổi trạng thái media, tín hiệu OFFER WebRTC và CHAT_MESSAGE
        studentWs.sendMessage(new TextMessage("""
                {
                  "type": "MEDIA_STATE",
                  "audioEnabled": true,
                  "videoEnabled": false,
                  "screenSharing": false,
                  "handRaised": true
                }
                """));
        JsonNode mediaEvent = teacherWsHandler.awaitType("MEDIA_STATE", objectMapper);
        assertThat(mediaEvent.get("userId").asLong()).isEqualTo(student1.userId());
        assertThat(mediaEvent.get("audioEnabled").asBoolean()).isTrue();
        assertThat(mediaEvent.get("handRaised").asBoolean()).isTrue();

        studentWs.sendMessage(new TextMessage("""
                {
                  "type": "OFFER",
                  "targetUserId": %d,
                  "payload": { "type": "offer", "sdp": "v=0-mock-sdp" }
                }
                """.formatted(teacher1.userId())));
        JsonNode relayedOffer = teacherWsHandler.awaitType("OFFER", objectMapper);
        assertThat(relayedOffer.get("fromUserId").asLong()).isEqualTo(student1.userId());
        assertThat(relayedOffer.get("payload").get("sdp").asString()).isEqualTo("v=0-mock-sdp");

        studentWs.sendMessage(new TextMessage("""
                {
                  "type": "CHAT_MESSAGE",
                  "content": "Em chào cô ạ!"
                }
                """));
        JsonNode teacherChat = teacherWsHandler.awaitType("CHAT_MESSAGE", objectMapper);
        assertThat(teacherChat.get("message").get("content").asString()).isEqualTo("Em chào cô ạ!");
        assertThat(teacherChat.get("message").get("senderName").asString()).isEqualTo("Em An");

        // 8. Giáo viên kết thúc buổi họp -> phát sự kiện MEETING_ENDED và lưu lịch sử
        postJson("/api/classrooms/" + classroomId + "/meeting/end", teacher2.token(), "{}", 403);
        JsonNode ended = postJson("/api/classrooms/" + classroomId + "/meeting/end", teacher1.token(), "{}", 200);
        assertThat(ended.get("status").asString()).isEqualTo("ENDED");
        assertThat(ended.get("endedAt").isNull()).isFalse();

        JsonNode studentEndedEvent = studentWsHandler.awaitType("MEETING_ENDED", objectMapper);
        assertThat(studentEndedEvent.get("classroomId").asLong()).isEqualTo(classroomId);

        JsonNode overviewAfter = getJson("/api/classrooms/" + classroomId + "/meeting", student1.token(), 200);
        assertThat(overviewAfter.get("active").asBoolean()).isFalse();
        assertThat(overviewAfter.get("recentSessions").size()).isEqualTo(1);
        assertThat(overviewAfter.get("recentSessions").get(0).get("status").asString()).isEqualTo("ENDED");

        if (teacherWs.isOpen()) teacherWs.close();
        if (studentWs.isOpen()) studentWs.close();
    }

    private AuthInfo register(String fullName, String email, String password, String role) throws Exception {
        JsonNode res = postJson("/api/auth/register", null, """
                {
                  "fullName": "%s",
                  "email": "%s",
                  "password": "%s",
                  "role": "%s"
                }
                """.formatted(fullName, email, password, role), 201);
        return new AuthInfo(
                res.get("user").get("id").asLong(),
                res.get("accessToken").asString()
        );
    }

    private JsonNode postJson(String path, String token, String body, int expectedStatus) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(expectedStatus);
        return objectMapper.readTree(response.body());
    }

    private JsonNode getJson(String path, String token, int expectedStatus) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + path))
                .GET();
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(expectedStatus);
        return objectMapper.readTree(response.body());
    }

    private String wsUrl(long classroomId, String token) {
        return "ws://localhost:" + port + "/ws/meeting?classroomId=" + classroomId + "&token=" + token;
    }

    private record AuthInfo(long userId, String token) {
    }

    private static final class RecordingWsHandler extends TextWebSocketHandler {
        private final BlockingQueue<String> messages = new LinkedBlockingQueue<>();

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) {
            messages.offer(message.getPayload());
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            // Không cần xử lý thêm trong test helper
        }

        private JsonNode awaitType(String expectedType, ObjectMapper mapper) throws Exception {
            long deadline = System.currentTimeMillis() + 5000;
            while (System.currentTimeMillis() < deadline) {
                String raw = messages.poll(deadline - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
                if (raw == null) break;
                JsonNode node = mapper.readTree(raw);
                if (expectedType.equals(node.path("type").asString(""))) {
                    return node;
                }
            }
            throw new AssertionError("Did not receive WebSocket message of type " + expectedType + "; remaining=" + List.copyOf(messages));
        }
    }
}
