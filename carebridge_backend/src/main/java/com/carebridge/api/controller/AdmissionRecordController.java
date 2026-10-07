package com.carebridge.api.controller;

import com.carebridge.api.dto.RecordRequest;
import com.carebridge.api.dto.AdmissionRecordResponse;
import com.carebridge.api.entity.AdmissionRecord;
import com.carebridge.api.exception.ConflictException;
import com.carebridge.api.exception.ResourceNotFoundException;
import com.carebridge.api.exception.UnauthorizedException;
import com.carebridge.api.repository.AdmissionRecordRepository;
import com.carebridge.api.service.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/admissions/{admissionId}/records")
public class AdmissionRecordController {
    private static final List<String> TYPES = List.of("schedule", "prescriptions", "pharmacy", "tests", "scans", "billing", "insurance", "documents");
    private final AdmissionService admissions;
    private final AccessService access;
    private final AdmissionRecordRepository records;
    public AdmissionRecordController(AdmissionService admissions, AccessService access, AdmissionRecordRepository records) { this.admissions=admissions; this.access=access; this.records=records; }
    @GetMapping("/{resourceType}") public List<AdmissionRecordResponse> list(@PathVariable String admissionId, @PathVariable String resourceType, @RequestHeader(value="X-Caregiver-Mobile", required=false) String mobile, @RequestHeader(value="X-Staff-Request", required=false) String staff) {
        if (!"true".equalsIgnoreCase(staff)) access.requireAccess(admissionId, mobile);
        validate(resourceType);
        return records.findByAdmissionAdmissionIdAndResourceTypeOrderByCreatedAtDesc(admissionId, resourceType)
                .stream().map(AdmissionRecordResponse::from).toList();
    }
    @PostMapping public AdmissionRecordResponse create(@PathVariable String admissionId, @Valid @RequestBody RecordRequest request, @RequestHeader(value="X-Staff-Request", required=false) String staff) {
        requireStaff(staff);
        admissions.requireWritable(admissionId);
        validate(request.resourceType());
        return AdmissionRecordResponse.from(records.save(new AdmissionRecord(admissions.getEntity(admissionId), request.resourceType(), request.payload())));
    }
    @PutMapping("/{recordId}") public AdmissionRecordResponse update(@PathVariable String admissionId, @PathVariable Long recordId, @Valid @RequestBody RecordRequest request, @RequestHeader(value="X-Staff-Request", required=false) String staff) {
        requireStaff(staff);
        admissions.requireWritable(admissionId);
        validate(request.resourceType());
        AdmissionRecord record = records.findByIdAndAdmissionAdmissionId(recordId, admissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Admission record not found: " + recordId));
        if (!record.getResourceType().equals(request.resourceType())) {
            throw new ConflictException("Admission record type cannot be changed");
        }
        record.updatePayload(request.payload());
        return AdmissionRecordResponse.from(records.save(record));
    }
    private void requireStaff(String staff) {
        if (!"true".equalsIgnoreCase(staff)) throw new UnauthorizedException("Staff authentication is required");
    }
    private void validate(String type) { if (!TYPES.contains(type)) throw new IllegalArgumentException("Unsupported admission resource type"); }
}
