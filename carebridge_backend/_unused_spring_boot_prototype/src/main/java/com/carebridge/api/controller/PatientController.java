package com.carebridge.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/v1/patients")
@CrossOrigin(origins = "*")
public class PatientController {

    @GetMapping("/{admissionId}")
    public ResponseEntity<Map<String, Object>> getPatientByAdmissionId(@PathVariable String admissionId) {
        Map<String, Object> patient = Map.of(
            "admissionId", admissionId,
            "fullName", "Eleanor Vance",
            "dateOfBirth", "1968-04-12",
            "gender", "FEMALE",
            "bloodGroup", "A+",
            "roomNumber", "ICU Room 304",
            "attendingDoctor", "Dr. Aris Thorne (Cardiology)",
            "department", "Cardiology",
            "status", "ADMITTED",
            "hospitalName", "St. Jude Memorial Hospital"
        );
        return ResponseEntity.ok(patient);
    }
}
