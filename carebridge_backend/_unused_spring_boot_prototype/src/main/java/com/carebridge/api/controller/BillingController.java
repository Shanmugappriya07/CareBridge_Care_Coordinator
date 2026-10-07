package com.carebridge.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/billing")
@CrossOrigin(origins = "*")
public class BillingController {

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getBillSummary(@RequestParam(defaultValue = "HMS-2026-8842") String admissionId) {
        Map<String, Object> summary = Map.of(
            "admissionId", admissionId,
            "totalBill", 64500.00,
            "insuranceCovered", 50000.00,
            "remainingPayable", 14500.00,
            "status", "UNPAID",
            "items", List.of(
                Map.of("description", "ICU Room Charges (3 Days @ ₹12,000/day)", "category", "Room Rent", "amount", 36000.00),
                Map.of("description", "Doctor & Consultant Fee (Cardiology)", "category", "Consultation", "amount", 12000.00),
                Map.of("description", "Pharmacy & IV Medications", "category", "Pharmacy", "amount", 8500.00),
                Map.of("description", "Laboratory & CT Diagnostics", "category", "Diagnostics", "amount", 8000.00)
            )
        );
        return ResponseEntity.ok(summary);
    }

    @PostMapping("/pay")
    public ResponseEntity<Map<String, Object>> executeDemoPayment(@RequestBody Map<String, Object> paymentReq) {
        String txId = "TXN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        Map<String, Object> response = Map.of(
            "status", "SUCCESS",
            "transactionId", txId,
            "amountPaid", paymentReq.getOrDefault("amount", 14500.00),
            "paymentMethod", paymentReq.getOrDefault("paymentMethod", "UPI"),
            "receiptUrl", "/api/v1/billing/receipt/" + txId,
            "timestamp", System.currentTimeMillis()
        );
        return ResponseEntity.ok(response);
    }
}
