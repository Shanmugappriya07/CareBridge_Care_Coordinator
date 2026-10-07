package com.carebridge.api.repository;
import com.carebridge.api.entity.AdmissionCaregiver;
import com.carebridge.api.entity.AccessStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
public interface AdmissionCaregiverRepository extends JpaRepository<AdmissionCaregiver, Long> {
    List<AdmissionCaregiver> findByCaregiverMobileAndAccessStatusOrderByCreatedAtDesc(String mobile, AccessStatus status);
    List<AdmissionCaregiver> findByAccessStatusOrderByCreatedAtDesc(AccessStatus status);
    List<AdmissionCaregiver> findByAdmissionAdmissionIdAndAccessStatusOrderByCreatedAtDesc(String admissionId, AccessStatus status);
    Optional<AdmissionCaregiver> findFirstByAdmissionPatientPatientIdOrderByCreatedAtDesc(String patientId);
    Optional<AdmissionCaregiver> findFirstByAdmissionAdmissionIdAndAccessStatusOrderByCreatedAtDesc(String admissionId, AccessStatus status);
    boolean existsByAdmissionAdmissionIdAndCaregiverMobileAndAccessStatus(String admissionId, String mobile, AccessStatus status);
}
