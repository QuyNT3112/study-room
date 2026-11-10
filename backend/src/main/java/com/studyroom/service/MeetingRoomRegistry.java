package com.studyroom.service;

import com.studyroom.dto.response.MeetingParticipantResponse;
import com.studyroom.entity.Role;
import com.studyroom.security.UserPrincipal;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Quản lý trạng thái phòng họp trực tuyến đang mở trong bộ nhớ (người tham gia,
 * trạng thái micro/camera/chia sẻ màn hình/giơ tay và bộ đệm chat phiên hiện tại).
 */
@Component
public class MeetingRoomRegistry {

    private static final Logger log = LoggerFactory.getLogger(MeetingRoomRegistry.class);
    private static final int MAX_CHAT_HISTORY = 100;

    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<Long, RoomState> rooms = new ConcurrentHashMap<>();

    public MeetingRoomRegistry(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public JoinSnapshot registerParticipant(Long classroomId, UserPrincipal principal, WebSocketSession session) {
        RoomState room = rooms.computeIfAbsent(classroomId, id -> new RoomState());
        ParticipantState newState = new ParticipantState(
                session,
                principal.getId(),
                principal.getFullName(),
                principal.getEmail(),
                principal.getRole(),
                Instant.now()
        );

        ParticipantState previous = room.participants.put(principal.getId(), newState);
        if (previous != null && previous.session != session) {
            sendToParticipant(previous, Map.of(
                    "type", "SESSION_REPLACED",
                    "message", "Phiên họp của bạn đã được mở ở một tab hoặc thiết bị khác."
            ));
            closeSessionQuietly(previous.session, new CloseStatus(4001, "Session replaced"));
        }

        List<MeetingParticipantResponse> existingPeers = room.participants.values().stream()
                .filter(p -> !p.userId.equals(principal.getId()))
                .map(ParticipantState::toResponse)
                .toList();

        List<Map<String, Object>> chatSnapshot;
        synchronized (room.chatHistory) {
            chatSnapshot = new ArrayList<>(room.chatHistory);
        }

        // Gửi ROOM_STATE cho người mới vào trước, sau đó thông báo PARTICIPANT_JOINED cho các thành viên khác
        sendToParticipant(newState, Map.of(
                "type", "ROOM_STATE",
                "classroomId", classroomId,
                "self", newState.toResponse(),
                "participants", existingPeers,
                "chatHistory", chatSnapshot
        ));

        broadcastToOthers(room, principal.getId(), Map.of(
                "type", "PARTICIPANT_JOINED",
                "classroomId", classroomId,
                "participant", newState.toResponse()
        ));

        return new JoinSnapshot(newState, existingPeers, chatSnapshot);
    }

    public void unregisterParticipant(Long classroomId, Long userId, WebSocketSession session) {
        RoomState room = rooms.get(classroomId);
        if (room == null) {
            return;
        }
        ParticipantState current = room.participants.get(userId);
        if (current == null || current.session != session) {
            return;
        }
        if (room.participants.remove(userId, current)) {
            broadcastToRoom(room, Map.of(
                    "type", "PARTICIPANT_LEFT",
                    "classroomId", classroomId,
                    "userId", userId
            ));
        }
    }

    public void updateMediaState(
            Long classroomId,
            Long userId,
            boolean audioEnabled,
            boolean videoEnabled,
            boolean screenSharing,
            boolean handRaised
    ) {
        RoomState room = rooms.get(classroomId);
        if (room == null) {
            return;
        }
        ParticipantState state = room.participants.get(userId);
        if (state == null) {
            return;
        }
        state.audioEnabled = audioEnabled;
        state.videoEnabled = videoEnabled;
        state.screenSharing = screenSharing;
        state.handRaised = handRaised;

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "MEDIA_STATE");
        event.put("classroomId", classroomId);
        event.put("userId", userId);
        event.put("audioEnabled", audioEnabled);
        event.put("videoEnabled", videoEnabled);
        event.put("screenSharing", screenSharing);
        event.put("handRaised", handRaised);

        broadcastToRoom(room, event);
    }

    public void relaySignal(
            Long classroomId,
            Long fromUserId,
            Long targetUserId,
            String signalType,
            JsonNode payload
    ) {
        RoomState room = rooms.get(classroomId);
        if (room == null || targetUserId == null) {
            return;
        }
        ParticipantState target = room.participants.get(targetUserId);
        if (target == null) {
            return;
        }

        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", signalType);
        message.put("classroomId", classroomId);
        message.put("fromUserId", fromUserId);
        message.put("targetUserId", targetUserId);
        message.put("payload", payload);

        sendToParticipant(target, message);
    }

    public void appendAndBroadcastChat(Long classroomId, Long senderId, String content) {
        RoomState room = rooms.get(classroomId);
        if (room == null) {
            return;
        }
        ParticipantState sender = room.participants.get(senderId);
        if (sender == null) {
            return;
        }

        Map<String, Object> chatItem = new LinkedHashMap<>();
        chatItem.put("id", UUID.randomUUID().toString());
        chatItem.put("senderId", sender.userId);
        chatItem.put("senderName", sender.fullName);
        chatItem.put("senderRole", sender.role.name());
        chatItem.put("content", content);
        chatItem.put("sentAt", Instant.now().toString());

        synchronized (room.chatHistory) {
            if (room.chatHistory.size() >= MAX_CHAT_HISTORY) {
                room.chatHistory.remove(0);
            }
            room.chatHistory.add(chatItem);
        }

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "CHAT_MESSAGE");
        event.put("classroomId", classroomId);
        event.put("message", chatItem);

        broadcastToRoom(room, event);
    }

    public void sendError(WebSocketSession session, String errorMessage) {
        sendRawSession(session, Map.of(
                "type", "ERROR",
                "message", errorMessage
        ));
    }

    public void sendPong(WebSocketSession session) {
        sendRawSession(session, Map.of(
                "type", "PONG",
                "timestamp", Instant.now().toString()
        ));
    }

    public void broadcastMeetingEnded(Long classroomId, Long endedByUserId) {
        RoomState room = rooms.remove(classroomId);
        if (room == null) {
            return;
        }

        Map<String, Object> endedEvent = Map.of(
                "type", "MEETING_ENDED",
                "classroomId", classroomId,
                "endedByUserId", endedByUserId,
                "message", "Giáo viên đã kết thúc buổi họp trực tuyến."
        );

        for (ParticipantState participant : room.participants.values()) {
            sendToParticipant(participant, endedEvent);
            closeSessionQuietly(participant.session, CloseStatus.NORMAL);
        }
        room.participants.clear();
        synchronized (room.chatHistory) {
            room.chatHistory.clear();
        }
    }

    public List<MeetingParticipantResponse> getActiveParticipants(Long classroomId) {
        RoomState room = rooms.get(classroomId);
        if (room == null) {
            return List.of();
        }
        return room.participants.values().stream()
                .map(ParticipantState::toResponse)
                .toList();
    }

    public int getParticipantCount(Long classroomId) {
        RoomState room = rooms.get(classroomId);
        return room == null ? 0 : room.participants.size();
    }

    public Map<Long, Integer> getParticipantCountsByClassroomIds(Collection<Long> classroomIds) {
        if (classroomIds == null || classroomIds.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<Long, Integer> counts = new HashMap<>();
        for (Long id : classroomIds) {
            int count = getParticipantCount(id);
            if (count > 0) {
                counts.put(id, count);
            }
        }
        return counts;
    }

    private void broadcastToRoom(RoomState room, Object payload) {
        String json = serialize(payload);
        if (json == null) return;
        for (ParticipantState participant : room.participants.values()) {
            sendSerialized(participant, json);
        }
    }

    private void broadcastToOthers(RoomState room, Long excludedUserId, Object payload) {
        String json = serialize(payload);
        if (json == null) return;
        for (ParticipantState participant : room.participants.values()) {
            if (!participant.userId.equals(excludedUserId)) {
                sendSerialized(participant, json);
            }
        }
    }

    private void sendToParticipant(ParticipantState participant, Object payload) {
        String json = serialize(payload);
        if (json != null) {
            sendSerialized(participant, json);
        }
    }

    private void sendSerialized(ParticipantState participant, String json) {
        synchronized (participant) {
            if (participant.session.isOpen()) {
                try {
                    participant.session.sendMessage(new TextMessage(json));
                } catch (IOException ex) {
                    log.debug("Failed to send WebSocket message to user {}: {}", participant.userId, ex.getMessage());
                }
            }
        }
    }

    private void sendRawSession(WebSocketSession session, Object payload) {
        String json = serialize(payload);
        if (json == null || !session.isOpen()) return;
        synchronized (session) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(new TextMessage(json));
                } catch (IOException ex) {
                    log.debug("Failed to send WebSocket message on session {}: {}", session.getId(), ex.getMessage());
                }
            }
        }
    }

    private String serialize(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JacksonException ex) {
            log.warn("Could not serialize meeting WebSocket payload", ex);
            return null;
        }
    }

    private void closeSessionQuietly(WebSocketSession session, CloseStatus status) {
        try {
            if (session.isOpen()) {
                session.close(status);
            }
        } catch (IOException ignored) {
            // Bỏ qua lỗi khi đóng kết nối đã ngắt
        }
    }

    private static final class RoomState {
        private final ConcurrentHashMap<Long, ParticipantState> participants = new ConcurrentHashMap<>();
        private final List<Map<String, Object>> chatHistory = new ArrayList<>();
    }

    public static final class ParticipantState {
        private final WebSocketSession session;
        private final Long userId;
        private final String fullName;
        private final String email;
        private final Role role;
        private final Instant joinedAt;
        private volatile boolean audioEnabled = false;
        private volatile boolean videoEnabled = false;
        private volatile boolean screenSharing = false;
        private volatile boolean handRaised = false;

        private ParticipantState(
                WebSocketSession session,
                Long userId,
                String fullName,
                String email,
                Role role,
                Instant joinedAt
        ) {
            this.session = session;
            this.userId = userId;
            this.fullName = fullName;
            this.email = email;
            this.role = role;
            this.joinedAt = joinedAt;
        }

        public MeetingParticipantResponse toResponse() {
            return new MeetingParticipantResponse(
                    userId,
                    fullName,
                    email,
                    role,
                    audioEnabled,
                    videoEnabled,
                    screenSharing,
                    handRaised,
                    joinedAt
            );
        }
    }

    public record JoinSnapshot(
            ParticipantState self,
            List<MeetingParticipantResponse> existingPeers,
            List<Map<String, Object>> chatHistory
    ) {
    }
}
