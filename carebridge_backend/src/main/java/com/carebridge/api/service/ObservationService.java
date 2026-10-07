package com.carebridge.api.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.carebridge.api.dto.CreateObservationRequest;
import com.carebridge.api.dto.ObservationResponse;
import com.carebridge.api.entity.Admission;
import com.carebridge.api.entity.AdmissionRecord;
import com.carebridge.api.exception.ConflictException;
import com.carebridge.api.repository.AdmissionRecordRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ObservationService {
    private static final String RESOURCE_TYPE = "observations";

    private final AdmissionService admissions;
    private final AdmissionRecordRepository records;
    private final ObjectMapper objectMapper;

    public ObservationService(
            AdmissionService admissions,
            AdmissionRecordRepository records,
            ObjectMapper objectMapper) {
        this.admissions = admissions;
        this.records = records;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ObservationResponse create(String admissionId, CreateObservationRequest request) {
        Admission admission = admissions.getEntity(admissionId);
        admissions.requireWritable(admissionId);

        String patientId = admission.getPatient().getPatientId();
        if (!admissionId.equals(request.admissionId()) || !patientId.equals(request.patientId())) {
            throw new ConflictException("Observation patient or admission does not match the selected admission");
        }

        ObservationResponse observation = new ObservationResponse(
                patientId,
                admissionId,
                request.doctorName(),
                request.department(),
                request.note(),
                request.vitals(),
                request.createdAt());

        records.save(new AdmissionRecord(admission, RESOURCE_TYPE, serialize(observation)));
        return observation;
    }

    @Transactional(readOnly = true)
    public List<ObservationResponse> forAdmission(String admissionId) {
        admissions.getEntity(admissionId);
        return records
                .findByAdmissionAdmissionIdAndResourceTypeOrderByCreatedAtDesc(
                        admissionId, RESOURCE_TYPE)
                .stream()
                .map(record -> deserialize(record.getPayload()))
                .toList();
    }

    private String serialize(ObservationResponse observation) {
        try {
            return objectMapper.writeValueAsString(observation);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not encode observation", exception);
        }
    }

    private ObservationResponse deserialize(String payload) {
        try {
            return objectMapper.readValue(payload, ObservationResponse.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not read stored observation", exception);
        }
    }
}