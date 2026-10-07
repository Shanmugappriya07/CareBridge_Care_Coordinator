package com.carebridge.api.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.carebridge.api.util.MobileNumberNormalizer;
import org.junit.jupiter.api.Test;

class AdmissionCaregiverTest {
    @Test
    void normalizeMobileAcceptsCommonIndianFormats() {
        assertEquals("7339140106", MobileNumberNormalizer.normalizeToTenDigits("+917339140106"));
        assertEquals("7339140106", MobileNumberNormalizer.normalizeToTenDigits("+91 7339140106"));
        assertEquals("7339140106", MobileNumberNormalizer.normalizeToTenDigits("+91 73391 40106"));
        assertEquals("7339140106", MobileNumberNormalizer.normalizeToTenDigits("7339140106"));
        assertEquals("+91 7339140106", MobileNumberNormalizer.toStorageFormat("+91 73391 40106"));
    }
}