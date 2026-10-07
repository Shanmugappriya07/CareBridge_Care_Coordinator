package com.carebridge.api.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.carebridge.api.entity.Admission;
import com.carebridge.api.entity.AdmissionRecord;
import com.carebridge.api.entity.Patient;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class AdmissionRecordRepositoryTest {
    @Autowired private AdmissionRecordRepository records;
    @Autowired private AdmissionRepository admissions;
    @Autowired private PatientRepository patients;

    @Test
    void scheduleRecordsAreScopedToAdmissionAndCanBeUpdated() {
        Patient patient = patients.save(
                new Patient("P-SCHEDULE-1", "Schedule Patient", 40, "Other", "", ""));
        Admission admission = admissions.save(new Admission(
                "ADM-SCHEDULE-1",
                patient,
                LocalDate.of(2026, 9, 29),
                "Dr. Test",
                "Medicine",
                "Ward 1",
                null,
                "CareBridge Hospital"));
        AdmissionRecord saved = records.save(new AdmissionRecord(
                admission,
                "schedule",
                "{\"admissionId\":\"ADM-SCHEDULE-1\",\"status\":\"SCHEDULED\"}"));

        assertEquals(1, records.findByAdmissionAdmissionIdAndResourceTypeOrderByCreatedAtDesc(
                admission.getAdmissionId(), "schedule").size());
        assertTrue(records.findByIdAndAdmissionAdmissionId(saved.getId(), "ADM-OTHER").isEmpty());

        saved.updatePayload("{\"admissionId\":\"ADM-SCHEDULE-1\",\"status\":\"COMPLETED\"}");
        records.saveAndFlush(saved);

        assertTrue(records.findByIdAndAdmissionAdmissionId(saved.getId(), admission.getAdmissionId())
                .orElseThrow().getPayload().contains("COMPLETED"));
    }
}