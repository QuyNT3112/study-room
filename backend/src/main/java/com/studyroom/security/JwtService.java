package com.studyroom.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Tạo và xác thực JWT access token cho phiên làm việc.
 */
@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationMs;
    private final TokenRevocationService tokenRevocationService;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-ms:86400000}") long expirationMs,
            TokenRevocationService tokenRevocationService
    ) {
        this.signingKey = resolveKey(secret);
        this.expirationMs = expirationMs;
        this.tokenRevocationService = tokenRevocationService;
    }

    public String generateToken(UserPrincipal principal) {
        Instant now = Instant.now();
        Instant expiry = now.plusMillis(expirationMs);

        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(principal.getEmail())
                .claim("uid", principal.getId())
                .claim("role", principal.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(signingKey)
                .compact();
    }

    public String extractEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public boolean isTokenValid(String token) {
        try {
            Claims claims = parseClaims(token);
            String tokenId = claims.getId();
            Date expiration = claims.getExpiration();
            return expiration != null
                    && expiration.after(new Date())
                    && !tokenRevocationService.isRevoked(tokenId);
        } catch (JwtException | IllegalArgumentException ex) {
            return false;
        }
    }

    public void revokeToken(String token) {
        try {
            Claims claims = parseClaims(token);
            Date exp = claims.getExpiration();
            tokenRevocationService.revoke(claims.getId(), exp != null ? exp.toInstant() : Instant.now());
        } catch (JwtException | IllegalArgumentException ignored) {
            // Token không hợp lệ hoặc đã hết hạn thì không cần thu hồi thêm
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey resolveKey(String secret) {
        byte[] keyBytes;
        try {
            keyBytes = Decoders.BASE64.decode(secret);
        } catch (IllegalArgumentException ex) {
            keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        }
        if (keyBytes.length < 32) {
            keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
