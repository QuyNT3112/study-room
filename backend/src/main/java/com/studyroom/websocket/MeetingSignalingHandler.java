package com.studyroom.websocket;

import com.studyroom.security.UserPrincipal;
import com.studyroom.service.MeetingRoomRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Xử lý kết nối và chuyển tiếp tín hiệu WebRTC (Offer, Answer, ICE Candidate),
 * trạng thái media (mic/camera/screen/giơ tay) và chat trực tiếp trong phòng họp.
 */
@Component
public class MeetingSignalingHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(MeetingSignalingHandler.class);
    private static final int MAX_CHAT_LENGTH = 1000;

    private final MeetingRoomRegistry roomRegistry;
    private final ObjectMapper objectMapper;

    public MeetingSignalingHandler(MeetingRoomRegistry roomRegistry, ObjectMapper objectMapper) {
        this.roomRegistry = roomRegistry;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        UserPrincipal principal = extractPrincipal(session);
        Long classroomId = extractClassroomId(session);
        if (principal == null || classroomId == null) {
            return;
        }
        roomRegistry.registerParticipant(classroomId, principal, session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        UserPrincipal principal = extractPrincipal(session);
        Long classroomId = extractClassroomId(session);
        if (principal == null || classroomId == null) {
            return;
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(message.getPayload());
        } catch (JacksonException ex) {
            roomRegistry.sendError(session, "Định dạng thông điệp WebSocket không hợp lệ");
            return;
        }

        String type = root.path("type").asString("");
        switch (type) {
            case "PING" -> roomRegistry.sendPong(session);
            case "OFFER", "ANSWER", "ICE_CANDIDATE" -> {
                JsonNode targetNode = root.get("targetUserId");
                if (targetNode == null || !targetNode.canConvertToLong()) {
                    roomRegistry.sendError(session, "Thiếu targetUserId cho tín hiệu WebRTC");
                    return;
                }
                long targetUserId = targetNode.asLong();
                roomRegistry.relaySignal(classroomId, principal.getId(), targetUserId, type, root.get("payload"));
            }
            case "MEDIA_STATE" -> {
                boolean audioEnabled = root.path("audioEnabled").asBoolean(false);
                boolean videoEnabled = root.path("videoEnabled").asBoolean(false);
                boolean screenSharing = root.path("screenSharing").asBoolean(false);
                boolean handRaised = root.path("handRaised").asBoolean(false);
                roomRegistry.updateMediaState(
                        classroomId,
                        principal.getId(),
                        audioEnabled,
                        videoEnabled,
                        screenSharing,
                        handRaised
                );
            }
            case "CHAT_MESSAGE" -> {
                String content = root.path("content").asString("").trim();
                if (content.isEmpty()) {
                    return;
                }
                if (content.length() > MAX_CHAT_LENGTH) {
                    content = content.substring(0, MAX_CHAT_LENGTH);
                }
                roomRegistry.appendAndBroadcastChat(classroomId, principal.getId(), content);
            }
            default -> roomRegistry.sendError(session, "Loại tín hiệu không được hỗ trợ: " + type);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        UserPrincipal principal = extractPrincipal(session);
        Long classroomId = extractClassroomId(session);
        if (principal != null && classroomId != null) {
            roomRegistry.unregisterParticipant(classroomId, principal.getId(), session);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.debug("WebSocket transport error on session {}: {}", session.getId(), exception.getMessage());
        UserPrincipal principal = extractPrincipal(session);
        Long classroomId = extractClassroomId(session);
        if (principal != null && classroomId != null) {
            roomRegistry.unregisterParticipant(classroomId, principal.getId(), session);
        }
    }

    private UserPrincipal extractPrincipal(WebSocketSession session) {
        Object attr = session.getAttributes().get(MeetingWebSocketHandshakeInterceptor.ATTR_PRINCIPAL);
        return attr instanceof UserPrincipal principal ? principal : null;
    }

    private Long extractClassroomId(WebSocketSession session) {
        Object attr = session.getAttributes().get(MeetingWebSocketHandshakeInterceptor.ATTR_CLASSROOM_ID);
        return attr instanceof Long id ? id : null;
    }
}
