package com.carebridge.api.repository;
import com.carebridge.api.entity.Admission;
import com.carebridge.api.entity.AdmissionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface AdmissionRepository extends JpaRepository<Admission, String> {
    List<Admission> findByPatientPatientIdOrderByStatusAscAdmissionDateDesc(String patientId);
    List<Admission> findByPatientPatientIdOrderByAdmissionDateDesc(String patientId);
    boolean existsByPatientPatientIdAndStatus(String patientId, AdmissionStatus status);
}
