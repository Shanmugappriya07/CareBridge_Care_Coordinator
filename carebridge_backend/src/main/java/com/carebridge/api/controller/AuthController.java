package com.carebridge.api.controller;

import com.carebridge.api.dto.*;
import com.carebridge.api.service.OtpService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final OtpService otp;
    @Value("${app.dev-otp:}") private String configuredOtp;
    public AuthController(OtpService otp) { this.otp=otp; }
    @PostMapping("/send-otp") public Map<String, Object> send(@Valid @RequestBody OtpRequest request) {
        String generated = otp.send(request.mobile());
        return Map.of("status", "OTP_SENT", "developmentOnly", true, "otp", generated);
    }
    @PostMapping("/verify-otp") public Map<String, Object> verify(@Valid @RequestBody VerifyOtpRequest request) {
        otp.verify(request.mobile(), request.otp());
        return Map.of("status", "VERIFIED", "mobile", request.mobile(), "authMode", "development");
    }
}
