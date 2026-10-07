package com.carebridge.api.dto;
import jakarta.validation.constraints.NotBlank;
public record CreateAdmissionRequest(@NotBlank String patientId, @NotBlank String caregiverName, @NotBlank String caregiverMobile, String relationship, @NotBlank String doctor, @NotBlank String department, @NotBlank String room, String reason, String hospitalName) { }
