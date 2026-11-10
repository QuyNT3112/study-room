package com.studyroom.security;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * Lưu danh sách token đã đăng xuất để vô hiệu hóa JWT trước khi hết hạn.
 */
@Service
public class TokenRevocationService {

    private final Map<String, Instant> revokedTokens = new ConcurrentHashMap<>();

    public void revoke(String tokenId, Instant expiresAt) {
        if (tokenId == null || tokenId.isBlank()) {
            return;
        }
        cleanupExpired();
        revokedTokens.put(tokenId, expiresAt != null ? expiresAt : Instant.now().plusSeconds(86400));
    }

    public boolean isRevoked(String tokenId) {
        if (tokenId == null || tokenId.isBlank()) {
            return false;
        }
        Instant expiry = revokedTokens.get(tokenId);
        if (expiry == null) {
            return false;
        }
        if (expiry.isBefore(Instant.now())) {
            revokedTokens.remove(tokenId);
            return false;
        }
        return true;
    }

    private void cleanupExpired() {
        Instant now = Instant.now();
        revokedTokens.entrySet().removeIf(entry -> entry.getValue().isBefore(now));
    }
}
