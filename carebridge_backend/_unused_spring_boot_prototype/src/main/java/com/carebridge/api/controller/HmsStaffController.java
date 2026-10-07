package com.carebridge.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/v1/hms")
@CrossOrigin(origins = "*")
public class HmsStaffController {

    @PostMapping("/patients/admit")
    public ResponseEntity<Map<String, Object>> admitPatient(@RequestBody Map<String, Object> req) {
        String admissionId = "HMS-2026-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        Map<String, Object> response = Map.of(
            "status", "SUCCESS",
            "message", "Patient admitted & primary caregiver bound successfully",
            "admissionId", admissionId,
            "patientName", req.getOrDefault("fullName", "Eleanor Vance"),
            "caregiverPhone", req.getOrDefault("caregiverPhone", "+919876543210"),
            "timestamp", System.currentTimeMillis()
        );
        return ResponseEntity.ok(response);
    }

    @PostMapping("/treatments/add")
    public ResponseEntity<Map<String, Object>> addTreatmentUpdate(@RequestBody Map<String, Object> req) {
        Map<String, Object> response = Map.of(
            "status", "SUCCESS",
            "message", "Doctor ward instruction published to CareBridge Mobile App",
            "doctorName", req.getOrDefault("doctorName", "Dr. Aris Thorne"),
            "timestamp", System.currentTimeMillis()
        );
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reports/upload")
    public ResponseEntity<Map<String, Object>> uploadLabReport(@RequestBody Map<String, Object> req) {
        String refId = "LAB-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        Map<String, Object> response = Map.of(
            "status", "SUCCESS",
            "message", "Diagnostic lab report uploaded & available for download",
            "referenceNumber", refId,
            "reportTitle", req.getOrDefault("title", "CBC Report"),
            "timestamp", System.currentTimeMillis()
        );
        return ResponseEntity.ok(response);
    }

    @PostMapping("/pharmacy/update-status")
    public ResponseEntity<Map<String, Object>> updatePharmacyStatus(@RequestBody Map<String, Object> req) {
        Map<String, Object> response = Map.of(
            "status", "SUCCESS",
            "message", "Pharmacy medicine collection status updated",
            "prescriptionId", req.getOrDefault("prescriptionId", "RX-101"),
            "collectionStatus", req.getOrDefault("status", "Collected by Caregiver"),
            "timestamp", System.currentTimeMillis()
        );
        return ResponseEntity.ok(response);
    }
}
