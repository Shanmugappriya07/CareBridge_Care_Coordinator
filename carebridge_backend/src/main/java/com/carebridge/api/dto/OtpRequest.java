package com.carebridge.api.dto;
import jakarta.validation.constraints.NotBlank;
public record OtpRequest(@NotBlank String mobile) { }
