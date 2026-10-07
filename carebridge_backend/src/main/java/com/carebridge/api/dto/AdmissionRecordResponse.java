package com.carebridge.api.dto;

import com.carebridge.api.entity.AdmissionRecord;
import java.time.Instant;

public record AdmissionRecordResponse(
        Long id,
        String resourceType,
        String payload,
        Instant createdAt,
        Instant updatedAt) {
    public static AdmissionRecordResponse from(AdmissionRecord record) {
        return new AdmissionRecordResponse(
                record.getId(),
                record.getResourceType(),
                record.getPayload(),
                record.getCreatedAt(),
                record.getUpdatedAt());
    }
}