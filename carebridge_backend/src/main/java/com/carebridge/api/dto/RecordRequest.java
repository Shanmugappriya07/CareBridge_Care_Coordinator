package com.carebridge.api.dto;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
public record RecordRequest(@NotBlank String resourceType, @NotBlank String payload, Map<String, Object> data) { }
