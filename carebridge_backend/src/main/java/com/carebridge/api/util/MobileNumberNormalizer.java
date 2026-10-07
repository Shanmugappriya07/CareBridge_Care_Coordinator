package com.carebridge.api.util;

public final class MobileNumberNormalizer {
    private MobileNumberNormalizer() { }

    public static String normalizeToTenDigits(String mobile) {
        if (mobile == null) return null;
        String digits = mobile.replaceAll("\\D", "");
        if (digits.length() == 12 && digits.startsWith("91")) digits = digits.substring(2);
        return digits.length() == 10 ? digits : null;
    }

    public static String toStorageFormat(String mobile) {
        String normalized = normalizeToTenDigits(mobile);
        return normalized == null ? (mobile == null ? null : mobile.trim()) : "+91 " + normalized;
    }

    public static boolean matches(String first, String second) {
        String normalizedFirst = normalizeToTenDigits(first);
        return normalizedFirst != null && normalizedFirst.equals(normalizeToTenDigits(second));
    }
}