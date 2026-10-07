package com.carebridge.api.dto;
import jakarta.validation.constraints.NotBlank;
public record AssignCaregiverRequest(@NotBlank String caregiverName, @NotBlank String caregiverMobile, String relationship) { }
