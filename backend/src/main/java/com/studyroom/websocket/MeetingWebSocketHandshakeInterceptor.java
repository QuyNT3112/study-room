package com.studyroom.websocket;

import com.studyroom.exception.BadRequestException;
import com.studyroom.exception.ForbiddenOperationException;
import com.studyroom.exception.ResourceNotFoundException;
import com.studyroom.security.CustomUserDetailsService;
import com.studyroom.security.JwtService;
import com.studyroom.security.UserPrincipal;
import com.studyroom.service.MeetingService;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Xác thực JWT token và quyền tham gia buổi họp trước khi nâng cấp kết nối WebSocket.
 */
@Component
public class MeetingWebSocketHandshakeInterceptor implements HandshakeInterceptor {

    public static final String ATTR_PRINCIPAL = "studyroom.principal";
    public static final String ATTR_CLASSROOM_ID = "studyroom.classroomId";

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final MeetingService meetingService;

    public MeetingWebSocketHandshakeInterceptor(
            JwtService jwtService,
            CustomUserDetailsService userDetailsService,
            MeetingService meetingService
    ) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.meetingService = meetingService;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        MultiValueMap<String, String> queryParams = UriComponentsBuilder.fromUri(request.getURI())
                .build()
                .getQueryParams();

        String token = queryParams.getFirst("token");
        String classroomIdRaw = queryParams.getFirst("classroomId");

        if (token == null || token.isBlank() || !jwtService.isTokenValid(token)) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        long classroomId;
        try {
            classroomId = Long.parseLong(classroomIdRaw != null ? classroomIdRaw.trim() : "");
        } catch (NumberFormatException ex) {
            response.setStatusCode(HttpStatus.BAD_REQUEST);
            return false;
        }

        try {
            String email = jwtService.extractEmail(token);
            UserPrincipal principal = (UserPrincipal) userDetailsService.loadUserByUsername(email);
            meetingService.verifyMeetingJoinAccess(principal, classroomId);

            attributes.put(ATTR_PRINCIPAL, principal);
            attributes.put(ATTR_CLASSROOM_ID, classroomId);
            return true;
        } catch (UsernameNotFoundException ex) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        } catch (ForbiddenOperationException ex) {
            response.setStatusCode(HttpStatus.FORBIDDEN);
            return false;
        } catch (ResourceNotFoundException ex) {
            response.setStatusCode(HttpStatus.NOT_FOUND);
            return false;
        } catch (BadRequestException ex) {
            response.setStatusCode(HttpStatus.BAD_REQUEST);
            return false;
        }
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
        // Không cần xử lý bổ sung sau handshake
    }
}
