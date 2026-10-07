package com.carebridge.api.service;

import com.carebridge.api.exception.UnauthorizedException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.security.SecureRandom;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OtpService {
    private final Map<String, String> pending = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    @Value("${app.dev-otp:}") private String configuredOtp;
    public String send(String mobile) {
        String otp = configuredOtp == null || configuredOtp.isBlank() ? String.format("%06d", random.nextInt(1_000_000)) : configuredOtp;
        pending.put(mobile, otp);
        return otp;
    }
    public void verify(String mobile, String otp) {
        if (!otp.equals(pending.get(mobile))) throw new UnauthorizedException("Invalid or expired development OTP");
        pending.remove(mobile);
    }
}
