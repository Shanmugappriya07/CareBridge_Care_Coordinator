package com.carebridge.api.controller;

import com.carebridge.api.dto.CreateObservationRequest;
import com.carebridge.api.dto.ObservationResponse;
import com.carebridge.api.exception.UnauthorizedException;
import com.carebridge.api.service.AccessService;
import com.carebridge.api.service.ObservationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admissions/{admissionId}/observations")
public class ObservationController {
    private final ObservationService observations;
    private final AccessService access;

    public ObservationController(ObservationService observations, AccessService access) {
        this.observations = observations;
        this.access = access;
    }

    @GetMapping
    public List<ObservationResponse> list(
            @PathVariable String admissionId,
            @RequestHeader(value = "X-Caregiver-Mobile", required = false) String mobile,
            @RequestHeader(value = "X-Staff-Request", required = false) String staff) {
        if (!"true".equalsIgnoreCase(staff)) {
            access.requireAccess(admissionId, mobile);
        }
        return observations.forAdmission(admissionId);
    }

    @PostMapping
    public ObservationResponse create(
            @PathVariable String admissionId,
            @Valid @RequestBody CreateObservationRequest request,
            @RequestHeader(value = "X-Staff-Request", required = false) String staff) {
        if (!"true".equalsIgnoreCase(staff)) {
            throw new UnauthorizedException("Staff authentication is required");
        }
        return observations.create(admissionId, request);
    }
}