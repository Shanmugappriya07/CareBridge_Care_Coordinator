package com.carebridge.api.service;

import com.carebridge.api.dto.*;
import com.carebridge.api.entity.*;
import com.carebridge.api.exception.*;
import com.carebridge.api.repository.*;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class AdmissionService {
    private final AdmissionRepository admissions;
    private final AdmissionCaregiverRepository caregivers;
    private final PatientService patientService;
    private final DischargeSummaryRepository summaries;
    private final EntityManager entityManager;

    public AdmissionService(AdmissionRepository admissions, AdmissionCaregiverRepository caregivers, PatientService patientService, DischargeSummaryRepository summaries, EntityManager entityManager) { this.admissions=admissions; this.caregivers=caregivers; this.patientService=patientService; this.summaries=summaries; this.entityManager=entityManager; }
    @Transactional public AdmissionResponse create(CreateAdmissionRequest r) {
        Patient patient = patientService.get(r.patientId());
        String id;
        do { id = "ADM-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(); } while (admissions.existsById(id));
        Admission admission = admissions.save(new Admission(id, patient, LocalDate.now(), r.doctor(), r.department(), r.room(), r.reason(), r.hospitalName()));
        AdmissionCaregiver caregiver = caregivers.save(new AdmissionCaregiver(admission, r.caregiverName(), r.caregiverMobile(), r.relationship()));
        return AdmissionResponse.from(admission, CaregiverResponse.from(caregiver));
    }
    @Transactional(readOnly = true) public List<AdmissionResponse> all() { return admissions.findAll().stream().map(a -> AdmissionResponse.from(a, latestCaregiver(a))).toList(); }
    @Transactional(readOnly = true) public List<AdmissionResponse> forPatient(String patientId) { return admissions.findByPatientPatientIdOrderByStatusAscAdmissionDateDesc(patientId).stream().map(a -> AdmissionResponse.from(a, latestCaregiver(a))).toList(); }
    @Transactional(readOnly = true) public AdmissionResponse get(String id) { Admission a = getEntity(id); return AdmissionResponse.from(a, latestCaregiver(a)); }
    @Transactional public AdmissionResponse discharge(String id, DischargeRequest request) {
        Admission a = getEntity(id); if (a.getStatus() == AdmissionStatus.DISCHARGED) throw new ConflictException("Admission is already discharged");
        a.discharge(LocalDate.now()); admissions.save(a);
        if (request != null && request.summary() != null && !request.summary().isBlank()) {
            DischargeSummary summary = summaries.findById(id).orElse(null);
            if (summary == null) entityManager.persist(new DischargeSummary(a, request.summary()));
            else summary.updateSummary(request.summary());
        }
        return get(id);
    }
    @Transactional public CaregiverResponse assignCaregiver(String id, AssignCaregiverRequest request) {
        Admission admission = getEntity(id);
        requireWritable(id);
        caregivers.findFirstByAdmissionAdmissionIdAndAccessStatusOrderByCreatedAtDesc(id, AccessStatus.ACTIVE).ifPresent(caregiver -> {
            caregiver.disable();
            caregivers.save(caregiver);
        });
        return CaregiverResponse.from(caregivers.save(new AdmissionCaregiver(admission, request.caregiverName(), request.caregiverMobile(), request.relationship())));
    }
    @Transactional(readOnly = true) public DischargeSummary summary(String id) { getEntity(id); return summaries.findById(id).orElseThrow(() -> new ResourceNotFoundException("Discharge summary unavailable")); }
    public Admission getEntity(String id) { return admissions.findById(id).orElseThrow(() -> new ResourceNotFoundException("Admission not found: " + id)); }
    public void requireWritable(String id) { if (getEntity(id).getStatus() == AdmissionStatus.DISCHARGED) throw new ConflictException("Discharged admissions are read-only"); }
    private CaregiverResponse latestCaregiver(Admission a) { return caregivers.findFirstByAdmissionAdmissionIdAndAccessStatusOrderByCreatedAtDesc(a.getAdmissionId(), AccessStatus.ACTIVE).map(CaregiverResponse::from).orElse(null); }
}
