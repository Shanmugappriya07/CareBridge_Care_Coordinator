package com.carebridge.api.dto;

import java.util.List;

/**
 * Full billing snapshot for one admission.
 * Derived from the latest AdmissionRecord with resourceType="billing".
 *
 * Fields exposed to CareBridge (read-only):
 *   admissionId      - scope identifier
 *   items            - itemised bill lines (desc, category, amount)
 *   totalBill        - sum of all items as recorded by HMS
 *   insuranceCovered - amount approved/covered by insurer
 *   paidAmount       - total already paid by caregiver
 *   balance          - remainingPayable from HMS perspective
 *   claimStatus      - insurance claim pipeline status
 *   payments         - list of payment transactions
 *   isReadOnly       - true when the admission is DISCHARGED
 *   recordId         - AdmissionRecord.id of the source record
 */
public record BillingResponse(
        String admissionId,
        List<BillingItemDto> items,
        double totalBill,
        double insuranceCovered,
        double paidAmount,
        double balance,
        String claimStatus,
        List<BillingPaymentDto> payments,
        boolean isReadOnly,
        Long recordId
) { }