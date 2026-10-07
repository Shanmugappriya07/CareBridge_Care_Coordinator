package com.carebridge.api.controller;

import com.carebridge.api.dto.CreatePatientRequest;
import com.carebridge.api.service.PatientService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/patients")
public class PatientController {
    private final PatientService service;
    public PatientController(PatientService service) { this.service = service; }
    @PostMapping public Object create(@Valid @RequestBody CreatePatientRequest request) { return service.create(request); }
    @GetMapping public Object search(@RequestParam(required=false) String query) { return service.search(query); }
    @GetMapping("/{patientId}") public Object get(@PathVariable String patientId) { return service.get(patientId); }
}
