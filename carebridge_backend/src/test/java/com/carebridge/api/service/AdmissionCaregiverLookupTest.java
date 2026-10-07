package com.carebridge.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.carebridge.api.controller.CaregiverController;
import com.carebridge.api.dto.CreateAdmissionRequest;
import com.carebridge.api.entity.AccessStatus;
import com.carebridge.api.entity.Admission;
import com.carebridge.api.entity.AdmissionCaregiver;
import com.carebridge.api.entity.Patient;
import com.carebridge.api.repository.AdmissionCaregiverRepository;
import com.carebridge.api.repository.AdmissionRepository;
import com.carebridge.api.repository.DischargeSummaryRepository;
import com.carebridge.api.repository.PatientRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class AdmissionCaregiverLookupTest {
    @Test
    void newlyCreatedAdmissionIsFindableByBothMobileFormats() {
        AdmissionRepository admissions = mock(AdmissionRepository.class);
        AdmissionCaregiverRepository caregivers = mock(AdmissionCaregiverRepository.class);
        PatientRepository patientRepository = mock(PatientRepository.class);
        Patient patient = new Patient("P-FUTURE-TEST", "Test Patient", 40, "Other", "", "");
        when(patientRepository.findById("P-FUTURE-TEST")).thenReturn(Optional.of(patient));
        PatientService patients = new PatientService(patientRepository);
        when(admissions.existsById(anyString())).thenReturn(false);
        when(admissions.save(any(Admission.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(caregivers.save(any(AdmissionCaregiver.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdmissionService service = new AdmissionService(
                admissions,
                caregivers,
                patients,
                mock(DischargeSummaryRepository.class),
                null);
        var created = service.create(new CreateAdmissionRequest(
                "P-FUTURE-TEST",
                "Test Caregiver",
                "9876543210",
                "Relative",
                "Test Doctor",
                "General Medicine",
                "Ward 1",
                null,
                "Test Hospital"));

        ArgumentCaptor<AdmissionCaregiver> savedCaregiver =
                ArgumentCaptor.forClass(AdmissionCaregiver.class);
        verify(caregivers).save(savedCaregiver.capture());
        AdmissionCaregiver caregiver = savedCaregiver.getValue();
        assertEquals(created.admissionId(), caregiver.getAdmission().getAdmissionId());
        assertEquals("Test Caregiver", caregiver.getCaregiverName());
        assertEquals("+91 9876543210", caregiver.getCaregiverMobile());
        assertEquals("Relative", caregiver.getRelationship());
        assertEquals(AccessStatus.ACTIVE, caregiver.getAccessStatus());

                when(caregivers.findByAccessStatusOrderByCreatedAtDesc(AccessStatus.ACTIVE))
                .thenReturn(List.of(caregiver));
        CaregiverController controller = new CaregiverController(caregivers, service);

                for (String mobile : List.of("+919876543210", "+91 9876543210", "+91 98765 43210", "9876543210")) {
            var result = controller.admissions(mobile);
            assertEquals(1, result.size());
            assertEquals(created.admissionId(), result.get(0).admissionId());
        }
    }

        @Test
        void lookupMatchesLegacyStoredMobileFormatting() {
                AdmissionCaregiverRepository caregivers = mock(AdmissionCaregiverRepository.class);
                Admission admission = new Admission("ADM-LEGACY", new Patient("P-LEGACY", "Legacy Patient", 45, "Other", "", ""), null, "Doctor", "Medicine", "Ward 1", null, "Hospital");
                AdmissionCaregiver caregiver = new AdmissionCaregiver(admission, "Caregiver", "7339140106", "Relative");
                org.springframework.test.util.ReflectionTestUtils.setField(caregiver, "caregiverMobile", "+91 73391 40106");
                when(caregivers.findByAccessStatusOrderByCreatedAtDesc(AccessStatus.ACTIVE)).thenReturn(List.of(caregiver));

                CaregiverController controller = new CaregiverController(caregivers, null);
                for (String mobile : List.of("+917339140106", "+91 7339140106", "+91 73391 40106", "7339140106")) {
                        assertEquals(1, controller.admissions(mobile).size());
                }
        }
}