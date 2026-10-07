package com.carebridge.api.controller;

import com.carebridge.api.dto.*;
import com.carebridge.api.service.*;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admissions")
public class AdmissionController {
    private final AdmissionService service;
    private final AccessService access;
    public AdmissionController(AdmissionService service, AccessService access) { this.service=service; this.access=access; }
    @GetMapping public List<AdmissionResponse> all(@RequestHeader(value="X-Staff-Request", required=false) String staff) { if (!"true".equalsIgnoreCase(staff)) throw new com.carebridge.api.exception.UnauthorizedException("Staff authentication is required"); return service.all(); }
    @PostMapping public AdmissionResponse create(@Valid @RequestBody CreateAdmissionRequest request) { return service.create(request); }
    @PostMapping("/{admissionId}/caregivers") public CaregiverResponse assignCaregiver(@PathVariable String admissionId, @Valid @RequestBody AssignCaregiverRequest request, @RequestHeader(value="X-Staff-Request", required=false) String staff) { if (!"true".equalsIgnoreCase(staff)) throw new com.carebridge.api.exception.UnauthorizedException("Staff authentication is required"); return service.assignCaregiver(admissionId, request); }
    @GetMapping("/{admissionId}") public AdmissionResponse get(@PathVariable String admissionId, @RequestHeader(value="X-Caregiver-Mobile", required=false) String mobile, @RequestHeader(value="X-Staff-Request", required=false) String staff) { if (!"true".equalsIgnoreCase(staff)) access.requireAccess(admissionId, mobile); return service.get(admissionId); }
    @PutMapping("/{admissionId}/discharge") public AdmissionResponse discharge(@PathVariable String admissionId, @RequestBody(required=false) DischargeRequest request, @RequestHeader(value="X-Staff-Request", required=false) String staff) { if (!"true".equalsIgnoreCase(staff)) throw new com.carebridge.api.exception.UnauthorizedException("Staff authentication is required"); return service.discharge(admissionId, request); }
    @GetMapping("/{admissionId}/discharge-summary") public Object summary(@PathVariable String admissionId, @RequestHeader(value="X-Caregiver-Mobile", required=false) String mobile, @RequestHeader(value="X-Staff-Request", required=false) String staff) { if (!"true".equalsIgnoreCase(staff)) access.requireAccess(admissionId, mobile); return service.summary(admissionId); }
}
