package com.carebridge.api.dto;

/**
 * A single payment transaction recorded against the bill.
 * Matches the HMS billing payload shape: { txId, date, method, amount, status }
 */
public record BillingPaymentDto(
        String txId,
        String date,
        String method,
        double amount,
        String status
) { }
