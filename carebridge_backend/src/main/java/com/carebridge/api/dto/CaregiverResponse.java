package com.carebridge.api.dto;
import com.carebridge.api.entity.AdmissionCaregiver;
public record CaregiverResponse(String caregiverName, String caregiverMobile, String relationship, String accessStatus) {
    public static CaregiverResponse from(AdmissionCaregiver c) { return new CaregiverResponse(c.getCaregiverName(), c.getCaregiverMobile(), c.getRelationship(), c.getAccessStatus().name()); }
}
