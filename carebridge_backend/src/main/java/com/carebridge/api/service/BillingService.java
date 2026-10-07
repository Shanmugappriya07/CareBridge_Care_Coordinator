package com.carebridge.api.service;

import com.carebridge.api.dto.BillingItemDto;
import com.carebridge.api.dto.BillingPaymentDto;
import com.carebridge.api.dto.BillingResponse;
import com.carebridge.api.entity.Admission;
import com.carebridge.api.entity.AdmissionRecord;
import com.carebridge.api.exception.ConflictException;
import com.carebridge.api.repository.AdmissionRecordRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Reads and updates billing AdmissionRecords.
 *
 * Payload shape written by HMS staff portal:
 * <pre>
 * {
 *   "billing": {
 *     "totalBill": 64500.00,
 *     "insuranceCovered": 50000.00,
 *     "remainingPayable": 14500.00,
 *     "claimStatus": "Approved",
 *     "items": [ { "desc":"...", "category":"...", "amount": 36000.00 } ]
 *   },
 *   "payments": [
 *     { "txId":"TXN-xxx", "date":"13 Aug 2026", "method":"UPI", "amount":10000.00, "status":"Paid" }
 *   ]
 * }
 * </pre>
 * Flat shape (billing fields at root) is also handled for backwards compat.
 */
@Service
public class BillingService {

    private static final String RESOURCE_TYPE = "billing";
    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    private final AdmissionRecordRepository records;
    private final ObjectMapper mapper;

    public BillingService(AdmissionRecordRepository records, ObjectMapper mapper) {
        this.records = records;
        this.mapper = mapper;
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /** Returns the latest billing snapshot, or empty if no record exists yet. */
    public Optional<BillingResponse> getLatest(String admissionId, boolean isReadOnly) {
        return latestRecord(admissionId)
                .map(r -> parse(admissionId, r.getId(), r.getPayload(), isReadOnly));
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /**
     * Records a demo payment against the latest billing record for this admission.
     * Generates a server-side transaction ID, appends the payment to the
     * payments[] array in the payload, and persists via PUT (updatePayload).
     *
     * @return the confirmed BillPaymentDto with the server-generated txId
     * @throws ConflictException if no billing record exists yet
     */
    @Transactional
    public BillingPaymentDto recordPayment(Admission admission,
                                            String method,
                                            double amount) {
        AdmissionRecord record = latestRecord(admission.getAdmissionId())
                .orElseThrow(() -> new ConflictException(
                        "No billing record found for admission " + admission.getAdmissionId()));

        String txId  = "TXN-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
        String date  = ZonedDateTime.now(ZoneId.of("Asia/Kolkata")).format(DATE_FMT);

        String updatedPayload = appendPayment(record.getPayload(), txId, date, method, amount);
        record.updatePayload(updatedPayload);
        records.save(record);

        return new BillingPaymentDto(txId, date, method, amount, "Paid");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Optional<AdmissionRecord> latestRecord(String admissionId) {
        return records
                .findByAdmissionAdmissionIdAndResourceTypeOrderByCreatedAtDesc(admissionId, RESOURCE_TYPE)
                .stream()
                .findFirst();
    }

    private String appendPayment(String payload, String txId, String date,
                                  String method, double amount) {
        try {
            ObjectNode root = (ObjectNode) mapper.readTree(payload);

            // Locate or create the payments array at root level
            ArrayNode paymentsArray;
            if (root.has("payments") && root.get("payments").isArray()) {
                paymentsArray = (ArrayNode) root.get("payments");
            } else {
                paymentsArray = mapper.createArrayNode();
                root.set("payments", paymentsArray);
            }

            ObjectNode entry = mapper.createObjectNode();
            entry.put("txId",   txId);
            entry.put("date",   date);
            entry.put("method", method);
            entry.put("amount", amount);
            entry.put("status", "Paid");
            paymentsArray.add(entry);

            // Recalculate remainingPayable in the billing node (nested or flat)
            JsonNode billingNode = root.has("billing") ? root.get("billing") : root;
            if (billingNode.isObject()) {
                ObjectNode bn = (ObjectNode) billingNode;
                double currentRemaining = bn.path("remainingPayable").asDouble(0);
                double newRemaining = Math.max(0, currentRemaining - amount);
                bn.put("remainingPayable", newRemaining);
            }

            return mapper.writeValueAsString(root);
        } catch (Exception e) {
            throw new RuntimeException("Failed to update billing payload: " + e.getMessage(), e);
        }
    }

    BillingResponse parse(String admissionId, Long recordId,
                                  String payload, boolean isReadOnly) {
        try {
            JsonNode root = mapper.readTree(payload);
            JsonNode billingNode = root.has("billing") ? root.get("billing") : root;

            double totalBill        = billingNode.path("totalBill").asDouble(0);
            double insuranceCovered = billingNode.path("insuranceCovered").asDouble(0);
            double remainingPayable = billingNode.path("remainingPayable")
                    .asDouble(totalBill - insuranceCovered);
            String claimStatus = billingNode.path("claimStatus").asText("Unknown");

            List<BillingItemDto> items = new ArrayList<>();
            JsonNode itemsNode = billingNode.path("items");
            if (itemsNode.isArray()) {
                for (JsonNode item : itemsNode) {
                    items.add(new BillingItemDto(
                            item.path("desc").asText(""),
                            item.path("category").asText(""),
                            item.path("amount").asDouble(0)));
                }
            }

            JsonNode paymentsNode = root.has("payments")
                    ? root.get("payments") : billingNode.path("payments");
            List<BillingPaymentDto> payments = new ArrayList<>();
            if (paymentsNode.isArray()) {
                for (JsonNode p : paymentsNode) {
                    payments.add(new BillingPaymentDto(
                            p.path("txId").asText(""),
                            p.path("date").asText(""),
                            p.path("method").asText(""),
                            p.path("amount").asDouble(0),
                            p.path("status").asText("")));
                }
            }

            double paidAmount = payments.stream()
                    .filter(p -> "Paid".equalsIgnoreCase(p.status()) ||
                                 "SUCCESS".equalsIgnoreCase(p.status()))
                    .mapToDouble(BillingPaymentDto::amount)
                    .sum();

            return new BillingResponse(admissionId, items, totalBill,
                    insuranceCovered, paidAmount, remainingPayable,
                    claimStatus, payments, isReadOnly, recordId);

        } catch (Exception e) {
            return new BillingResponse(admissionId, List.of(), 0, 0, 0, 0,
                    "Unknown", List.of(), isReadOnly, recordId);
        }
    }
}