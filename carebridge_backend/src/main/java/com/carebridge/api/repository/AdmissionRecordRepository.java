package com.carebridge.api.repository;
import com.carebridge.api.entity.AdmissionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface AdmissionRecordRepository extends JpaRepository<AdmissionRecord, Long> {
    List<AdmissionRecord> findByAdmissionAdmissionIdAndResourceTypeOrderByCreatedAtDesc(String admissionId, String resourceType);
    java.util.Optional<AdmissionRecord> findByIdAndAdmissionAdmissionId(Long id, String admissionId);
}
