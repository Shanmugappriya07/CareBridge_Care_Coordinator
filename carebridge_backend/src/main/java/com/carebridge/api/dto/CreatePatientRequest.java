package com.carebridge.api.dto;
import jakarta.validation.constraints.NotBlank;
public record CreatePatientRequest(@NotBlank String name, Integer age, String gender, String phone, String bloodGroup) { }
