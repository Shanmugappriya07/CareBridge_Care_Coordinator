package com.carebridge.api.service;

import com.carebridge.api.dto.CreatePatientRequest;
import com.carebridge.api.entity.Patient;
import com.carebridge.api.repository.PatientRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
public class PatientService {
    private final PatientRepository patients;
    public PatientService(PatientRepository patients) { this.patients = patients; }
    @Transactional public Patient create(CreatePatientRequest request) {
        String patientId;
        do { patientId = "P-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(); }
        while (patients.existsById(patientId));
        return patients.save(new Patient(patientId, request.name(), request.age(), request.gender(), request.phone(), request.bloodGroup()));
    }
    @Transactional(readOnly = true) public Patient get(String patientId) { return patients.findById(patientId).orElseThrow(() -> new com.carebridge.api.exception.ResourceNotFoundException("Patient not found: " + patientId)); }
    @Transactional(readOnly = true) public List<Patient> search(String query) { return query == null || query.isBlank() ? patients.findAll() : patients.findByNameContainingIgnoreCaseOrPhoneContaining(query, query); }
}
