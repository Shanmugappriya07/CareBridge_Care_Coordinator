package com.carebridge.api.controller;

import com.carebridge.api.dto.BillingPaymentDto;
import com.carebridge.api.dto.BillingResponse;
import com.carebridge.api.dto.PaymentRequest;
import com.carebridge.api.entity.Admission;
import com.carebridge.api.entity.AdmissionStatus;
import com.carebridge.api.exception.ConflictException;
import com.carebridge.api.service.AccessService;
import com.carebridge.api.service.AdmissionService;
import com.carebridge.api.service.BillingService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admissions/{admissionId}/billing")
public class BillingController {

    private final AdmissionService admissions;
    private final AccessService access;
    private final BillingService billing;

    public BillingController(AdmissionService admissions,
                              AccessService access,
                              BillingService billing) {
        this.admissions = admissions;
        this.access     = access;
        this.billing    = billing;
    }

    /**
     * GET /api/v1/admissions/{admissionId}/billing
     *
     * Returns the current billing snapshot.
     * 204 No Content when no billing record exists yet.
     */
    @GetMapping
    public ResponseEntity<BillingResponse> get(
            @PathVariable String admissionId,
            @RequestHeader(value = "X-Caregiver-Mobile", required = false) String mobile,
            @RequestHeader(value = "X-Staff-Request",    required = false) String staff) {

        requireCaregiverOrStaff(admissionId, mobile, staff);

        boolean isReadOnly =
                admissions.getEntity(admissionId).getStatus() == AdmissionStatus.DISCHARGED;

        return billing.getLatest(admissionId, isReadOnly)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    /**
     * POST /api/v1/admissions/{admissionId}/billing/payments
     *
     * Records a demo payment.  Only accessible to an authorised caregiver
     * (not staff-only — the caregiver is the one paying).
     * Returns 409 if the admission is DISCHARGED or has no billing record yet.
     */
    @PostMapping("/payments")
    public ResponseEntity<BillingPaymentDto> pay(
            @PathVariable String admissionId,
            @Valid @RequestBody PaymentRequest request,
            @RequestHeader(value = "X-Caregiver-Mobile", required = false) String mobile,
            @RequestHeader(value = "X-Staff-Request",    required = false) String staff) {

        requireCaregiverOrStaff(admissionId, mobile, staff);

        Admission admission = admissions.getEntity(admissionId);
        if (admission.getStatus() == AdmissionStatus.DISCHARGED) {
            throw new ConflictException("Discharged admissions are read-only");
        }

        BillingPaymentDto confirmed =
                billing.recordPayment(admission, request.method(), request.amount());

        return ResponseEntity.ok(confirmed);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void requireCaregiverOrStaff(String admissionId, String mobile, String staff) {
        if (!"true".equalsIgnoreCase(staff)) {
            access.requireAccess(admissionId, mobile);
        }
    }
}