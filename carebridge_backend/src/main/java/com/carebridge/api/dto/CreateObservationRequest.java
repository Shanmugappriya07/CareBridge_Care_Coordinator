package com.carebridge.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record CreateObservationRequest(
        @NotBlank String patientId,
        @NotBlank String admissionId,
        @NotBlank String doctorName,
        @NotBlank String department,
        @NotBlank String note,
        @NotBlank String vitals,
        @NotNull Instant createdAt) { }