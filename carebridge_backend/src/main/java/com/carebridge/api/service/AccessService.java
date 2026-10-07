package com.carebridge.api.service;

import com.carebridge.api.entity.AccessStatus;
import com.carebridge.api.exception.UnauthorizedException;
import com.carebridge.api.repository.AdmissionCaregiverRepository;
import com.carebridge.api.util.MobileNumberNormalizer;
import org.springframework.stereotype.Service;

@Service
public class AccessService {
    private final AdmissionCaregiverRepository caregivers;
    public AccessService(AdmissionCaregiverRepository caregivers) { this.caregivers = caregivers; }
    public void requireAccess(String admissionId, String mobile) {
        boolean hasAccess = mobile != null && caregivers.findByAdmissionAdmissionIdAndAccessStatusOrderByCreatedAtDesc(admissionId, AccessStatus.ACTIVE).stream()
                .anyMatch(caregiver -> MobileNumberNormalizer.matches(caregiver.getCaregiverMobile(), mobile));
        if (!hasAccess) throw new UnauthorizedException("Caregiver is not authorized for this admission");
    }
}
