package com.carebridge.api.dto;

import java.time.Instant;

public record ObservationResponse(
        String patientId,
        String admissionId,
        String doctorName,
        String department,
        String note,
        String vitals,
        Instant createdAt) { }