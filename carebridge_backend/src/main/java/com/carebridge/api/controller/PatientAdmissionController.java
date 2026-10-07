package com.carebridge.api.controller;

import com.carebridge.api.dto.AdmissionResponse;
import com.carebridge.api.service.AdmissionService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/patients/{patientId}/admissions")
public class PatientAdmissionController {
    private final AdmissionService service;
    public PatientAdmissionController(AdmissionService service) { this.service = service; }
    @GetMapping public List<AdmissionResponse> list(@PathVariable String patientId) { return service.forPatient(patientId); }
}
