package com.carebridge.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Request body sent by the CareBridge app when a caregiver submits a
 * demo/test payment.  No real gateway is involved; the backend generates
 * the transaction ID and records the payment in the billing payload.
 */
public record PaymentRequest(

        /** Payment method label exactly as shown in the UI (e.g. "UPI", "Debit Card"). */
        @NotBlank String method,

        /** Amount the caregiver intends to pay.  Must be > 0. */
        @NotNull @DecimalMin("0.01") Double amount
) { }