package com.carebridge.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.carebridge.api.dto.CreatePatientRequest;
import com.carebridge.api.entity.Patient;
import com.carebridge.api.repository.PatientRepository;
import org.junit.jupiter.api.Test;

class PatientServiceTest {
    @Test
    void createGeneratesPatientIdAndPersistsBloodGroup() {
        PatientRepository patients = mock(PatientRepository.class);
        when(patients.existsById(anyString())).thenReturn(false);
        when(patients.save(any(Patient.class))).thenAnswer(invocation -> invocation.getArgument(0));
        PatientService service = new PatientService(patients);

        Patient created = service.create(
                new CreatePatientRequest("Mira Patel", 42, "Female", "+91 9876543210", "O+"));

        assertTrue(created.getPatientId().matches("P-[A-F0-9]{8}"));
        assertEquals("Mira Patel", created.getName());
        assertEquals("O+", created.getBloodGroup());
    }
}