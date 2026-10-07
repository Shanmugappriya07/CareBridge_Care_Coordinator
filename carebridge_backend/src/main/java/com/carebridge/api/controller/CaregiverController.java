package com.carebridge.api.controller;

import com.carebridge.api.dto.*;
import com.carebridge.api.entity.AccessStatus;
import com.carebridge.api.repository.*;
import com.carebridge.api.service.AdmissionService;
import com.carebridge.api.util.MobileNumberNormalizer;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@RestController
@RequestMapping("/caregivers")
public class CaregiverController {
    private final AdmissionCaregiverRepository caregivers;
    private final AdmissionService admissions;
    public CaregiverController(AdmissionCaregiverRepository caregivers, AdmissionService admissions) { this.caregivers=caregivers; this.admissions=admissions; }
    @Transactional(readOnly = true)
    @GetMapping("/{mobile}/admissions") public List<AdmissionResponse> admissions(@PathVariable String mobile) {
        return caregivers.findByAccessStatusOrderByCreatedAtDesc(AccessStatus.ACTIVE).stream()
            .filter(c -> MobileNumberNormalizer.matches(c.getCaregiverMobile(), mobile))
            .map(c -> AdmissionResponse.from(c.getAdmission(), CaregiverResponse.from(c))).toList();
    }
    @GetMapping("/previous") public CaregiverResponse previous(@RequestParam String patientId) {
        return caregivers.findFirstByAdmissionPatientPatientIdOrderByCreatedAtDesc(patientId).map(CaregiverResponse::from).orElse(null);
    }
    @GetMapping("/{mobile}/admissions/{admissionId}/access") public boolean check(@PathVariable String mobile, @PathVariable String admissionId) {
        return caregivers.findByAdmissionAdmissionIdAndAccessStatusOrderByCreatedAtDesc(admissionId, AccessStatus.ACTIVE).stream()
                .anyMatch(c -> MobileNumberNormalizer.matches(c.getCaregiverMobile(), mobile));
    }
}
