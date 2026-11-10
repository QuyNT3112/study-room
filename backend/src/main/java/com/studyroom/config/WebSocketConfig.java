package com.studyroom.config;

import com.studyroom.websocket.MeetingSignalingHandler;
import com.studyroom.websocket.MeetingWebSocketHandshakeInterceptor;
import jakarta.websocket.server.ServerContainer;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.ServletContextInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Cấu hình endpoint WebSocket phục vụ tín hiệu cuộc họp trực tuyến (WebRTC + Chat).
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final MeetingSignalingHandler meetingSignalingHandler;
    private final MeetingWebSocketHandshakeInterceptor handshakeInterceptor;
    private final String[] allowedOrigins;

    public WebSocketConfig(
            MeetingSignalingHandler meetingSignalingHandler,
            MeetingWebSocketHandshakeInterceptor handshakeInterceptor,
            @Value("${app.cors.allowed-origins:http://localhost:5173}") String allowedOriginsCsv
    ) {
        this.meetingSignalingHandler = meetingSignalingHandler;
        this.handshakeInterceptor = handshakeInterceptor;
        this.allowedOrigins = Arrays.stream(allowedOriginsCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(meetingSignalingHandler, "/ws/meeting")
                .addInterceptors(handshakeInterceptor)
                .setAllowedOriginPatterns(allowedOrigins);
    }

    @Bean
    public ServletContextInitializer webSocketBufferInitializer() {
        return servletContext -> {
            Object attr = servletContext.getAttribute("jakarta.websocket.server.ServerContainer");
            if (attr instanceof ServerContainer container) {
                // Đủ lớn để chứa SDP offer/answer có nhiều codec và ICE candidate
                container.setDefaultMaxTextMessageBufferSize(65536);
                container.setDefaultMaxBinaryMessageBufferSize(65536);
            }
        };
    }
}
