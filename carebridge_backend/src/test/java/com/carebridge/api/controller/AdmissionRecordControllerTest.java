package com.carebridge.api.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.carebridge.api.dto.RecordRequest;
import com.carebridge.api.entity.Admission;
import com.carebridge.api.entity.AdmissionCaregiver;
import com.carebridge.api.entity.AdmissionRecord;
import com.carebridge.api.entity.Patient;
import com.carebridge.api.exception.ConflictException;
import com.carebridge.api.exception.UnauthorizedException;
import com.carebridge.api.repository.AdmissionCaregiverRepository;
import com.carebridge.api.repository.AdmissionRecordRepository;
import com.carebridge.api.repository.AdmissionRepository;
import com.carebridge.api.repository.DischargeSummaryRepository;
import com.carebridge.api.repository.PatientRepository;
import com.carebridge.api.service.AccessService;
import com.carebridge.api.service.AdmissionService;
import com.carebridge.api.service.PatientService;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AdmissionRecordControllerTest {
    private static final String ADMISSION_ID = "ADM-PRESCRIPTION-1";
    private static final String CAREGIVER_MOBILE = "+91 9876543210";

    @Test
    void activeAdmissionAllowsPrescriptionCreateAndAuthorizedRead() {
        Admission admission = admission();
        AdmissionRecordRepository records = mock(AdmissionRecordRepository.class);
        AdmissionCaregiverRepository caregivers = mock(AdmissionCaregiverRepository.class);
        AdmissionRecordController controller = controller(admission, records, caregivers);
        String payload = "{\"prescriptionId\":\"RX-1\",\"admissionId\":\"" + ADMISSION_ID + "\"}";
        when(records.save(any(AdmissionRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(caregivers.findByAdmissionAdmissionIdAndAccessStatusOrderByCreatedAtDesc(
                ADMISSION_ID, com.carebridge.api.entity.AccessStatus.ACTIVE))
                .thenReturn(List.of(new AdmissionCaregiver(
                        admission, "Caregiver", CAREGIVER_MOBILE, "Relative")));
        when(records.findByAdmissionAdmissionIdAndResourceTypeOrderByCreatedAtDesc(
                ADMISSION_ID, "prescriptions"))
                .thenReturn(List.of(new AdmissionRecord(admission, "prescriptions", payload)));

        var created = controller.create(
                ADMISSION_ID, new RecordRequest("prescriptions", payload, null), "true");
        var listed = controller.list(ADMISSION_ID, "prescriptions", CAREGIVER_MOBILE, null);

        assertEquals("prescriptions", created.resourceType());
        assertEquals(payload, created.payload());
        assertEquals(1, listed.size());
        assertEquals(payload, listed.get(0).payload());
    }

    @Test
    void activeAdmissionAllowsPharmacyCreateAndAuthorizedRead() {
        Admission admission = admission();
        AdmissionRecordRepository records = mock(AdmissionRecordRepository.class);
        AdmissionCaregiverRepository caregivers = mock(AdmissionCaregiverRepository.class);
        AdmissionRecordController controller = controller(admission, records, caregivers);
        String payload = "{\"orderId\":\"PH-1\",\"admissionId\":\"" + ADMISSION_ID + "\",\"paymentStatus\":\"UNPAID\"}";
        when(records.save(any(AdmissionRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(caregivers.findByAdmissionAdmissionIdAndAccessStatusOrderByCreatedAtDesc(
                ADMISSION_ID, com.carebridge.api.entity.AccessStatus.ACTIVE))
                .thenReturn(List.of(new AdmissionCaregiver(
                        admission, "Caregiver", CAREGIVER_MOBILE, "Relative")));
        when(records.findByAdmissionAdmissionIdAndResourceTypeOrderByCreatedAtDesc(
                ADMISSION_ID, "pharmacy"))
                .thenReturn(List.of(new AdmissionRecord(admission, "pharmacy", payload)));

        var created = controller.create(
                ADMISSION_ID, new RecordRequest("pharmacy", payload, null), "true");
        var listed = controller.list(ADMISSION_ID, "pharmacy", CAREGIVER_MOBILE, null);

        assertEquals("pharmacy", created.resourceType());
        assertEquals(payload, created.payload());
        assertEquals(1, listed.size());
        assertEquals(payload, listed.get(0).payload());
    }

    @Test
    void activeAdmissionAllowsPharmacyRecordUpdate() {
        Admission admission = admission();
        AdmissionRecordRepository records = mock(AdmissionRecordRepository.class);
        AdmissionRecord existing = new AdmissionRecord(
                admission, "pharmacy", "{\"orderId\":\"PH-1\",\"pickupStatus\":\"READY\"}");
        AdmissionCaregiverRepository caregivers = mock(AdmissionCaregiverRepository.class);
        when(records.findByIdAndAdmissionAdmissionId(21L, ADMISSION_ID))
                .thenReturn(Optional.of(existing));
        when(records.save(any(AdmissionRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        AdmissionRecordController controller = controller(admission, records, caregivers);
        String payload = "{\"orderId\":\"PH-1\",\"pickupStatus\":\"COLLECTED\"}";

        var updated = controller.update(
                ADMISSION_ID, 21L, new RecordRequest("pharmacy", payload, null), "true");

        assertEquals("pharmacy", updated.resourceType());
        assertEquals(payload, updated.payload());
    }

    @Test
    void activeAdmissionAllowsTestReportCreate() {
        Admission admission = admission();
        AdmissionRecordRepository records = mock(AdmissionRecordRepository.class);
        when(records.save(any(AdmissionRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        AdmissionRecordController controller = controller(
                admission, records, mock(AdmissionCaregiverRepository.class));
        String payload = "{\"reportId\":\"LAB-1\",\"admissionId\":\"" + ADMISSION_ID + "\"}";

        var created = controller.create(
                ADMISSION_ID, new RecordRequest("tests", payload, null), "true");

        assertEquals("tests", created.resourceType());
        assertEquals(payload, created.payload());
    }

    @Test
    void activeAdmissionAllowsScanCreate() {
        Admission admission = admission();
        AdmissionRecordRepository records = mock(AdmissionRecordRepository.class);
        when(records.save(any(AdmissionRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        AdmissionRecordController controller = controller(
                admission, records, mock(AdmissionCaregiverRepository.class));
        String payload = "{\"reportId\":\"SCAN-1\",\"admissionId\":\"" + ADMISSION_ID + "\"}";

        var created = controller.create(
                ADMISSION_ID, new RecordRequest("scans", payload, null), "true");

        assertEquals("scans", created.resourceType());
        assertEquals(payload, created.payload());
    }

    @Test
        void caregiverWithoutActiveAccessCannotReadTestRecords() {
        Admission admission = admission();
        AdmissionCaregiverRepository caregivers = mock(AdmissionCaregiverRepository.class);
        when(caregivers.findByAdmissionAdmissionIdAndAccessStatusOrderByCreatedAtDesc(
                ADMISSION_ID, com.carebridge.api.entity.AccessStatus.ACTIVE))
                .thenReturn(List.of());
        AdmissionRecordController controller = controller(
                admission, mock(AdmissionRecordRepository.class), caregivers);

        assertThrows(UnauthorizedException.class,
                () -> controller.list(ADMISSION_ID, "tests", CAREGIVER_MOBILE, null));
    }

    @Test
    void dischargedAdmissionRejectsPrescriptionWrites() {
        Admission admission = admission();
        admission.discharge(LocalDate.now());
        AdmissionRecordController controller = controller(
                admission,
                mock(AdmissionRecordRepository.class),
                mock(AdmissionCaregiverRepository.class));

        assertThrows(ConflictException.class, () -> controller.create(
                ADMISSION_ID,
                new RecordRequest("pharmacy", "{}", null),
                "true"));
    }

    private AdmissionRecordController controller(
            Admission admission,
            AdmissionRecordRepository records,
            AdmissionCaregiverRepository caregivers) {
        AdmissionRepository admissions = mock(AdmissionRepository.class);
        when(admissions.findById(ADMISSION_ID)).thenReturn(Optional.of(admission));
        AdmissionService admissionService = new AdmissionService(
                admissions,
                caregivers,
                new PatientService(mock(PatientRepository.class)),
                mock(DischargeSummaryRepository.class),
                null);
        return new AdmissionRecordController(
                admissionService, new AccessService(caregivers), records);
    }

    private Admission admission() {
        Patient patient = new Patient("PAT-PRESCRIPTION-1", "Test Patient", 40,
                "Other", "", "");
        return new Admission(ADMISSION_ID, patient, LocalDate.now(), "Dr. Test",
                "Medicine", "Ward 1", null, "CareBridge Hospital");
    }
}