package com.carebridge.api.dto;
import jakarta.validation.constraints.NotBlank;
public record VerifyOtpRequest(@NotBlank String mobile, @NotBlank String otp) { }
