package com.carebridge.api.dto;

/**
 * A single charge line on the hospital bill.
 * Matches the HMS billing payload shape: { desc, category, amount }
 */
public record BillingItemDto(
        String desc,
        String category,
        double amount
) { }
